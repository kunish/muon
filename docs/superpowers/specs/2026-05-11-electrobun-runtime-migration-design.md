# Electrobun Runtime Migration - Parallel Runtime Design

**Date**: 2026-05-11
**Status**: Approved design
**Author / brainstorm partner**: shikun + Codex
**Decision**: Option B - introduce Electrobun beside the existing Electron runtime, then promote it after parity checks.

## Goal

Refactor Muon's desktop shell toward [Electrobun](https://github.com/blackboardsh/electrobun) without destabilizing the current Electron desktop app. The migration keeps the renderer-facing desktop bridge stable, adds a parallel Electrobun runtime, proves feature parity incrementally, then switches the default desktop commands in a later phase.

## Current Runtime Baseline

Muon is currently an Electron desktop app:

- `package.json` uses `electron`, `electron-vite`, `electron-builder`, and `electron-updater`.
- `electron/main.ts` owns the desktop main process: window creation, protocol registration, single-instance behavior, dialogs, file access, shell actions, fetch proxying, safe storage, updater calls, app settings, and close-to-tray state.
- `electron/preload.ts` exposes one renderer bridge: `window.muonDesktop`.
- `src/electron/*` wraps that bridge for application code. Chat, Matrix, settings, downloads, screenshots, link previews, auth, and docs consume these wrappers rather than raw Electron APIs.
- `WindowTitleBar.vue` assumes Electron's current native-window-control compromise: system traffic lights plus custom brand/drag region.

The durable boundary is already the desktop bridge. The migration should preserve that boundary instead of replacing feature components with runtime-specific calls.

## Electrobun Constraints

Electrobun changes the runtime model:

- Main process code runs on Bun and imports native APIs from `electrobun/bun`.
- Windows and views are represented by `BrowserWindow` / `BrowserView`.
- Packaged renderer assets are loaded through `views://...`.
- Browser code initializes Electrobun APIs through `Electroview` from `electrobun/view`.
- Main-to-browser and browser-to-main communication should use typed RPC, not Electron IPC.
- By default Electrobun uses the system WebView; CEF can be bundled later if renderer compatibility requires it.
- Build, icon, bundled asset, and update configuration moves to `electrobun.config.ts`.

References:

- https://blackboard.sh/electrobun/docs/
- https://blackboard.sh/electrobun/docs/apis/browser-window/
- https://blackboard.sh/electrobun/docs/apis/browser-view/
- https://blackboard.sh/electrobun/docs/apis/browser/electroview-class/
- https://blackboard.sh/electrobun/docs/apis/bundled-assets/
- https://blackboard.sh/electrobun/docs/apis/browser/draggable-regions/

## Non-Goals

- Do not remove Electron in the first implementation pass.
- Do not rewrite chat, Matrix, docs, settings, or workspace feature components for Electrobun.
- Do not make `pnpm dev` depend on Electrobun until parity is proven.
- Do not replace `electron-updater` with Electrobun Updater in the first pass.
- Do not claim Electron safeStorage parity until a secure platform storage replacement is implemented and tested.
- Do not bundle CEF by default unless the system WebView fails concrete renderer compatibility checks.

## Proposed Architecture

Keep the renderer API stable and introduce a second runtime behind it.

```
Vue / Matrix / Feature Code
        |
        v
src/electron/* wrappers        (kept initially; later renamed to src/desktop/*)
        |
        v
window.muonDesktop bridge      (same application contract)
        |
        +-------------------+
        |                   |
        v                   v
Electron preload + IPC      Electrobun Electroview + typed RPC
        |                   |
        v                   v
electron/main.ts            src/electrobun/main.ts
```

The first implementation pass should avoid a broad rename from `src/electron` to `src/desktop`. Existing imports can continue to work while the bridge gains runtime-neutral fields. A later cleanup can rename the module path once both runtimes are green.

## Package and Script Shape

Add Electrobun without changing the existing Electron commands:

- Add Electrobun dependency and Bun execution requirements.
- Add `electrobun.config.ts`.
- Add `src/electrobun/main.ts` for the Bun main process.
- Add `src/electrobun/view.ts` or equivalent browser-side bootstrap that creates the `window.muonDesktop` compatibility object from Electrobun RPC.
- Add `src/electrobun/shared.ts` for typed RPC schemas shared by Bun and browser contexts.
- Add scripts:
  - `dev:electrobun`
  - `build:electrobun`
  - optionally `package:electrobun`

