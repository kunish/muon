# Muon Optimization Roadmap

> Generated: 2026-04-04 | Agent Team: code-reviewer, perf-analyzer, test-analyst, security-auditor

## Executive Summary

4 specialist agents conducted a full audit of the Muon codebase covering code quality, performance, testing, and security. Key findings:

- **3 CRITICAL security issues** — disabled CSP, plaintext token storage, wildcard HTTP scope
- **3 CRITICAL performance issues** — no message list virtualization, matrix-js-sdk not tree-shaken, deep reactive proxying of SDK objects
- **~80% of composables and ~73% of matrix layer untested**
- **25+ catch blocks showing wrong error messages** to users

The roadmap is organized into 5 phases by priority. Phase 0 (Security) should block any public release.

---

## Phase 0: Security Critical (Block Release)

These issues create a chain: **disabled CSP + plaintext token = single XSS → full account takeover**.

### 0.1 Enable Content Security Policy

- **File:** `src-tauri/tauri.conf.json:27`
- **Issue:** `"csp": null` — CSP is completely disabled
- **Fix:** Set strict CSP: `"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; connect-src 'self' https: wss:; font-src 'self'"`

### 0.2 Move Access Token to Secure Storage

- **File:** `src/matrix/auth.ts:13-14`
- **Issue:** `accessToken` stored in plaintext `localStorage`
- **Fix:** Use `tauri-plugin-store` with encryption or OS keychain. Never store tokens in browser-accessible storage.

### 0.3 Restrict HTTP Plugin Scope

- **File:** `src-tauri/capabilities/default.json:14-19`
- **Issue:** Wildcard `http://*:*`, `https://*:*` allows requests to any URL (SSRF risk)
- **Fix:** Restrict to Matrix homeserver patterns. Block private IP ranges and cloud metadata endpoints (`169.254.169.254`).

### 0.4 Fix XSS in Message Forwarding

- **File:** `src/matrix/messages.ts:542-553`
- **Issue:** `forwardMessages()` interpolates unsanitized user content into HTML (`${sender}`, `${body}`)
- **Fix:** HTML-escape both `sender` and `body` before interpolation, or run through `sanitizeMatrixHtml()`.

### 0.5 Restrict File System Access Scope

- **File:** `src-tauri/capabilities/default.json:13`
- **Issue:** `fs:allow-read-file` without scope restriction — can read any file
- **Fix:** Add scope: `{ "allow": [{ "path": "$DOWNLOAD/*" }, { "path": "$DOCUMENT/*" }] }`

---

## Phase 1: Performance Critical

These issues directly impact user experience in daily use.

### 1.1 Virtualize MessageList

- **File:** `src/features/chat/components/MessageList.vue`
- **Issue:** Renders ALL messages as real DOM nodes. 200+ messages = hundreds of complex DOM subtrees.
- **Fix:** Implement `@tanstack/vue-virtual` (already a dependency, used in ConversationList but not here).
- **Impact:** Largest rendering bottleneck. Room switching and scrolling lag.

### 1.2 Fix matrix-js-sdk Tree-Shaking

- **File:** `src/matrix/client.ts:3`
- **Issue:** `import * as sdk from 'matrix-js-sdk'` bundles entire ~1.5MB SDK
- **Fix:** Change to `import { createClient } from 'matrix-js-sdk'`

### 1.3 Use shallowRef for SDK Objects

- **File:** `src/features/chat/composables/useMessages.ts:8`
- **Issue:** `ref<MatrixEvent[]>([])` deep-proxies complex SDK objects (dozens of nested properties per event)
- **Fix:** `shallowRef<MatrixEvent[]>([])` — mutations already replace the entire array.

### 1.4 Cache getRoomSummaries()

- **File:** `src/matrix/rooms.ts:39`
- **Issue:** Called by both `useConversations` and `useUnifiedInbox` on every sync tick. Iterates ALL rooms.
- **Fix:** Add timestamp-based memo (100-200ms TTL) so multiple callers in the same tick share results.

### 1.5 Fix EmojiButton Global Listener Accumulation

- **File:** `src/features/chat/components/EmojiButton.vue:60`
- **Issue:** Each EmojiButton adds a permanent global `pointerdown` listener. 200 messages = 200 listeners.
- **Fix:** Only add listener when picker is open, remove when closed.

