# syntax=docker/dockerfile:1
# Build: docker build -f docker/media-worker.Dockerfile -t easysignage-media-worker .
FROM node:22-bookworm-slim AS base
# ffmpeg fornece também o ffprobe usado para extrair duração/resolução/codec de vídeo.
RUN apt-get update && apt-get install -y ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY docker/npmrc.docker .npmrc
COPY packages/shared-types ./packages/shared-types
COPY apps/media-worker ./apps/media-worker
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @easysignage/media-worker^... build
RUN test -f packages/shared-types/dist/index.d.ts
RUN pnpm --filter @easysignage/media-worker build
RUN pnpm --filter @easysignage/media-worker deploy --prod /out

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /out/ ./
CMD ["node", "dist/index.js"]
