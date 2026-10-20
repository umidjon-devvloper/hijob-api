# N24:31 API — multi-stage build. Copies the workspace root so pnpm can
# resolve @n2431/* workspace packages, then prunes to a small runtime image.
FROM node:20-slim AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

# Copy the workspace lockfile + configs the resolver needs.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY services/api ./services/api

RUN pnpm install --frozen-lockfile --filter @n2431/api...
RUN pnpm --filter @n2431/api prisma:generate
RUN pnpm --filter @n2431/api build

# Runtime image — no dev deps, no source.
FROM node:20-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate \
    && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /repo/pnpm-workspace.yaml /repo/pnpm-lock.yaml /repo/.npmrc ./
COPY --from=builder /repo/services/api/package.json ./services/api/
COPY --from=builder /repo/services/api/dist ./services/api/dist
COPY --from=builder /repo/services/api/prisma ./services/api/prisma
COPY --from=builder /repo/services/api/node_modules ./services/api/node_modules
COPY --from=builder /repo/packages ./packages

WORKDIR /app/services/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]