Keep these scripts unchanged during phase 1:

- `dev`
- `dev:desktop`
- `build:desktop`
- `package`
- `dist`

This preserves the current development path while giving us an explicit Electrobun path to validate.

## Bridge Contract

The phase-1 Electrobun bridge should expose the same renderer-facing shape as `MuonDesktopBridge` wherever practical:

| Bridge Area | Phase-1 Electrobun Target |
| --- | --- |
| `isElectron` | Keep for compatibility during phase 1, but add a runtime-neutral discriminator such as `runtime: 'electron' | 'electrobun'`. |
| `platform` | Provide Bun platform value mapped to current renderer expectations. |
| `window.hide/show/setFocus` | Implement with Electrobun window APIs if available. Where an API is missing, return a controlled unsupported error and keep screenshot fallback behavior safe. |
| `dialog.open/save/ask` | Implement native dialogs if Electrobun exposes them. If not, use browser file picker / in-app confirmation for phase 1 and document the gap. |
| `fs.readFile/writeFile` | Implement through Bun file APIs after validating absolute paths and user-selected paths. |
| `shell.openPath/openUrl/revealItemInDir` | Implement with Electrobun or Bun/native helpers. Keep URL protocol validation from Electron. |
| `fetch` | Implement through Bun `fetch`, including response serialization. Manual redirect parity must be explicitly tested. |
| `safeStorage` | Return unavailable until a secure OS-backed storage replacement is chosen. Do not silently use plain text. |
| `app.setAutoLaunch` | Mark unsupported in phase 1 unless Electrobun has a native equivalent. |
| `app.setCloseToTray` | Keep local setting and close behavior if Electrobun exposes tray/window close hooks; otherwise mark unsupported. |
| `auth.onCallback` | Preserve the callback channel using Electrobun app/protocol events if available. |
| `updater.check/install` | Return `null` / unsupported in phase 1. Replace with Electrobun Updater in a later phase. |

The renderer wrappers should handle unsupported bridge methods gracefully. User-facing flows should fail closed with clear UI behavior instead of throwing uncaught runtime errors.

## Runtime Phases

### Phase 1 - Parallel Electrobun Shell

Objective: open Muon in Electrobun and exercise a minimal logged-in desktop workflow without altering the existing Electron path.

Work:

- Add Electrobun project config and entrypoints.
- Build/reuse the current Vite renderer for Electrobun.
- Load dev server in development and `views://` bundled assets in packaged builds.
- Expose a compatibility `window.muonDesktop` from `Electroview` RPC.
- Implement the low-risk bridge methods first: platform, fetch, file read/write, open URL, open/save where possible, ask where possible, window focus/show/hide where possible.
- Keep Electron as the default runtime.

Exit criteria:

- `pnpm dev:electrobun` launches the app.
- Login page renders.
- Existing web-only flows still work.
- Link preview / Matrix media fetch paths work through the Electrobun fetch bridge or fall back safely.
- Unsupported desktop-only features do not crash the renderer.

### Phase 2 - Desktop Feature Parity

Objective: close high-value desktop gaps and make Electrobun usable for daily development.

Work:

- Deep-link protocol handling for enterprise auth callback.
- Native title bar / draggable-region parity with the current custom title bar.
- Dialog parity for attachment upload, profile avatar selection, media save, and destructive confirmations.
- Shell parity for external links, reveal-in-folder, and open-path.
- Secure storage replacement for Matrix credentials, or an explicit migration strategy if existing Electron encrypted data cannot be read.
- Close-to-tray and auto-launch decisions.
- Screenshot hiding/focus flow parity or an Electrobun-specific fallback.

Exit criteria:

- Core chat, media upload/download, settings, auth, and docs flows work in Electrobun.
- No known unsupported bridge methods are exercised by default user flows.
- Unit tests cover the bridge contract for both runtimes.

### Phase 3 - Promote Electrobun

Objective: make Electrobun the default desktop runtime while keeping rollback cheap.

Work:

- Switch `dev:desktop` and `build:desktop` to Electrobun once phase 2 is green.
- Keep `dev:electron` / `build:electron` for one transition window if rollback is useful.
- Add CI coverage for Electrobun build.
- Update README and developer docs.
- Decide whether to bundle CEF based on real renderer compatibility evidence.

