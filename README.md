<div align="center">

<img src="public/muon-logo.svg" alt="Muon logo" width="96" height="96" />

# Muon

A modern [Matrix](https://matrix.org) chat client built with [Electron](https://www.electronjs.org), [electron-vite](https://electron-vite.org), and [Vue 3](https://vuejs.org).

[![CI](https://github.com/kunish/muon/actions/workflows/ci.yml/badge.svg)](https://github.com/kunish/muon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Features](#features) | [Download](#download) | [Development](#development) | [Contributing](#contributing)

</div>

## Features

- Native desktop shell via Electron with an isolated preload bridge
- Feishu-style workspace shell with Messages, Contacts, and Settings apps
- Matrix direct messages, groups, and server/channel conversations
- End-to-end encryption support (via Matrix protocol)
- Rich text editor with mentions, images, and code blocks (Tiptap)
- Voice channel support via LiveKit integration
- Internationalization (English & Chinese)
- Modern UI with dark/light theme support
- Local message caching with IndexedDB (Dexie)
- Auto-update support

## Tech Stack

| Layer      | Technology                             |
| ---------- | -------------------------------------- |
| Framework  | Electron + electron-vite + Vite 8      |
| Frontend   | Vue 3 (Composition API) + TypeScript   |
| Styling    | Tailwind CSS v4 + shadcn-vue (reka-ui) |
| State      | Pinia + TanStack Query                 |
| Matrix SDK | matrix-js-sdk                          |
| Editor     | Tiptap 3                               |
| Testing    | Vitest + Playwright                    |
| i18n       | vue-i18n                               |

## Brand Assets

- Primary logo source: `public/muon-logo.svg`
- Web favicon: `index.html` points to the primary SVG logo
- Workspace rail brand mark: `src/app/components/workspace/WorkspaceAppRail.vue`
- Window title bar brand mark: `src/app/components/window/WindowTitleBar.vue`
- Electron platform icons: `build/icons/`

## Download

> Muon is under active development. Version-tagged builds are published through the build workflow.

To try it out, follow the [Development](#development) instructions below to build from source.

## Development

### Prerequisites

- [Node.js](https://nodejs.org) >= 22
- [pnpm](https://pnpm.io) >= 10

### Quick Start

```bash
# Clone the repository
git clone https://github.com/kunish/muon.git
cd muon

# Install dependencies
pnpm install

# Start local infrastructure and every code project in development mode
pnpm dev

# Or start one project explicitly
pnpm dev:desktop
pnpm dev:api      # requires Postgres from pnpm services:up
pnpm dev:admin
pnpm dev:web      # renderer-only server used by Playwright
```

### Local Matrix Homeserver

A Docker Compose setup is provided for local development infrastructure:

```bash
# Start Postgres + Conduit + LiveKit + MinIO
pnpm services:up

# Re-run the local mock data seed manually
pnpm services:seed

# View logs
pnpm services:logs

# Stop services
pnpm services:down
```

`pnpm services:up` seeds Conduit with local mock data after the services are
ready. The default owner account is `@kunish:localhost` with password
`test1234` for new local volumes; existing local volumes with a previous
`@kunish:localhost` password are still supported. Mock users also use
`test1234`. To skip seeding, run `MUON_SKIP_SEED=1 pnpm services:up`; to create
a fresh data set for the current seed version, run
`pnpm services:seed -- --force`.

### Enterprise Admin And Desktop SSO

Muon includes an in-repo enterprise foundation for self-hosted organization
management and desktop SSO:

- API service: `apps/api`
- Admin Web console: `apps/admin`
- Shared API contracts: `packages/enterprise-contracts`
- Admin URL: `http://127.0.0.1:4174`
- API URL: `http://127.0.0.1:8787`

`pnpm dev` prepares this infrastructure automatically. To manage it manually:

```bash
pnpm services:up
```

Then open the Admin Web console and complete the first-run install wizard. The
wizard creates the first organization and owner account. Users are created
manually by an owner or admin with an initial password. After installation,
signed-in owners and admins can create additional organizations from the
organization management panel; each new organization gets its own owner account.

For desktop SSO development, start every code project with the API URL configured:

```bash
VITE_MUON_API_BASE_URL=http://127.0.0.1:8787 pnpm dev
```

The login page will show `企业登录`. Clicking it opens the browser-based Muon
login page. After successful login, the API redirects to
`muon://auth/callback`, the Electron main process forwards the callback to the
renderer, and the renderer exchanges the one-time code for a Muon session plus a
Matrix session.

Run enterprise-focused tests:

```bash
pnpm test:enterprise
```

### Available Scripts

All human-facing commands are exposed from the repository root. `pnpm dev` and
`pnpm build` target the whole monorepo; use suffixed commands only when you need
one project. Workspace packages keep small `dev`/`build`/`test` scripts for
`pnpm --filter`, but day to day usage should stay on the root commands below.

| Command                   | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `pnpm dev`                | Start desktop, API, and Admin projects             |
| `pnpm dev:desktop`        | Start Electron desktop app in dev mode             |
| `pnpm dev:web`            | Start Vite dev server for renderer only            |
| `pnpm dev:api`            | Start the enterprise API service                   |
| `pnpm dev:admin`          | Start the Admin Web console                        |
| `pnpm build`              | Build every monorepo project                       |
| `pnpm build:contracts`    | Type-check shared enterprise contracts             |
| `pnpm build:api`          | Type-check the enterprise API service              |
| `pnpm build:desktop`      | Type-check and build Electron app                  |
| `pnpm build:web`          | Type-check and build renderer only                 |
| `pnpm build:admin`        | Build the Admin Web console                        |
| `pnpm preview`            | Preview Electron production build locally          |
| `pnpm package`            | Build unpacked Electron package                    |
| `pnpm dist`               | Build distributable Electron package               |
| `pnpm check`              | Run lint, type-check, unit tests, web/admin builds |
| `pnpm lint`               | Run ESLint                                         |
| `pnpm type-check`         | Run TypeScript type checking                       |
| `pnpm test`               | Run unit and e2e tests                             |
| `pnpm test:unit`          | Run unit tests (Vitest)                            |
| `pnpm test:unit:watch`    | Run unit tests in watch mode                       |
| `pnpm test:unit:coverage` | Run unit tests with coverage report                |
| `pnpm test:e2e`           | Run end-to-end tests (Playwright)                  |
| `pnpm test:enterprise`    | Run enterprise API/Admin/login tests               |
| `pnpm services:up`        | Start local infrastructure and seed data           |
| `pnpm services:seed`      | Seed local Conduit mock data                       |
| `pnpm services:logs`      | Tail local service logs                            |
| `pnpm services:down`      | Stop local services                                |

`pnpm test:e2e` runs browser-compatible Playwright tests by default. Runtime-backed settings tests require `ELECTRON_E2E=1`, Electron runtime access, Matrix homeserver services, and session env vars: `E2E_MATRIX_SERVER_URL`, `E2E_MATRIX_USER_ID`, `E2E_MATRIX_ACCESS_TOKEN`, and `E2E_MATRIX_DEVICE_ID`.

### Project Structure

```text
muon/
├── apps/                 # Enterprise API and Admin Web apps
├── packages/             # Shared workspace packages
├── public/              # Static web assets, including the Muon logo
├── electron/            # Electron main and preload sources
├── build/icons/         # Electron package icons
├── src/                  # Vue frontend source
│   ├── app/              # App shell, router, layouts
│   ├── features/         # Feature modules (chat, auth, etc.)
│   ├── matrix/           # Matrix SDK integration layer
│   ├── shared/           # Shared components, utils, composables
│   ├── electron/         # Renderer-side desktop bridge adapters
│   └── locales/          # i18n translation files
├── tests/
│   ├── unit/             # Vitest unit tests
│   └── e2e/              # Playwright e2e tests
├── docker/               # Local dev homeserver (Conduit + LiveKit)
└── .github/workflows/    # CI + release pipelines
```

## CI/CD

- **CI** (`ci.yml`): Runs ESLint, TypeScript type checking, Vitest unit tests, Playwright e2e tests, and an Electron production build on pushes to `main`/`develop` and PRs targeting `main`.
- **Build** (`build.yml`): Triggered by `v*` tags. Builds cross-platform Electron packages (Linux, macOS x86_64/ARM, Windows) and publishes GitHub Release assets.
- **Release** (`release.yml`): Runs Release Please on `main` to prepare version bumps and release PRs.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

[MIT](LICENSE) - see the [LICENSE](LICENSE) file for details.
