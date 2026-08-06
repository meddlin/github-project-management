# Architecture

## Overview

GitHub Project Management is a TypeScript pnpm workspace for managing GitHub repository and project planning data across multiple repositories. The system syncs repository, issue, and GitHub Projects v2 metadata from GitHub into a local Postgres database, then exposes that data through a Next.js web application for repository inventory and planning workflows.

The repository is organized as a monorepo with a web app, a CLI app, a shared Prisma database package, and shared TypeScript configuration.

## Tech Stack

- **Runtime and package management:** Node.js 22.13.1 and pnpm 11.0.3.
- **Web framework:** Next.js 15 App Router with React 19.
- **UI layer:** Tailwind CSS 4, Radix UI primitives, lucide-react icons, and shadcn-style local UI components under `apps/web/src/components/ui`.
- **CLI framework:** Commander, with TypeScript execution in development through `tsx`.
- **Data access:** Prisma 6 through the shared `@gpm/db` workspace package.
- **Database:** PostgreSQL, with local development backed by the `postgres:16-alpine` Docker image.
- **External APIs:** GitHub REST and GraphQL APIs authenticated by `GITHUB_PAT`.
- **Deployment packaging:** Multi-stage Docker build for the web app using Next.js standalone output.

## System Components

### `apps/web`

The web application is a Next.js App Router app. It renders repository inventory, favorite repositories, project-oriented views, and per-repository planning pages. Pages read persisted GitHub data from Postgres through `@gpm/db`.

Server actions in `apps/web/src/app/actions.ts` handle mutations such as repository favorites, local planning fields, GitHub issue creation, and GitHub issue updates. After mutations, the app revalidates affected routes with `revalidatePath`.

The web app is configured with `output: "standalone"` in `apps/web/next.config.ts` so it can be packaged into a production container.

### `apps/cli`

The CLI is exposed as `gpm` and implemented with Commander. In development it is run with:

```sh
pnpm --filter @gpm/cli dev -- <command>
```

The main commands are:

- `doctor`: validates required environment variables.
- `repos sync`: syncs repositories and issues visible to `GITHUB_PAT` into Postgres.
- `projects import-statuses`: imports linked GitHub Projects v2 status data into Postgres.

The CLI is the primary ingestion path from GitHub into the local database.

### `packages/db`

The `@gpm/db` package owns the Prisma schema, migrations, Prisma client generation, and shared database client export. It loads environment variables from `GPM_ENV_FILE`, a package-local `.env`, or the repository-root `.env`.

In non-production environments, the Prisma client is cached on `globalThis` to reduce duplicate client creation during local development.

### `packages/tsconfig`

The shared TypeScript configuration package provides base, Node, and Next.js TypeScript settings consumed by the workspace packages.

## Data Flow

1. A developer configures `DATABASE_URL` and `GITHUB_PAT`.
2. Local Postgres runs through Docker Compose, or production Postgres is provided by the deployment environment.
3. Prisma migrations create and update the database schema.
4. The CLI calls GitHub GraphQL and REST APIs using `GITHUB_PAT`.
5. Repository, issue, project, project item, and sync-run data is persisted through Prisma.
6. The Next.js web app reads persisted data through `@gpm/db`.
7. Web server actions write local planning state through Prisma and can create or update GitHub issues through GitHub APIs.
8. After server-action mutations, affected web routes are revalidated.

## Data Storage

Postgres is the system of record for synced and locally managed planning data. The Prisma schema models include:

- `GitHubRepository`: repository inventory, metadata, language, favorite state, issue counts, pull request counts, project counts, and sync timestamps. `pullRequestsSyncedAt` distinguishes missing post-migration PR data from a true zero count.
- `GitHubIssue`: synced GitHub issues plus local planning status, planning status source, planning dates, labels, assignees, and issue body text.
- `GitHubPullRequest`: synced open GitHub pull requests for the repository details sheet.
- `GitHubProject`: imported GitHub Projects v2 metadata.
- `GitHubRepositoryProject`: join table between repositories and imported projects.
- `GitHubProjectItem`: imported project items for issues and draft issues, including imported project status fields.
- `GitHubRepositorySyncRun`: status and summary information for repository sync runs.

Planning status values are represented by Prisma enums. Statuses can come from GitHub labels, imported GitHub Project status fields, or local edits.

## Getting Started

Install dependencies:

```sh
pnpm install
```

Create a local environment file:

```sh
cp .env.example .env
```

Set `GITHUB_PAT` in `.env` to a GitHub personal access token that can read the repositories and projects you want to sync. Keep `NEXT_PUBLIC_APP_NAME` as-is unless the local app name should change.

Start local Postgres:

```sh
docker compose up -d postgres
```

Check the database port before running Prisma or the app. The current `.env.example` and root package scripts default `DATABASE_URL` to port `5433`, while `docker-compose.yml` currently publishes Postgres on port `5432`. Make the `DATABASE_URL` in `.env` match the port you are actually using. With the current Compose file, that value should use `localhost:5432`.

Generate the Prisma client:

```sh
pnpm db:generate
```

Apply database migrations:

```sh
pnpm db:migrate:deploy
```

Validate local CLI configuration:

```sh
pnpm --filter @gpm/cli dev -- doctor
```

Sync GitHub repository and issue data:

```sh
pnpm --filter @gpm/cli dev -- repos sync
```

Import linked GitHub Projects v2 statuses:

```sh
pnpm --filter @gpm/cli dev -- projects import-statuses
```

Start the web development server:

```sh
pnpm dev
```

The web app runs through the `@gpm/web` Next.js development server. The root `pnpm dev` script generates the Prisma client before starting the web app.

## Deployment Strategy

The repository includes a production Dockerfile at `apps/web/Dockerfile`. It uses a multi-stage build:

1. Install workspace dependencies with pnpm.
2. Generate the Prisma client.
3. Build the Next.js web app.
4. Copy the Next.js standalone output and static assets into a slim runtime image.
5. Run `node apps/web/server.js` as a non-root user.

The runtime container listens on port `3000` with `HOSTNAME=0.0.0.0`.

Production deployments should provide these environment variables:

- `DATABASE_URL`: connection string for an external Postgres database.
- `GITHUB_PAT`: token used by server actions that call GitHub APIs.
- `NEXT_PUBLIC_APP_NAME`: optional public display name for the app.

Database migrations should be applied before or during deployment with:

```sh
pnpm db:migrate:deploy
```

The Docker image can be built from the repository root with:

```sh
docker build -f apps/web/Dockerfile .
```

No provider-specific deployment configuration is present in the repository. The current strategy is therefore platform-neutral: build the web container, run it with the required environment variables, connect it to managed or self-hosted Postgres, and run migrations against that database as part of the release process.
