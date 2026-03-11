# Contributing to Muon

Thank you for your interest in contributing to Muon! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/muon.git`
3. Create a feature branch: `git checkout -b feat/my-feature`
4. Install dependencies: `pnpm install`
5. Make your changes
6. Run checks before committing:
   ```bash
   pnpm lint
   pnpm type-check
   pnpm test:unit
   ```

## Development Setup

See the [README](README.md#development) for prerequisites and setup instructions.

## Code Style

This project uses [@antfu/eslint-config](https://github.com/antfu/eslint-config) for linting. Run `pnpm lint` to check for issues — the config handles both linting and formatting.

Key conventions:

- **Vue**: Composition API with `<script setup lang="ts">`, single-file components
- **TypeScript**: Strict mode, prefer interfaces over type aliases for objects
- **Naming**: `camelCase` for variables/functions, `PascalCase` for components/types
- **Imports**: Auto-sorted by ESLint, no manual organization needed
- **i18n**: All user-facing strings go through `vue-i18n` — add keys to `src/locales/zh.json` and `src/locales/en.json`

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add room search functionality
fix: resolve message rendering issue
docs: update contributing guide
refactor: extract Matrix sync logic
test: add unit tests for auth module
chore: update dependencies
```

## Pull Request Process

1. Ensure your branch is up-to-date with `main`
2. Make sure all checks pass (`pnpm lint && pnpm type-check && pnpm test:unit`)
3. Write a clear PR description explaining what and why
4. Link any related issues
5. Request a review

## Reporting Bugs

Please use the [Bug Report](https://github.com/kunish/muon/issues/new?template=bug_report.yml) issue template. Include:

- Steps to reproduce
- Expected vs actual behavior
- OS and app version
- Screenshots if applicable

## Requesting Features

Use the [Feature Request](https://github.com/kunish/muon/issues/new?template=feature_request.yml) issue template.

## Project Architecture

```text
src/
├── app/          # App shell: router, layouts, global providers
├── features/     # Feature modules (each with its own components, composables, stores)
├── matrix/       # Matrix SDK integration: client, sync, auth, room operations
├── shared/       # Shared UI components (shadcn-vue based), utils, composables
├── locales/      # i18n JSON files (en.json, zh.json)
└── tauri/        # Tauri plugin wrappers (HTTP, filesystem, notifications)
```

The Matrix integration layer (`src/matrix/`) is the bridge between the Vue frontend and `matrix-js-sdk`. It handles authentication, sync state, room management, and event processing.

## License

By contributing to Muon, you agree that your contributions will be licensed under the [MIT License](LICENSE).
