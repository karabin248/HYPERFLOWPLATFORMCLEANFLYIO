# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- **API Server** (`artifacts/api-server`) — Express 5 REST API, port 8080, path `/api`
- **Operator Panel** (`artifacts/operator-panel`) — React+Vite thin client, port 24224, path `/operator/`
  - Pure `fetch()` transport to existing API — no business logic in frontend
  - Components: Header, AddRepoForm, RepoTable, ScanAllButton, GraphView
  - `src/api.ts` = hardened transport layer with error handling
- **Hyperflow Core** (`artifacts/hyperflow-core`) — Python FastAPI runtime, port 8000

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
