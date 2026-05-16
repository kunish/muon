# @muon/ui — Feishu Design System

Foundation + atoms layer per spec
[`docs/superpowers/specs/2026-05-07-feishu-design-system-foundation-design.md`](../../docs/superpowers/specs/2026-05-07-feishu-design-system-foundation-design.md).

## Layers

- `src/tokens/` — palette + role + dark
- `src/atoms/` — 12 atoms (Spec 1)
- `src/components/ui/` — legacy paths re-exporting from atoms (consumer compat)

## Develop

- `pnpm storybook` — live Storybook on :6006
- `pnpm test:visual` — Playwright snapshot diff
- `pnpm test:visual:update` — refresh visual baseline
- `pnpm refresh-stories` — regenerate `tests/visual/stories.json` after adding new stories
- `pnpm check:tokens` — token completeness (G1)

## Acceptance gates

See spec §5.1.

- G1, G2, G4, G7, G8 are scripted (run via `pnpm check:tokens`, `pnpm test:visual`, `pnpm type-check`, `pnpm build:web`).
- G3 (anchor reference images), G5 (30-line Feishu-style checklist), G6 (desktop smoke walk) are human-walked.

## Known limitations

- `pnpm build-storybook` (static build) is currently broken under Vite 8 + Storybook 8 builder. Visual regression runs against a live `pnpm storybook` dev server instead. Will be revisited when Storybook 9 ships with Vite 8 support.
- `tests/visual/stories.json` is a checked-in story-id snapshot. After adding new stories, run `pnpm refresh-stories` to update before regenerating screenshots.
