# syntax=docker/dockerfile:1
# Pre-build workspace packages (dist incluído no contexto Docker)
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY docker/npmrc.docker .npmrc
COPY packages/shared-types ./packages/shared-types
COPY packages/license-core ./packages/license-core
COPY packages/device-protocol ./packages/device-protocol
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @easysignage/api^... build
RUN test -f packages/shared-types/dist/index.d.ts
RUN pnpm --filter @easysignage/api build
RUN pnpm --filter @easysignage/api deploy --prod /out

FROM base AS runner
ENV NODE_ENV=production
RUN npm install -g prisma@6.19.3 tsx@4.19.2
WORKDIR /app
COPY --from=builder /out/ ./
COPY --from=builder /app/apps/api/prisma/seed.ts ./prisma/seed.ts
COPY --from=builder /app/apps/api/src/generated/prisma-client ./src/generated/prisma-client
COPY docker/entrypoint-api.sh /entrypoint-api.sh
RUN chmod +x /entrypoint-api.sh
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["/entrypoint-api.sh"]
