#!/usr/bin/env bash
set -euo pipefail

HOST="${DEPLOY_HOST:-vps}"
DIR="${DEPLOY_DIR:-/root/guttasjefen}"
REGISTER_COMMANDS=false
SYNC_COOKIES=false
for arg in "$@"; do
	case "$arg" in
	--commands) REGISTER_COMMANDS=true ;;
	# The server's cookies are its own; only overwrite them with the local copy when asked
	--cookies) SYNC_COOKIES=true ;;
	*)
		echo "usage: $0 [--commands] [--cookies]" >&2
		exit 1
		;;
	esac
done

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
	--exclude /config \
	--exclude /cookies.txt \
	--exclude data \
	./ "$HOST:$DIR/"

echo "==> Syncing config"
config_files=()
while IFS= read -r -d '' file; do
	if [[ "$file" == config/music/cookies.txt && "$SYNC_COOKIES" != true ]]; then
		echo "skipping $file, pass --cookies to overwrite the server's copy"
	elif grep -q '[^[:space:]]' "$file"; then
		config_files+=("${file#config/}")
	else
		echo "skipping empty $file, keeping the server's copy"
	fi
done < <(find config -type f -print0 2>/dev/null)

if ((${#config_files[@]})); then
	printf '%s\n' "${config_files[@]}" |
		rsync -az --itemize-changes --files-from=- config/ "$HOST:$DIR/config/"
fi

echo "==> Building and restarting on $HOST"
ssh "$HOST" DIR="$DIR" REGISTER_COMMANDS="$REGISTER_COMMANDS" bash -s <<'REMOTE'
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

# Cookies used to live in the project root, and config/ used to be flat; move files
# into their subfolders once. A copy already there came from this deploy and wins
for moved in config/cookies.txt:music/cookies.txt cookies.txt:music/cookies.txt \
	config/{persona.md,chat-rules.md,examples.txt,disliked.txt,issues.txt}:personality/ \
	config/{taste.json,example-tags.json}:personality/taste/; do
	old="${moved%%:*}"
	new="config/${moved#*:}"
	[[ "$new" == */ ]] && new="$new$(basename "$old")"
	[[ -f "$old" ]] || continue
	if [[ -f "$new" ]]; then
		rm "$old"
	else
		echo "moving $old to $new"
		mkdir -p "$(dirname "$new")"
		mv "$old" "$new"
	fi
done
if [[ ! -f config/music/cookies.txt ]]; then
	echo "warning: no config/music/cookies.txt on the server, YouTube will play without cookies"
fi

docker compose up -d --build --remove-orphans

if [[ "$REGISTER_COMMANDS" == true ]]; then
	docker compose run --rm bot pnpm register:commands
fi

docker image prune -f >/dev/null

# A crash on startup shows up as a restart or a stopped container within a few seconds
sleep 8
docker compose ps
docker compose logs --tail 20 bot
status=$(docker inspect -f '{{.State.Status}} {{.RestartCount}}' guttasjefen)
if [[ "$status" != "running 0" ]]; then
	echo "error: bot is not running cleanly (status/restarts: $status)" >&2
	exit 1
fi
REMOTE

echo "==> Deployed"
