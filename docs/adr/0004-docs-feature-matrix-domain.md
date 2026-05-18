# Docs feature treats Matrix as a domain-layer collaboration store

The docs feature uses Matrix not just as a chat transport but as the persistent backing store for collaborative documents: per-room state events hold doc metadata and share ACLs; account data holds the user's folder layout; high-frequency `m.muon.doc.sync.*` events carry Yjs CRDT updates. We resolve this by giving the matrix module a dedicated `src/matrix/docs/` submodule that owns the docs-specific domain types (`DocMetadata`, `DocFolders`, `DocShare`, `DocSyncEvent`) and operations. The docs feature consumes only those — never `matrix-js-sdk` directly.

## Why

The docs feature already attempted this with feature-local `MatrixDocAccountClient` / `MatrixDocMetadataClient` interfaces (`src/features/docs/stores/docsStore.ts:64-71`), but those interfaces (a) live inside the feature, (b) are spelled differently across files, and (c) are reached by `getClient() as unknown as MatrixDocAccountClient` casts that defeat the narrowing. Pulling the domain types up into `src/matrix/docs/` removes the casts, centralises the contract, and aligns docs with how chat will consume `Message` and `RoomDetail` after `2026-05-17-message-domain-types.md` lands.

This is also the only feature where Matrix is used non-trivially as a database. Acknowledging that explicitly — rather than treating docs as a slightly odd chat feature — makes the architecture honest.

## Considered and rejected

- _"Keep the narrow interfaces inside `src/features/docs/`; just hide `getClient()` behind a feature-local `getDocsClient()` factory."_ Rejected. It hides the cast but doesn't move the cost: the docs feature still owns Matrix knowledge that other features cannot reuse and tests cannot inject without spinning up a real SDK client. The matrix module already owns `Message` and `RoomSummary` projections; docs entities belong in the same place.
- _"Treat docs feature as `getClient`-using and lint-exclude it."_ Rejected. It leaves `getClient` exported from `src/matrix/index.ts` indefinitely, which makes regression in other features harder to detect (the lint rule needs to be feature-scoped). Cleaning all features at once is the cheaper end state.

## Consequence

When the project later considers swapping the docs backing store (Yjs CRDTs over a non-Matrix transport, or a separate collaboration service), the abstraction line is already drawn at `src/matrix/docs/`. No call site in `src/features/docs/` needs to change.

## When to revisit

If a second feature emerges that uses Matrix non-trivially as a database (calendars? task boards via state events?), promote `src/matrix/docs/` to a wider `src/matrix/data/` pattern with one submodule per data domain.
