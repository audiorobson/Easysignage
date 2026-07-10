# syntax=docker/dockerfile:1
# Build (na raiz do monorepo): docker build -f docker/api.Dockerfile -t easysignage-api .
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/license-core ./packages/license-core
COPY packages/device-protocol ./packages/device-protocol
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @easysignage/license-core build
RUN pnpm --filter @easysignage/api build
RUN pnpm --filter @easysignage/api deploy --prod /out

FROM base AS runner
ENV NODE_ENV=production
RUN npm install -g prisma@6.19.3
WORKDIR /app
COPY --from=builder /out/ ./
COPY docker/entrypoint-api.sh /entrypoint-api.sh
RUN chmod +x /entrypoint-api.sh
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["/entrypoint-api.sh"]
