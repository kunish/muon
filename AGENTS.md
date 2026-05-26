# Repository Guidelines

## Project Structure & Module Organization

Muon is a pnpm monorepo. `apps/desktop` contains the Electron app, Vue renderer,
main/preload code, and most Vitest/Playwright tests. `apps/api` contains the
enterprise API service, and `apps/admin` contains the Admin Web console.
Reusable packages live in `packages/`: `ui` for shared components and tokens,
`rich-text` for editor/rendering helpers, and `enterprise-contracts` for shared
schemas. Static brand assets are in `public/`, Electron packaging icons are in
`build/icons/`, and local Conduit/LiveKit/Postgres/MinIO setup is under
`docker/`.

## Build, Test, and Development Commands

Use root scripts unless you need one workspace:

- `pnpm install --frozen-lockfile`: install exact locked dependencies.
- `pnpm dev`: start local services plus API, Admin, and Desktop dev servers.
- `pnpm dev:web`: run the renderer-only Vite server used by Playwright.
- `pnpm build`: build contracts, rich text, API, Admin, and Desktop.
- `pnpm check`: run format check, lint, unit tests, and build.
- `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:enterprise`: run the main test suites.
- `pnpm services:up|logs|down|seed`: manage local development infrastructure.

## Coding Style & Naming Conventions

The repo uses TypeScript, Vue 3 Composition API, ESLint, and Prettier. Keep files
formatted with `pnpm format` or checked with `pnpm format:check`; pre-commit
hooks run ESLint and Prettier through lint-staged. Prefer public package exports
such as `@muon/ui/avatar` over package-internal paths. Keep Vue components in
PascalCase, composables as `useThing.ts`, and tests named `*.test.ts` or
`*.spec.ts`.

## Testing Guidelines

Vitest covers unit and component behavior in `apps/desktop/tests` and
`packages/ui/tests`; Playwright e2e specs live in `apps/desktop/tests/e2e` and
UI visual specs in `packages/ui/tests/visual`. Add focused regression tests near
the affected feature, then widen to `pnpm test:unit`, `pnpm build`, and
`CI=1 pnpm test:e2e` for shared UI, routing, Electron, or startup changes.

## Commit & Pull Request Guidelines

History follows Conventional Commits, for example `fix: harden admin and
workspace flows`, `fix(ci): install playwright from desktop workspace`, and
`refactor(ui): simplify story refresh script`. PRs should describe the user
visible change, list verification commands run, link related issues, and include
screenshots for visible UI changes. Never commit secrets; keep local service
credentials in environment files ignored by Git.
