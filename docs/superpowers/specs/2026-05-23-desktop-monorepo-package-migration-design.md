# Desktop Monorepo Package Migration Design

**Date:** 2026-05-23
**Status:** Approved design, awaiting written-spec review
**Author / brainstorm partner:** shikun + Codex
**Decision:** Move the complete desktop app into `apps/desktop` as `@muon/desktop`, keep root commands stable, and perform only boundary-focused architecture cleanup.

## Goal

Move Muon's Electron desktop app out of the workspace root and into a dedicated monorepo app package at `apps/desktop`. The migration should make the root package a workspace orchestration layer while preserving existing developer command semantics and desktop app behavior.

This is a structural migration, not a product behavior change. **MatrixSession**, **MuonSession**, **EnterpriseSession**, **SignIn**, **SignOut**, room projection, message projection, chat, media, settings, and enterprise auth behavior must stay unchanged.

## Current State

The workspace already has monorepo structure:

- `apps/api` is the enterprise API package.
- `apps/admin` is the Admin Web package.
- `packages/enterprise-contracts`, `packages/rich-text`, and `packages/ui` are workspace packages.
- `pnpm-workspace.yaml` already includes `apps/*` and `packages/*`.

The desktop app still lives mostly at the root:

- `src/` contains the Vue renderer app, Matrix integration, features, shared code, and renderer-side Electron bridge wrappers.
- `electron/` contains the Electron main process, preload, and enterprise auth callback helper.
- `index.html`, `vite.config.ts`, `electron.vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, and `tsconfig.electron.json` are root-level desktop configs.
- Root `package.json` owns desktop dependencies, Electron scripts, `electron-builder` config, and monorepo orchestration scripts.
- Root `tests/` contains desktop unit, component, and Playwright tests.

## Target Architecture

`apps/desktop` becomes the full desktop app package:

```text
muon/
├── apps/
│   ├── api/
│   ├── admin/
│   └── desktop/
│       ├── electron/
│       ├── src/
│       ├── tests/
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       ├── electron.vite.config.ts
│       ├── vitest.config.ts
│       ├── playwright.config.ts
│       ├── tsconfig.json
│       └── tsconfig.electron.json
├── packages/
├── build/icons/
├── public/
├── docs/
└── package.json
```

The package name is `@muon/desktop`. It owns:

- Electron main/preload sources.
- Vue renderer sources.
- Desktop Vite, electron-vite, Vitest, Playwright, and TypeScript configs.
- Desktop unit, component, and e2e tests.
- Desktop app dependencies and dev dependencies.
- `electron-builder` packaging config.

The root package owns only workspace orchestration scripts, repository metadata, and shared developer tooling that genuinely applies to multiple packages.

## Boundary Cleanup

As part of the move, rename renderer-side Electron bridge wrappers from `src/electron/*` to `src/desktop/*` inside `apps/desktop`.

This makes application code depend on desktop capabilities rather than the Electron implementation name. The renderer-facing preload contract remains `window.muonDesktop`, and no Electron main/preload API behavior changes as part of this migration.

Do not rename `apps/desktop/electron/` during this work. That directory contains runtime-specific Electron main/preload code, so the name is accurate there.

## Package And Script Design

Root commands remain stable and proxy into the desktop package where appropriate:

```json
{
  "scripts": {
    "dev": "bash scripts/dev-all.sh",
    "dev:desktop": "pnpm --filter @muon/desktop dev",
    "build": "pnpm build:contracts && pnpm build:rich-text && pnpm build:api && pnpm build:admin && pnpm build:desktop",
    "build:desktop": "pnpm --filter @muon/desktop build",
    "build:web": "pnpm --filter @muon/desktop build:web",
    "check": "pnpm lint && pnpm test:unit && pnpm build",
    "lint": "eslint .",
    "preview": "pnpm --filter @muon/desktop preview",
    "package": "pnpm --filter @muon/desktop package",
    "dist": "pnpm --filter @muon/desktop dist",
    "type-check": "pnpm --filter @muon/desktop type-check",
    "test:unit": "pnpm --filter @muon/desktop test:unit",
    "test:unit:coverage": "pnpm --filter @muon/desktop test:unit:coverage",
    "test:e2e": "pnpm --filter @muon/desktop test:e2e"
  }
}
```

`apps/desktop/package.json` receives the current desktop app metadata and dependencies. It depends on workspace packages with `workspace:*` ranges:

```json
{
  "name": "@muon/desktop",
  "private": true,
  "dependencies": {
    "@muon/enterprise-contracts": "workspace:*",
    "@muon/rich-text": "workspace:*",
    "@muon/ui": "workspace:*"
  }
}
```

`scripts/dev-all.sh` should start the desktop app through `pnpm --filter @muon/desktop`, not by invoking root-level `electron-vite` directly.

## Path And Config Design

`apps/desktop` is the config root for desktop tooling.

`apps/desktop/electron.vite.config.ts` uses `apps/desktop` as `__dirname`:

- Main entry: `electron/main.ts`.
- Preload entry: `electron/preload.ts`.
- Renderer entry: `index.html`.
- Renderer i18n include: `src/locales/**`.
- Renderer alias roots: `src`, `src/features`, `src/matrix`, `src/shared`.

`apps/desktop/vite.config.ts` and `apps/desktop/vitest.config.ts` use desktop-package-relative aliases:

```ts
'@': resolve(__dirname, 'src')
'@features': resolve(__dirname, 'src/features')
'@shared': resolve(__dirname, 'src/shared')
'@matrix': resolve(__dirname, 'src/matrix')
```

Workspace package aliases point back to the repository root where direct source aliases are still required:

```ts
'@muon/enterprise-contracts': resolve(__dirname, '../../packages/enterprise-contracts/src/index.ts')
'@muon/rich-text': resolve(__dirname, '../../packages/rich-text/src/index.ts')
```

Prefer package exports for `@muon/ui` unless a concrete test or build path requires an explicit alias.

`apps/desktop/index.html` keeps the same renderer entry script:

```html
<script type="module" src="/src/app/main.ts"></script>
```

This works because Vite's root is `apps/desktop`.

## TypeScript Design

`apps/desktop/tsconfig.json` owns renderer and test type checking for the desktop package:

- Include `src/**/*.ts` and `src/**/*.vue`. The existing test suite is executed by Vitest; it is not part of the desktop `vue-tsc` gate because the pre-migration root `pnpm type-check` did not type-check tests.
- Define path aliases relative to `apps/desktop`.
- Keep workspace package source aliases for packages that are consumed directly by source path.

`apps/desktop/tsconfig.electron.json` owns Electron main/preload type checking:

- Include `electron/**/*.ts` and `electron.vite.config.ts`.
- Use Node-compatible module settings matching the current Electron config.

The root `tsconfig.json` should stop pretending the root is the desktop app. It should become an editor-oriented workspace file with no root `@`, `@features`, `@shared`, or `@matrix` aliases. Command-line desktop type checking runs from `apps/desktop/tsconfig.json` through `pnpm --filter @muon/desktop type-check`.

## Static Assets And Packaging

Keep shared brand and packaging assets at the workspace root for this migration:

- `public/`
- `build/icons/`

Desktop Vite and Electron Builder reference these assets with paths relative to `apps/desktop`, such as `../../public` and `../../build/icons/icon.icns`.

Rationale: these are brand/release assets, not feature code. Keeping them at the workspace root avoids duplicating assets and preserves the option for Admin Web or future apps to reuse them.

If Electron Builder requires package-local icon paths during verification, use the smallest packaging-compatible adjustment and document it in the implementation plan before changing the asset ownership model.

## Tests

Move desktop tests into `apps/desktop/tests`:

- Electron security, icon, desktop bridge, and window tests: `apps/desktop/tests/unit`.
- Vue component tests: `apps/desktop/tests/components`.
- Playwright specs: `apps/desktop/tests/e2e`.
- Test setup: `apps/desktop/tests/setup.ts`.

Source-reading tests must not assume `process.cwd()` is the repository root. They should read from the desktop package root, with explicit helpers for repository-root assets when needed.

Coverage includes should change from root `src/**/*.{ts,vue}` to desktop package source paths, such as `src/**/*.{ts,vue}` when run from `apps/desktop` or `apps/desktop/src/**/*.{ts,vue}` when run from the repository root.

## CI And Verification

Existing CI jobs can continue to call root commands. Root commands proxy to the desktop package where needed.

Migration verification:

```bash
pnpm type-check
pnpm test:unit
pnpm build:desktop
```

Regression verification:

```bash
pnpm lint
pnpm build
```

Run `pnpm test:e2e` if the moved Playwright config or desktop route behavior changes beyond path relocation.

## Migration Steps

1. Create `apps/desktop/package.json` and desktop configs.
2. Move `src/`, `electron/`, `index.html`, desktop configs, and desktop tests into `apps/desktop`.
3. Update aliases, TypeScript includes, Vite roots, electron-vite entries, i18n includes, Vitest roots, and Playwright roots.
4. Rename renderer bridge wrappers from `src/electron/*` to `src/desktop/*` and update imports.
5. Move `electron-builder` config into `apps/desktop/package.json` and fix `main`, `files`, icon, and output paths.
6. Reduce root `package.json` to workspace orchestration and update `scripts/dev-all.sh`.
7. Update README project structure and command descriptions.
8. Update source-reading tests to use package-root helpers.
9. Run focused desktop verification, then full workspace lint/build verification.

## Guardrails

- Do not change Matrix SDK integration behavior.
- Do not change **MatrixSession**, **MuonSession**, **DeviceSession**, **EnterpriseSession**, **SignIn**, **SignOut**, **Bootstrap**, or **PkceTransientState** behavior.
- Do not change **Message** or **RoomSummary** projections.
- Do not perform Electron-to-Electrobun runtime migration in this work.
- Do not delete or revert unrelated dirty worktree changes.
- Preserve root command semantics.
- Keep `window.muonDesktop` as the renderer-facing desktop bridge contract.
- Prefer minimal config changes over broad tooling rewrites.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Path churn breaks aliases or source-reading tests | Centralize package-root helpers in tests and run focused type/unit verification after moving files. |
| Electron Builder expects package-local assets | First reference root assets by relative path; only change asset ownership if packaging verification proves it necessary. |
| Root package accidentally keeps desktop dependencies | Move desktop-only dependencies to `@muon/desktop` and keep root dependencies only when used by root scripts/tooling. |
| CI appears unchanged but coverage paths go stale | Update Vitest coverage include/exclude paths and verify `pnpm test:unit:coverage` if coverage is part of the implementation scope. |
| Architecture cleanup grows beyond migration | Limit cleanup to `src/electron/*` -> `src/desktop/*`; do not refactor desktop bridge behavior or feature code internals. |

## Non-Goals

- Replacing Electron with Electrobun.
- Rewriting desktop bridge IPC.
- Changing app UI, routing, chat, media, docs, settings, or enterprise auth behavior.
- Splitting Matrix, feature, or shared renderer modules into separate packages.
- Moving `apps/api`, `apps/admin`, or workspace packages.