### 1.6 Debounce Timeline Reloads

- **File:** `src/features/chat/composables/useMessages.ts:14-20`
- **Issue:** Every timeline event re-reads and slices the full timeline array (5-10x/sec during active chat)
- **Fix:** Debounce `onTimelineUpdate` (80ms, like `useConversations` already does).

### 1.7 Add Vendor Chunk Splitting

- **File:** `vite.config.ts`
- **Fix:** Add `build.rollupOptions.output.manualChunks` to separate matrix-js-sdk, tiptap, lottie-web into independent chunks.

### 1.8 Lazy-Load lottie-web

- **File:** `src/features/chat/components/AnimatedEmoji.vue:3`
- **Issue:** ~300KB loaded synchronously for every chat view
- **Fix:** Dynamic import in `onMounted()`, or use `lottie-web/build/player/lottie_light.min.js` (~150KB).

---

## Phase 2: Code Quality

Fixes that improve maintainability, developer experience, and user-facing error messages.

### 2.1 Create `useRoomPermissions` Composable

- **Issue:** Power level check duplicated 6 times across server/contacts features
- **Fix:** `src/shared/composables/useRoomPermissions.ts` exposing `isAdmin`, `canKick`, `myPowerLevel`, etc.

### 2.2 Create Matrix Type Augmentations

- **Issue:** ~15 `as any` casts for Matrix event types (`'m.room.power_levels' as any`, etc.)
- **Fix:** Create `src/matrix/matrix-types.d.ts` with module augmentation extending SDK's `EventType`.

### 2.3 Fix Generic Error Messages

- **Issue:** 25+ catch blocks use `toast.error(t('auth.error'))` for non-auth errors
- **Fix:** Create domain-specific i18n keys: `server.kick_failed`, `channel.create_failed`, etc.

### 2.4 Fix Architecture: Cross-Feature Imports

- **Issue:** `server` feature imports from `chat` feature; components call `getClient()` directly
- **Fix:**
  - Move shared utilities (`avatarGradient`, `useConversations`) to `src/shared/`
  - Components should access Matrix SDK only through stores/composables, never via `getClient()`

### 2.5 Extract Duplicated Patterns

| Pattern                               | Copies | Fix                             |
| ------------------------------------- | ------ | ------------------------------- |
| `MATRIX_TO_RE` + `onRichContentClick` | 2      | `src/shared/lib/matrixLinks.ts` |
| Click-outside handler                 | 3      | Use VueUse's `onClickOutside`   |
| Kick/Ban logic                        | 2      | `useMemberActions` composable   |
| Context preload fallback              | 5      | `useContextPreload` composable  |

### 2.6 Fix Hardcoded UI Strings

- **Issue:** English strings in `ChannelContextMenu`, `ChannelManager`, `InviteDialog` bypass i18n
- **Issue:** Chinese strings hardcoded in `matrix/messages.ts:220-380` (`getSystemEventInfo`)
- **Fix:** Replace all with `t()` calls and add i18n keys.

### 2.7 Cleanup Memory Leaks

| Issue                                      | File                                        | Fix                                          |
| ------------------------------------------ | ------------------------------------------- | -------------------------------------------- |
| Module-level listeners survive logout      | `useConversations.ts`, `useUnifiedInbox.ts` | Unbind on logout                             |
| `serverStore.stopListening()` never called | `serverStore.ts`                            | Call in logout flow                          |
| LiveKit Room listeners not removed         | `useVoiceChannel.ts`                        | `removeAllListeners()` before `disconnect()` |

---

## Phase 3: Security Hardening

Important but not release-blocking (assuming Phase 0 is done).

### 3.1 Implement Key Backup & Cross-Signing

- **File:** `src/matrix/crypto.ts`, `src/matrix/verification.ts`
- **Issue:** No key backup, no SSSS, no SAS verification, no key export/import
- **Fix:** Implement: (1) SSSS setup, (2) SAS emoji verification, (3) Key backup restore on new login

### 3.2 Migrate to Rust Crypto

- **File:** `src/matrix/crypto.ts:10`
- **Issue:** Uses deprecated `client.initCrypto()` (legacy JS crypto)
- **Fix:** Migrate to `client.initRustCrypto()` (matrix-js-sdk v41+)

