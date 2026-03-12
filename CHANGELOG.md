# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0](https://github.com/kunish/muon/compare/v0.1.0...v1.0.0) (2025-07-18)

### Features

* **core:** Matrix SDK integration — auth, sync, rooms, messages, typing, receipts, media ([00fe079](https://github.com/kunish/muon/commit/00fe079))
* **chat:** rich text editor, emoji picker, sticker packs, GIF search ([b4862e2](https://github.com/kunish/muon/commit/b4862e2))
* **chat:** file, image, audio, video message support with media viewer ([520d346](https://github.com/kunish/muon/commit/520d346))
* **chat:** message reactions, replies, forwarding, multi-select, thread panel ([b4ef1df](https://github.com/kunish/muon/commit/b4ef1df))
* **chat:** link preview, disappearing messages, message translation ([b4ef1df](https://github.com/kunish/muon/commit/b4ef1df))
* **calls:** audio/video calling with WebRTC ([ddb4707](https://github.com/kunish/muon/commit/ddb4707))
* **encryption:** end-to-end encryption and device verification ([b13ebb6](https://github.com/kunish/muon/commit/b13ebb6))
* **contacts:** contact management, group creation, group settings ([9e382f8](https://github.com/kunish/muon/commit/9e382f8))
* **server:** Discord-style server management — channels, categories, roles, members ([c64ff5c](https://github.com/kunish/muon/commit/c64ff5c))
* **desktop:** system tray, notifications, auto-update, screenshot ([e733037](https://github.com/kunish/muon/commit/e733037))
* **inbox:** unified inbox with aggregation, filtering, batch processing, and defer scheduling ([bc49642](https://github.com/kunish/muon/commit/bc49642), [fe07551](https://github.com/kunish/muon/commit/fe07551))
* **tasks:** message-to-task creation, status transitions, jump-to-source ([00f7289](https://github.com/kunish/muon/commit/00f7289), [9407cb3](https://github.com/kunish/muon/commit/9407cb3))
* **knowledge:** knowledge DB, offline digest, decision capture, cross-session QA ([baa0f77](https://github.com/kunish/muon/commit/baa0f77), [ad185b0](https://github.com/kunish/muon/commit/ad185b0), [0040228](https://github.com/kunish/muon/commit/0040228), [0af1c76](https://github.com/kunish/muon/commit/0af1c76))
* **search:** global cross-conversation retrieval with pagination ([e7a9ffd](https://github.com/kunish/muon/commit/e7a9ffd), [a38ee3d](https://github.com/kunish/muon/commit/a38ee3d))
* **user:** custom status and user blocking/unblocking ([c90b93c](https://github.com/kunish/muon/commit/c90b93c), [9c89052](https://github.com/kunish/muon/commit/9c89052))

### Bug Fixes

* **ux:** replace 24 silent console.error with toast.error() notifications across 19 components ([2670c0e](https://github.com/kunish/muon/commit/2670c0e))
* **ui:** message bubble text wrapping and dialog trigger issues ([75ce7fa](https://github.com/kunish/muon/commit/75ce7fa))
* **ui:** component consistency, broken animations, and design polish ([7a785bf](https://github.com/kunish/muon/commit/7a785bf))

### Code Quality

* extract shared utilities: isDirect, sanitizeMatrixHtml, isFullEmojiText, downloadMediaFile ([ebf8259](https://github.com/kunish/muon/commit/ebf8259), [a92e927](https://github.com/kunish/muon/commit/a92e927))
* add try/catch error handling to 21 unprotected async functions ([ebf8259](https://github.com/kunish/muon/commit/ebf8259))
* extend matrix-sdk.d.ts type declarations, eliminate 15+ `as any` casts ([ebf8259](https://github.com/kunish/muon/commit/ebf8259))
* change `event: any` props to `MatrixEvent` in 6 components ([ebf8259](https://github.com/kunish/muon/commit/ebf8259))
* complete i18n for 50+ hardcoded strings across 8 components ([ebf8259](https://github.com/kunish/muon/commit/ebf8259))
* remove hardcoded API key, add onUnmounted cleanup for timers ([ebf8259](https://github.com/kunish/muon/commit/ebf8259))

### CI/CD

* configure release-please for automated versioning and releases ([118bfd7](https://github.com/kunish/muon/commit/118bfd7))
* Tauri build matrix: Linux (x86_64), macOS (aarch64 + x86_64), Windows (x86_64)
* unit test suite: 33 suites, 122 tests with Vitest + MSW

## [0.1.0] (2025-06-01)

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

[1.0.0]: https://github.com/kunish/muon/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/kunish/muon/releases/tag/v0.1.0