Exit criteria:

- `pnpm dev` launches the Electrobun desktop app.
- `pnpm build` includes Electrobun desktop build.
- Existing lint, type-check, unit test, and desktop build gates pass.

### Phase 4 - Remove Electron

Objective: delete the old runtime after a stable Electrobun release path exists.

Work:

- Remove Electron dependencies and electron-builder config.
- Remove `electron/` source and `electron.vite.config.ts`.
- Rename `src/electron/*` wrappers to `src/desktop/*` and update imports.
- Replace Electron-specific tests with desktop-runtime-neutral tests.
- Remove Electron wording from package metadata and docs.

Exit criteria:

- No Electron dependencies remain.
- No `electron` imports remain outside archival docs.
- Desktop packaging and update docs refer only to Electrobun.

## Renderer Compatibility Strategy

Electrobun defaults to system WebView, which is not identical to Electron Chromium. Muon uses Vue 3, Tailwind v4, TipTap/ProseMirror, Matrix SDK, WebRTC/LiveKit, IndexedDB/Dexie, media APIs, file blobs, and Web Crypto. These must be validated against the system WebView before declaring parity.

Phase 1 should not bundle CEF. Instead, run compatibility checks on macOS first:

- App shell render and router navigation.
- Matrix login and sync.
- IndexedDB/Dexie local state.
- TipTap rich editor render and basic input.
- Media display and download.
- `navigator.mediaDevices.getDisplayMedia` for screenshot flow.
- LiveKit voice surface if available locally.

If system WebView fails a core requirement and no practical workaround exists, add a phase-2 decision to test CEF bundling.

## Security Rules

- Keep the current external URL allowlist behavior: only `http:`, `https:`, and `mailto:` may open externally.
- Do not expose raw Bun filesystem access to the renderer. All file operations must go through explicit RPC handlers with validation.
- Do not use plain text storage as a replacement for Electron safeStorage.
- Treat Electrobun RPC as privileged. Runtime handlers should validate input shapes before touching OS APIs.
- Keep CSP in packaged renderer output. Electrobun should not weaken the existing script/object restrictions.
- Keep untrusted remote content out of privileged views. If nested webviews are added later, use sandboxed views without RPC.

## Testing and Verification

Phase 1 verification:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm build:web`
- `pnpm build:electrobun`
- Manual launch: `pnpm dev:electrobun`
- Smoke path: login screen, workspace navigation, chat timeline render, external link guard, media fetch, file open/save if implemented.

Phase 2 verification adds:

- Bridge contract tests for both Electron and Electrobun.
- Source tests asserting no feature component imports raw Electrobun APIs.
- Desktop smoke screenshots for window chrome and title bar.
- Auth deep-link test using a `muon://...` callback payload.
- Safe storage migration or unavailable-state tests.

Phase 3 verification adds:

- Full `pnpm build`.
- Packaging smoke for the Electrobun artifact.
- README / script documentation checks.

## Risks

| Risk | Mitigation |
| --- | --- |
| System WebView incompatibility with current renderer stack | Validate first on the explicit smoke list; only consider CEF after concrete failures. |
| Electron safeStorage data cannot be reused | Treat secure storage as a separate migration item; do not downgrade to plain text. |
| Updater replacement changes release workflow | Keep updater unsupported in phase 1; design Electrobun Updater separately after packaging works. |
| Dialog/shell APIs are not one-to-one | Preserve bridge contract and use controlled unsupported errors or browser/in-app fallbacks until native parity exists. |
| Title bar behavior regresses on macOS | Keep the existing native-control design contract and test hit regions visually before promotion. |
| Broad import rename creates noise | Defer `src/electron` to `src/desktop` rename until after Electrobun runtime is proven. |

## Implementation Boundaries

The first implementation plan should be split into small, reviewable slices:

1. Dependency and config scaffold.
2. Electrobun main window with Vite dev-server loading.
3. Browser-side Electroview bootstrap exposing `window.muonDesktop`.
4. Typed RPC bridge for low-risk methods.
5. Build script and bundled asset path.
6. Tests for runtime detection and graceful unsupported behavior.
7. Manual smoke and documented gaps.

Do not mix Electron deletion, updater replacement, safe storage migration, CEF bundling, or global import renames into the first implementation plan.
