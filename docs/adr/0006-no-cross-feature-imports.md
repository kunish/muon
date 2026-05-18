# No cross-feature imports; `src/shared/` is the only seam

Feature modules under `src/features/<name>/` may not import from any other `src/features/<other>/`. The only legitimate paths for cross-feature reuse are:

1. `src/shared/` — composables, components, lib, services, stores, data that are not owned by any one feature.
2. `src/matrix/` — domain projections and verbs (see ADR-0003, ADR-0004, ADR-0005).
3. `src/app/` — only when feature code is consumed by app-level shell (router, layout).

ESLint enforces this via `eslint-plugin-boundaries` so a regression shows up at lint time, not in code review six months later.

## Why this instead of a public-API-per-feature approach (DDD slice / `src/features/<name>/index.ts`)

A `feature/index.ts` "public API" pattern would let `chat` declare what it exposes and `server` import only that. We considered it and rejected it. Two reasons:

- **The reused things are not "feature concepts."** `GroupMemberPicker` is not "the contacts feature's contribution to other features" — it is a generic member-picker widget that incidentally lives in `contacts/`. `MediaViewer` is a lightbox. `avatarGradient` is a hash function. Promoting them into `shared/` admits what they always were.
- **Public-API pattern decays.** Every feature gradually grows a long `index.ts` re-exporting more and more internals, and reviewers stop pushing back because "it's already in the public API." The depth check ("could I delete `contacts/` and have only `shared/` plus `chat/`?") becomes meaningless. A strict `shared/` rule keeps the test sharp.

## Why we are not making `contacts/` a "primitives" layer

Six features today import from `contacts/`. That tempted us to declare `contacts/` a layered primitive that everyone else can read. We rejected it because:

- The widely-reused parts (`GroupMemberPicker`, `useContacts`, `useGroupManagement`) are infrastructure, not domain knowledge specific to contacts. Once they move into `shared/`, the remaining `contacts/` is what its name suggests — the contacts UX (browse, search, organize), with no special cross-cutting role.
- Layering hierarchies are a hidden slope. Once "contacts is primitives," someone proposes "chat is primitives for any feature that needs threading," and the rule becomes "every popular feature is also a primitive."

## Consequences

- `src/shared/` becomes the only directory where a Vue component / composable / store can live without explicit feature ownership. Adding to `shared/` requires a deliberate decision: is this _really_ feature-agnostic?
- Features may not "peek into" each other for shortcuts. If chat needs a member picker, it imports from `shared/`. If it _also_ needs the contacts feature's internal sort order or filter state, that filter state is feature-private and chat must duplicate or genuinely share it via `shared/`.
- `eslint-plugin-boundaries` adds one runtime-zero dev dependency. Configuration is checked in.

## When to revisit

If two features end up co-owning a substantial domain (e.g., a unified "calendar + scheduling + meetings" surface that started life in `calendar/` and grows into `meetings/`), and `shared/` would become an awkward home, consider merging the features rather than allowing cross-imports. Merging is a stronger statement than a public API.
