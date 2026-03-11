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
| Framework  | Tauri 2 (Rust) + Vite 7                |
| Frontend   | Vue 3 (Composition API) + TypeScript   |
| Styling    | Tailwind CSS v4 + shadcn-vue (reka-ui) |
| State      | Pinia + TanStack Query                 |
| Matrix SDK | matrix-js-sdk                          |
| Editor     | Tiptap 3                               |
| Testing    | Vitest + Playwright                    |
| i18n       | vue-i18n                               |

## Download

> Muon is in early development (v0.1.0). Pre-built binaries are not yet available.

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

# View logs
pnpm services:logs

# Stop services
pnpm services:down
```

### Available Scripts

| Command                   | Description                         |
| ------------------------- | ----------------------------------- |
| `pnpm dev`                | Start Vite dev server               |
| `pnpm tauri dev`          | Start Tauri desktop app (dev mode)  |
| `pnpm build`              | Type-check and build for production |
| `pnpm preview`            | Preview production build locally    |
| `pnpm lint`               | Run ESLint                          |
| `pnpm type-check`         | Run TypeScript type checking        |
| `pnpm test:unit`          | Run unit tests (Vitest)             |
| `pnpm test:unit:watch`    | Run unit tests in watch mode        |
| `pnpm test:unit:coverage` | Run unit tests with coverage report |
| `pnpm test:e2e`           | Run end-to-end tests (Playwright)   |
| `pnpm test`               | Run all tests                       |

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

- **CI** (`ci.yml`): Runs ESLint, TypeScript type checking, Vitest unit tests, and Playwright e2e tests on every push and PR.
- **Release** (`release.yml`): Triggered by `v*` tags. Builds cross-platform binaries (Linux, macOS x86_64/ARM, Windows) and creates a GitHub Release.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

[MIT](LICENSE) - see the [LICENSE](LICENSE) file for details.
