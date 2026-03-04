# Emoji Effect Layer Canvas Migration Design

## Goal
Make emoji particle effects stay smooth during rapid repeated clicks by migrating the particle layer from DOM nodes to a single canvas, while keeping the existing `trigger(emoji, rect)` API intact.

## Context
- Current implementation uses DOM `span` nodes per particle and writes `style.transform` per frame.
- Rapid clicking increases DOM churn and layout work, causing visible stutter.
- We already have emoji-specific presets and effect logic that should remain compatible.

## Recommended Approach (Chosen)
Use a full-screen canvas overlay with **offscreen texture caching** per emoji+size+dpr. Particles are numerical state objects updated each frame. Rendering is done with `drawImage` from cached emoji textures. This provides the best performance while keeping the component boundary and external API unchanged.

## Architecture
- **Component API:** `EmojiEffectLayer.vue` continues to expose `trigger(emoji, rect)`.
- **Rendering:** Replace DOM particle nodes with one `<canvas>` overlay (`pointer-events: none`, absolute positioning).
- **State:** Maintain `particles: Particle[]` in JS; update in RAF loop.
- **Textures:** Cache emoji textures in `Map<string, HTMLCanvasElement>` (keyed by emoji + size + dpr). No OffscreenCanvas requirement to keep Tauri compatibility.
- **DPR Support:** Canvas backing size scales by `devicePixelRatio` to remain sharp.

## Data Flow
1. `trigger(emoji, rect)` called from `ChatWindow.vue`.
2. Compute `sx/sy` relative to canvas.
3. Choose preset, generate particles into pool/array.
4. Start RAF loop if not running.
5. On each frame: clear canvas, update particle positions, draw emoji textures with `drawImage`.

## Performance Strategy
- **Texture Cache:** Avoid repeated `fillText` draws for common emojis; reuse cached textures.
- **Object Pool:** Reuse particle objects to reduce GC churn.
- **Particle Caps:** Enforce `MAX_PARTICLES`; scale down counts for rapid repeated triggers.
- **Reduced Motion:** Respect `prefers-reduced-motion` by reducing particle count and duration.

## Fallbacks
- If texture rendering fails, fall back to `fillText` for that emoji.
- If canvas init fails, skip effect silently (no impact on chat).

## Testing & Verification
- Manual: Rapid click different emojis; confirm consistent frame rate and no UI lag.
- Type check: `npx vue-tsc --noEmit`.

