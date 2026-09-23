#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-vps}"
DIR="${DEPLOY_DIR:-/root/guttasjefen}"
DEPLOY_COMMANDS=false
[[ "${1:-}" == "--commands" ]] && DEPLOY_COMMANDS=true

cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
	echo "warning: deploying uncommitted changes"
fi

echo "==> Syncing code to $HOST:$DIR"
ssh "$HOST" "mkdir -p '$DIR'"
rsync -az --delete \
	--include .env.example \
	--exclude .git \
	--exclude node_modules \
	--exclude docs \
	--exclude '.env' \
	--exclude '.env.*' \
	--exclude cookies.txt \
	./ "$HOST:$DIR/"

echo "==> Building and restarting on $HOST"
ssh "$HOST" DIR="$DIR" DEPLOY_COMMANDS="$DEPLOY_COMMANDS" bash -s <<'REMOTE'
set -euo pipefail
cd "$DIR"

if [[ ! -f .env ]]; then
	echo "error: $DIR/.env is missing. Copy it over with: scp .env <host>:$DIR/.env" >&2
	exit 1
fi

missing=$(comm -23 \
	<(grep -oE '^[A-Z_]+' .env.example | sort -u) \
	<(grep -oE '^[A-Z_]+' .env | sort -u))
if [[ -n "$missing" ]]; then
	echo "warning: server .env is missing keys from .env.example:" $missing
fi

# Docker creates a directory if a bind-mounted file doesn't exist, which breaks the cookie loader
if [[ ! -f cookies.txt ]]; then
	echo "warning: no cookies.txt on the server, creating an empty one"
	touch cookies.txt
fi

docker compose up -d --build --remove-orphans

if [[ "$DEPLOY_COMMANDS" == true ]]; then
	docker compose run --rm bot pnpm deploy-commands
fi

docker image prune -f >/dev/null
sleep 3
docker compose ps
docker compose logs --tail 20 bot
REMOTE

echo "==> Deployed"
