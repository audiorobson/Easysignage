# syntax=docker/dockerfile:1
# Build (na raiz): docker build -f docker/cms.Dockerfile -t easysignage-cms .
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY docker/npmrc.docker .npmrc
COPY packages ./packages
COPY apps/cms ./apps/cms
RUN pnpm install --frozen-lockfile
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @easysignage/cms^... build
RUN pnpm --filter @easysignage/cms build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Standalone Next (monorepo): servidor em apps/cms/server.js
COPY --from=builder /app/apps/cms/.next/standalone ./
COPY --from=builder /app/apps/cms/.next/static ./apps/cms/.next/static
COPY --from=builder /app/apps/cms/public ./apps/cms/public
EXPOSE 3000
CMD ["node", "apps/cms/server.js"]
