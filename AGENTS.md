# Repository Guidelines

## Project Structure & Module Organization

- `apps/web`: Next.js App Router application. UI and server actions live under `apps/web/src/app`; shared utilities live in `apps/web/src/lib`; assets belong in `apps/web/public`.
- `apps/cli`: Commander-based CLI exposed as `gpm`; entry point is `apps/cli/src/index.ts`.
- `packages/db`: Prisma client setup and database schema. Edit schema in `packages/db/prisma/schema.prisma`; generated client code is consumed through `@gpm/db`.
- `packages/tsconfig`: shared TypeScript configuration presets.
- `docs`: documentation.

## Build, Test, and Development Commands

Use Node.js `22.13.1` and pnpm `11.0.3`.

- `pnpm install`: install workspace dependencies.
- `cp .env.example .env`: create local configuration.
- `docker compose up -d postgres`: start local Postgres.
- `pnpm dev`: generate Prisma client, then run the web app.
- `pnpm build`: generate Prisma client and build all packages.
- `pnpm lint`: run ESLint across the repository with zero warnings.
- `pnpm typecheck`: generate Prisma client and run package TypeScript checks.
- `pnpm db:validate`: validate the Prisma schema.
- `pnpm --filter @gpm/cli dev -- --help`: run the CLI locally.

## Coding Style & Naming Conventions

Use ESM TypeScript throughout. Follow existing formatting: two-space indentation, double quotes, semicolons, and named exports. React components use `PascalCase`; functions and variables use `camelCase`. Prefix intentionally unused parameters or variables with `_` to satisfy ESLint. Keep Next.js code aligned with App Router patterns.

## Testing Guidelines

No committed test framework or `test` script is currently present. Until one is added, validate changes with `pnpm lint`, `pnpm typecheck`, and targeted manual checks through the web app or CLI. When adding tests, place them near the code and use names like `feature-name.test.ts`.

## Commit & Pull Request Guidelines

Recent history uses short imperative commits, with Conventional Commit style for dependency work, for example `build(deps-dev): bump tsx from 4.22.0 to 4.23.1`. Keep commits focused and descriptive. Pull requests should explain the change, list validation commands run, link related issues, and include screenshots for visible web UI changes.

## Security & Configuration Tips

Do not commit `.env` or credentials. Local development expects `DATABASE_URL`; GitHub sync commands also require `GITHUB_PAT`. Prefer the defaults in root scripts unless a task specifically requires overriding environment values.

## GitHub Actions

When editing `.github/workflows/*.yml`, do not use mutable action tags such as `@v4`, `@main`, or branch names. Pin actions to commit SHAs and keep the version comment so Dependabot can propose future SHA updates:

```yaml
uses: action@<commit-SHA> # <ver>
```

Example:

```yaml
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4
```
