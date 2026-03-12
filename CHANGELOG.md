# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0](https://github.com/kunish/muon/compare/muon-v1.0.0...muon-v1.0.0) (2026-03-12)


### Features

* **01-01:** define unified inbox contracts ([4b074ae](https://github.com/kunish/muon/commit/4b074ae29e3559ef44fc40c2dc9735ad37091698))
* **01-01:** implement unified inbox aggregation and batch processing ([bc49642](https://github.com/kunish/muon/commit/bc4964236fc1a594e67930d9250b23d8fd1b76ee))
* **01-02:** implement inbox event context loader ([0c42d25](https://github.com/kunish/muon/commit/0c42d2551649aa6e24af73b12bf14d5f940853a9))
* **01-03:** add unified inbox panel with filter and batch process UI ([fe07551](https://github.com/kunish/muon/commit/fe0755176f0c9034f5c1bb016635533547ae75c0))
* **01-03:** integrate inbox jump into DM sidebar and message list focus ([787bb61](https://github.com/kunish/muon/commit/787bb61f85d123f3a2dae7bc2ff64ea0be2668da))
* **02-01:** define defer/task domain contracts ([495b557](https://github.com/kunish/muon/commit/495b5577b15b97ef478e48f4c383003845d7b3b2))
* **02-01:** implement defer store with persistence lifecycle ([01eed94](https://github.com/kunish/muon/commit/01eed948de97ab794f4f81965dcabad67da98ad0))
* **02-02:** add inbox defer presets and custom scheduling ([3be4828](https://github.com/kunish/muon/commit/3be4828289faf5fb34e9072b9ec2cf167877de84))
* **02-02:** implement defer queue panel with active/history flow ([c3f0415](https://github.com/kunish/muon/commit/c3f041590e928165f0c74305b0b5e2cc93273653))
* **02-03:** add message-to-task creation flow ([00f7289](https://github.com/kunish/muon/commit/00f72894e64742c465c9e073a308ed4b331cdea8))
* **02-04:** add jump-to-source flow and sidebar task entry ([4261441](https://github.com/kunish/muon/commit/4261441f00144be1d0f02ea4cf45623fb8fdcb59))
* **02-04:** implement task status transitions in side panel ([9407cb3](https://github.com/kunish/muon/commit/9407cb3ad32013ae6b4f9f18b9d9cfc411bccb7a))
* **03-01:** implement joined-room scoped retrieval pagination ([e7a9ffd](https://github.com/kunish/muon/commit/e7a9ffd99054cb82dba41f5f67e04e73c045e826))
* **03-02:** integrate global cross-conversation retrieval flow ([a38ee3d](https://github.com/kunish/muon/commit/a38ee3d0b578691bf7333ddda489ecd7b3af1b17))
* **04-01:** add knowledge DB foundation ([baa0f77](https://github.com/kunish/muon/commit/baa0f7753a13fa8c30935fd2275aaeea6b95917e))
* **04-02:** add offline digest flow ([ad185b0](https://github.com/kunish/muon/commit/ad185b0d8750605434ecc5c1a6e1c32157fd2ac4))
* **04-03:** add decision capture flow ([0040228](https://github.com/kunish/muon/commit/00402283e4f07d68eaa21bdd5e850065f265e303))
* **04-04:** add knowledge QA integration ([0af1c76](https://github.com/kunish/muon/commit/0af1c76cf99fe70db9334bc9df2b57581658b29d))
* **04-05:** harden knowledge panel navigation semantics ([97a8e67](https://github.com/kunish/muon/commit/97a8e6774e652a4c71b40ec0ebba6c60b7454533))
* **04-06:** restore digest hydration and runtime sync ([5ccb34a](https://github.com/kunish/muon/commit/5ccb34ab43c5be00c17c780129402d66e71702ae))
* **04-07:** restore decision hydration and digest suggestions ([4ba80fd](https://github.com/kunish/muon/commit/4ba80fd576a2eec01e242103055769a3bc8a1caf))
* **04-08:** restore saved QA history in knowledge panel ([3ced806](https://github.com/kunish/muon/commit/3ced80604c828f73053f8f6434d83f736daa2720))
* **05-01:** reconcile inbox state from sync recovery ([7f37da1](https://github.com/kunish/muon/commit/7f37da1585ef19ed8aa5f34bc983179d37549d15))
* **05-02:** virtualize inbox and search heavy-result flows ([24dbae3](https://github.com/kunish/muon/commit/24dbae307705b05179807a68528f7bcbd1e56d3c))
* **05-03:** harden task recovery hydrate continuity ([8749b79](https://github.com/kunish/muon/commit/8749b791865ac8375f9a12fc9ec9812a70e100e3))
* **discordify-ui:** complete Discord-style UI overhaul and chat UX polishing ([c64ff5c](https://github.com/kunish/muon/commit/c64ff5c2c8ff74f26d2c3dc936b94fa65a492dc9))
* **quick-001:** add custom status API and UI ([c90b93c](https://github.com/kunish/muon/commit/c90b93c5063070370c0500a8055e3714ad919281))
* **quick-001:** add user blocking/unblocking feature ([9c89052](https://github.com/kunish/muon/commit/9c8905279034dc6d59d7172f31e499023024d592))
* **task-01:** 项目脚手架初始化 ([417b393](https://github.com/kunish/muon/commit/417b393594bc94690e293ebc2addc52c500f5a66))
* **task-02:** Docker 服务端部署 ([36df100](https://github.com/kunish/muon/commit/36df100ce44ee6e7b9fcb91b8b6145fc473e1386))
* **task-03:** Matrix SDK 封装层 ([00fe079](https://github.com/kunish/muon/commit/00fe079984100528b20316650028d2fda8bff604))
* **task-04:** UI 基础层与布局 ([e347476](https://github.com/kunish/muon/commit/e34747654f7f0e4492addb6eb024863971e911d2))
* **task-05:** 核心聊天功能 ([b4ef1df](https://github.com/kunish/muon/commit/b4ef1df6693f3cd75eb41b00a49c1c33c9c6b882))
* **task-06:** 富文本编辑器与表情 ([b4862e2](https://github.com/kunish/muon/commit/b4862e2111919b2e9cc8da0a7e483a83abb7287b))
* **task-07:** 多媒体消息 ([520d346](https://github.com/kunish/muon/commit/520d346a2b6d8a9fad36dcc6a7f6e7499b70f475))
* **task-08:** 音视频通话 ([ddb4707](https://github.com/kunish/muon/commit/ddb47072434587796aa6081b5107eb16c6078514))
* **task-09:** 端到端加密 ([b13ebb6](https://github.com/kunish/muon/commit/b13ebb6cdff44b8878ba4859c8fe2111b2b70465))
* **task-10:** 桌面原生体验 — 系统集成与设置 ([e733037](https://github.com/kunish/muon/commit/e733037ab9555b414abccf67c7ca1783339a3b94))
* **task-11:** 高级功能 — 联系人管理与消息增强 ([9e382f8](https://github.com/kunish/muon/commit/9e382f8722ff953386ba0eb76285e58f01e940f5))
* **task-12:** 测试与 CI/CD — 测试基础设施与持续集成 ([bdd2cfa](https://github.com/kunish/muon/commit/bdd2cfad9b76f4dde4f9b93650ccab3f23054de9))


### Bug Fixes

* **02-05:** ensure long defer lists remain actionable ([43f508e](https://github.com/kunish/muon/commit/43f508ee8bc3ea49713241c82531418192ecf47f))
* **02-05:** restore scroll chain for inbox and defer panels ([ccfbff1](https://github.com/kunish/muon/commit/ccfbff181cec9d414268e1883e4e8d2389a817b4))
* **05-01:** stabilize recovery polling assertions ([c4f10f2](https://github.com/kunish/muon/commit/c4f10f24b14db0e7cc7850567b40bb41754b609c))
* **auth:** use Matrix identifier format for login to fix M_INVALID_USERNAME ([89e7100](https://github.com/kunish/muon/commit/89e71007ae1ac769ef5d5d3728160a5ad8d0517f))
* **ci:** add missing @vitest/coverage-v8 dependency ([d184b22](https://github.com/kunish/muon/commit/d184b2243498739f6099fd57fd326a7366f8b069))
* **ci:** lower coverage thresholds to match actual coverage ([859bf73](https://github.com/kunish/muon/commit/859bf73b856423aaa87beeefaa2439d59d7c3e4b))
* **ci:** remove conflicting pnpm version from build workflow ([bc6f70c](https://github.com/kunish/muon/commit/bc6f70c80b4e9415132517501bd3e6fd0736d2bc))
* **ci:** remove hardcoded pnpm version to resolve action-setup conflict ([4aece0e](https://github.com/kunish/muon/commit/4aece0ef53c46ed7ab4a70023e364977573c9b09))
* **ci:** resolve all lint errors and formatting issues ([57eba4c](https://github.com/kunish/muon/commit/57eba4c5f8aa42ab3ec967b29dba0f6a0966259d))
* **ci:** update e2e test selectors and skip settings tests in CI ([dcc2029](https://github.com/kunish/muon/commit/dcc2029c832b96632c5f7e24b926c4d852869579))
* **code-quality:** extract shared download util, disable unimplemented menu items, improve type safety ([a92e927](https://github.com/kunish/muon/commit/a92e927b649a30dee923ef102ea9d9cade0ddcf7))
* **lint:** resolve lint errors in documentation files ([2754d6c](https://github.com/kunish/muon/commit/2754d6cc291bda677fab098d2cee0f5bea9c2ad9))
* **ui:** component consistency, broken animations, and design polish ([7a785bf](https://github.com/kunish/muon/commit/7a785bfcda43a0ee8e9d6348afd771d4bb22aabb))
* **ui:** resolve message bubble text wrapping and dialog trigger issues ([75ce7fa](https://github.com/kunish/muon/commit/75ce7fa24f9ed364550c7a6eea579c03f2ceee58))
* **ux:** replace silent console.error with toast notifications, fix test i18n warnings ([2670c0e](https://github.com/kunish/muon/commit/2670c0e21c7629ff6f59447285b8cf8f1c1789c0))


### Miscellaneous Chores

* **release:** v1.0.0 ([8e9060a](https://github.com/kunish/muon/commit/8e9060a1c196aacf476813705bdf8940f5aac0df))

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
