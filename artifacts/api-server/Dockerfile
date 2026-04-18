FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

FROM base AS builder
WORKDIR /workspace

COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /workspace/artifacts/api-server/dist ./dist

ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
