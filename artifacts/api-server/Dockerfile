FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

FROM base AS builder
WORKDIR /workspace

# Copy package manifests before source so the pnpm install layer is only
# invalidated when dependencies change, not when application code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json     ./artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY artifacts/operator-panel/package.json ./artifacts/operator-panel/
COPY lib/api-client-react/package.json     ./lib/api-client-react/
COPY lib/api-spec/package.json             ./lib/api-spec/
COPY lib/api-zod/package.json              ./lib/api-zod/
COPY lib/db/package.json                   ./lib/db/
COPY scripts/package.json                  ./scripts/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @workspace/api-server run build

# Build the operator-panel SPA.
# PORT satisfies the vite.config.ts startup guard (dev-server only, not used here).
# BASE_PATH=/ roots all asset paths at / for production serving.
RUN PORT=8080 BASE_PATH=/ pnpm --filter @workspace/operator-panel run build

FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /workspace/artifacts/api-server/dist ./dist

# Output path confirmed from artifacts/operator-panel/vite.config.ts line 58:
#   outDir: path.resolve(import.meta.dirname, "dist/public")
COPY --from=builder /workspace/artifacts/operator-panel/dist/public ./public

ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
