# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-06-01

### Added

- **Core chat**: real-time messaging with Matrix protocol, room list, message history, and DM support
- **Rich text editor**: Tiptap-based editor with mentions, images, code blocks, and emoji picker
- **End-to-end encryption**: Matrix E2EE support for secure private conversations
- **Voice/video calls**: LiveKit integration for real-time audio and video communication
- **Media messages**: image, video, and file upload/download with preview and gallery view
- **Unified inbox**: aggregated notifications with filtering and batch processing
- **Defer & tasks**: snooze messages and convert them into actionable tasks
- **Cross-conversation search**: full-text retrieval across all joined rooms
- **Knowledge capture**: offline digests, decision tracking, and cross-session Q&A
- **Desktop integration**: system tray, native notifications, auto-update, and settings panel
- **Internationalization**: English and Chinese language support (vue-i18n)
- **Dark/light theme**: theme switching with system preference detection
- **Local caching**: IndexedDB-based message cache via Dexie
- **Docker dev environment**: Conduit homeserver + LiveKit via Docker Compose
- **CI/CD pipeline**: ESLint, type checking, Vitest unit tests, Playwright e2e tests, and Codecov
- **Modern UI**: shadcn-vue (reka-ui) component library with Tailwind CSS v4

### Infrastructure

- Tauri 2 (Rust) + Vite 7 build system
- Vue 3 Composition API + TypeScript strict mode
- Pinia + TanStack Query state management
- Playwright e2e test suite
- GitHub Actions CI with multi-platform release workflow

[0.1.0]: https://github.com/kunish/muon/releases/tag/v0.1.0