### 3.3 Validate Session Restoration

- **File:** `src/matrix/auth.ts:88-101`
- **Fix:** Add Zod schema validation for restored session data. Verify token with `whoami` call.

### 3.4 Strengthen DOMPurify Config

- **File:** `src/shared/lib/htmlSanitizer.ts:30-35`
- **Fix:** Add `ALLOWED_URI_REGEXP: /^(?:https?|mailto|matrix):/i` to block `data:` URIs in links.

### 3.5 Validate Login Server URL

- **File:** `src/features/auth/components/LoginPage.vue`
- **Fix:** Require HTTPS in production. Implement `.well-known` discovery. Warn on non-standard servers.

### 3.6 Add Upload Validation

- **File:** `src/features/chat/composables/useMediaUpload.ts`
- **Fix:** Add file size limits and MIME type validation before upload.

---

## Phase 4: Test Coverage

Priority order based on risk and coverage gaps.

### 4.1 Security-Critical Tests (Immediate)

| File                              | Why                                                                   |
| --------------------------------- | --------------------------------------------------------------------- |
| `src/matrix/crypto.ts`            | E2EE is a core feature, 0% coverage                                   |
| `src/shared/lib/htmlSanitizer.ts` | XSS prevention, 0% coverage                                           |
| `src/matrix/auth.ts`              | Expand: add invalid credentials, network failure, expired token tests |
| `src/matrix/verification.ts`      | Device verification, 0% coverage                                      |

### 4.2 Core Composables (High Priority)

0 of 22 composables have unit tests. Top priorities:

1. `useMessages` — core message display logic
2. `useConversations` — room list management
3. `useCurrentRoom` — active room state
4. `useEditor` / `useMediaUpload` — message composition
5. `useContacts` / `useGroupManagement` — contact operations

### 4.3 Matrix Layer Gaps

10/20 matrix files completely untested:

- `sync.ts` (full lifecycle, not just recovery)
- `media.ts` (upload/download/thumbnails)
- `rooms.ts` (isolated unit tests)
- `typing.ts`, `receipts.ts`, `profile.ts`, `blocking.ts`, `spaces.ts`, `digest.ts`

### 4.4 Store Test Quality

Existing store tests are shallow:

- `chatStore.test.ts` — only 4 trivial tests, needs message sending, room switching
- `contactStore.test.ts` — uses `as any` to bypass types, no Matrix integration
- `settingsStore.test.ts` — only default values, no persistence or side-effect tests

### 4.5 E2E Test Infrastructure

- Current E2E tests are unusable in CI (`test.skip(!!process.env.CI)`)
- Missing: full login cycle, message send/receive, room creation, encryption setup
- Consider Tauri's E2E testing approach or WebDriver-based testing

### 4.6 Raise Coverage Thresholds

- Current: `statements: 15%, branches: 10%, functions: 15%, lines: 15%`
- Short-term target: 30% (after Phase 4.1-4.3)
- Medium-term target: 50%

---

## Metrics & Tracking

| Metric                   | Current | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
| ------------------------ | ------- | ------- | ------- | ------- | ------- | ------- |
| Critical security issues | 3       | 0       | 0       | 0       | 0       | 0       |
| CSP enabled              | No      | Yes     | —       | —       | —       | —       |
| Bundle size (estimated)  | ~2MB+   | —       | ~1MB    | —       | —       | —       |
| Test coverage            | ~15%    | —       | —       | —       | —       | 50%+    |
| `as any` count           | ~30+    | —       | —       | ~5      | —       | —       |
| Hardcoded UI strings     | ~20+    | —       | —       | 0       | —       | —       |
| Composable test coverage | 0%      | —       | —       | —       | —       | 40%+    |

---

## Implementation Order

```
Phase 0 (Security)     ████████████  BLOCK RELEASE — do first
Phase 1 (Performance)  ████████████  High user impact — do second
Phase 2 (Code Quality) ████████████  Maintainability — parallel with Phase 1
Phase 3 (Security+)    ████████████  Hardening — after Phase 0+1
Phase 4 (Testing)      ████████████  Ongoing — start with 4.1 during Phase 0
```

Phases 1 and 2 can be worked on in parallel. Phase 4.1 (security-critical tests) should start alongside Phase 0.
