FROM node:26-slim

# ffmpeg for audio; build tools as a fallback if @discordjs/opus has no prebuilt binary
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@12.5.1

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
CMD ["pnpm", "start"]
