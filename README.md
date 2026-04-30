<div align="center">

# Muon

A modern, fast [Matrix](https://matrix.org) chat client built with [Tauri](https://tauri.app) + [Vue 3](https://vuejs.org).

[![CI](https://github.com/kunish/muon/actions/workflows/ci.yml/badge.svg)](https://github.com/kunish/muon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Features](#features) | [Download](#download) | [Development](#development) | [Contributing](#contributing)

</div>

## Features

- Native desktop performance via Tauri (Rust backend)
- End-to-end encryption support (via Matrix protocol)
- Rich text editor with mentions, images, and code blocks (Tiptap)
- Voice/video calls via LiveKit integration
- Internationalization (English & Chinese)
- Modern UI with dark/light theme support
- Local message caching with IndexedDB (Dexie)
- Auto-update support

## Tech Stack

| Layer      | Technology                             |
| ---------- | -------------------------------------- |
| Framework  | Tauri 2 (Rust) + Vite 8                |
| Frontend   | Vue 3 (Composition API) + TypeScript   |
| Styling    | Tailwind CSS v4 + shadcn-vue (reka-ui) |
| State      | Pinia + TanStack Query                 |
| Matrix SDK | matrix-js-sdk                          |
| Editor     | Tiptap 3                               |
| Testing    | Vitest + Playwright                    |
| i18n       | vue-i18n                               |

## Download

> Muon is under active development. Version-tagged builds are published through the build workflow.

To try it out, follow the [Development](#development) instructions below to build from source.

## Development

### Prerequisites

- [Node.js](https://nodejs.org) >= 22
- [pnpm](https://pnpm.io) >= 10
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- Tauri [system dependencies](https://v2.tauri.app/start/prerequisites/)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/kunish/muon.git
cd muon

# Install dependencies
pnpm install

# Start the web dev server (without Tauri shell)
pnpm dev

# Or start the full Tauri desktop app
pnpm tauri dev
```

### Local Matrix Homeserver

A Docker Compose setup is provided for local development with a [Conduit](https://conduit.rs) homeserver:

```bash
# Start Conduit + LiveKit services
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

### Available Scripts

| Command                   | Description                         |
| ------------------------- | ----------------------------------- |
| `pnpm dev`                | Start Vite dev server               |
| `pnpm tauri dev`          | Start Tauri desktop app (dev mode)  |
| `pnpm build`              | Type-check and build for production |
| `pnpm preview`            | Preview production build locally    |
| `pnpm lint`               | Run ESLint                          |
| `pnpm services:up`        | Start local services and seed data  |
| `pnpm services:seed`      | Seed local Conduit mock data        |
| `pnpm services:logs`      | Tail local service logs             |
| `pnpm services:down`      | Stop local services                 |
| `pnpm type-check`         | Run TypeScript type checking        |
| `pnpm test:unit`          | Run unit tests (Vitest)             |
| `pnpm test:unit:watch`    | Run unit tests in watch mode        |
| `pnpm test:unit:coverage` | Run unit tests with coverage report |
| `pnpm test:e2e`           | Run end-to-end tests (Playwright)   |
| `pnpm test`               | Run all tests                       |

`pnpm test:e2e` runs browser-compatible Playwright tests by default. Tauri-specific settings tests require `TAURI_E2E=1`, Tauri runtime access, Matrix homeserver services, and session env vars: `E2E_MATRIX_SERVER_URL`, `E2E_MATRIX_USER_ID`, `E2E_MATRIX_ACCESS_TOKEN`, and `E2E_MATRIX_DEVICE_ID`.

### Project Structure

```text
muon/
├── src/                  # Vue frontend source
│   ├── app/              # App shell, router, layouts
│   ├── features/         # Feature modules (chat, auth, etc.)
│   ├── matrix/           # Matrix SDK integration layer
│   ├── shared/           # Shared components, utils, composables
│   ├── locales/          # i18n translation files
│   └── tauri/            # Tauri API wrappers
├── src-tauri/            # Rust backend (Tauri)
├── tests/
│   ├── unit/             # Vitest unit tests
│   └── e2e/              # Playwright e2e tests
├── docker/               # Local dev homeserver (Conduit + LiveKit)
└── .github/workflows/    # CI + release pipelines
```

## CI/CD

- **CI** (`ci.yml`): Runs Rust/Tauri formatting, linting, checking, and tests alongside ESLint, TypeScript type checking, Vitest unit tests, and Playwright e2e tests on pushes to `main`/`develop` and PRs targeting `main`.
- **Build** (`build.yml`): Triggered by `v*` tags. Builds cross-platform Tauri binaries (Linux, macOS x86_64/ARM, Windows) and creates a GitHub Release.
- **Release** (`release.yml`): Runs Release Please on `main` to prepare version bumps and release PRs.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

[MIT](LICENSE) - see the [LICENSE](LICENSE) file for details.
