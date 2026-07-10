# syntax=docker/dockerfile:1
# Build: docker build -f docker/realtime-gateway.Dockerfile -t easysignage-realtime-gateway .
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY docker/npmrc.docker .npmrc
COPY packages/device-protocol ./packages/device-protocol
COPY apps/realtime-gateway ./apps/realtime-gateway
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @easysignage/realtime-gateway... build
RUN pnpm --filter @easysignage/realtime-gateway deploy --prod /out

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /out/ ./
ENV RT_PORT=3020
EXPOSE 3020
CMD ["node", "dist/index.js"]
