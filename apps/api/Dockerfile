# syntax=docker/dockerfile:1
# API image. Build from the REPOSITORY ROOT (the API depends on packages/shared):
#   docker build -f apps/api/Dockerfile -t pms-api .

# ── Build: compile the shared package and the API ─────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
# Install only what the API needs (plus the root's TypeScript compiler).
RUN npm ci --include-workspace-root -w @pms/shared -w @pms/api
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @pms/shared && npm run build -w @pms/api

# ── Runtime: production dependencies + compiled JavaScript only ───────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev -w @pms/shared -w @pms/api && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle

WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start. Migrations are idempotent, so restarts are safe.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
