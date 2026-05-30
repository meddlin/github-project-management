# GitHub Project Management

TypeScript pnpm workspace for managing GitHub project work across multiple repositories.

## Requirements

- Node.js 22.13.1
- pnpm 11.0.3
- Docker

## Workspace

- `apps/web`: Next.js web application
- `apps/cli`: Commander-based CLI exposed as `gpm`
- `packages/db`: Prisma client and Postgres schema
- `packages/tsconfig`: shared TypeScript configs

## Setup

```sh
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:generate
```

## Commands

```sh
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm db:validate
pnpm db:generate
pnpm --filter @gpm/cli dev -- --help
pnpm --filter @gpm/cli dev -- doctor
pnpm --filter @gpm/cli dev -- repos sync
```

## Docker

```sh
docker build -f apps/web/Dockerfile .
```
