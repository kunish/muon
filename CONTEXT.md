# Muon Context

The domain glossary for the Muon Matrix chat client. Use these terms exactly when discussing code, commits, and architecture. New terms get added here as decisions crystallise during reviews.

## Language

### Session & auth

**MatrixSession**:
Identity issued by a Matrix homeserver: `{ serverUrl, userId, accessToken, deviceId }`. Granted by `m.login.password` or via an authorization code redeemed through Muon's enterprise OAuth flow.
_Avoid_: Matrix login, Matrix credentials, Matrix token.

**MuonSession**:
Token triplet issued by the Muon API: `{ accessToken, refreshToken, expiresAt }`, scoped to a single device and labelled with a `deviceName`. The Muon API is the source of truth for `deviceName`.
_Avoid_: muon token, enterprise token, refresh token (alone).

**DeviceSession**:
Server-side row in the `device_sessions` table. Same conceptual object as **MuonSession**, viewed from the API. Each **MuonSession** corresponds to exactly one **DeviceSession**; refresh rotates both (revoke old, create new) under TOCTOU protection.
_Avoid_: server session, session record.

**EnterpriseSession**:
Desktop-side concept: the bundle `{ MuonSession, MatrixSession }` persisted on this device, together with its lifecycle (PKCE → exchange → refresh → clear). Only exists on the desktop client.
_Avoid_: enterprise login state, desktop session.

**EnterpriseAuthCallback**:
The `muon://auth/callback?code=…&state=…` URL the system browser sends back to the desktop after the user completes Muon OAuth in their browser.
_Avoid_: oauth redirect, login callback.

**PkceTransientState**:
The short-lived `{ codeVerifier, state }` pair held in storage between `startEnterpriseLogin` and `completeEnterpriseLogin`. Not part of an **EnterpriseSession** — it exists only while a login is in flight and is discarded on success or abandonment.
_Avoid_: pkce session, enterprise pkce state.

### Lifecycle

**SignIn**:
The act of producing a fresh **EnterpriseSession** (or **MatrixSession** alone, for password login) and activating it: persisting it, creating the Matrix client, binding events, starting sync.
_Avoid_: login (as a verb in code — keep as a domain term).

**SignOut**:
The act of stopping sync, calling Matrix logout, unbinding events, and clearing all stored session state.
_Avoid_: logout (as a verb in code).

**Bootstrap**:
Application startup path: attempt to restore an **EnterpriseSession**, refresh its **MuonSession** if near expiry, then activate the **MatrixSession**.
_Avoid_: hydrate, init.

### Rooms & messages

**RoomSummary**:
Domain-shaped snapshot of one Matrix room as the chat client cares about it: `{ roomId, name, avatar?, lastMessage?, lastMessageTs?, unreadCount, isDirect, isEncrypted, members, isPinned, isMuted, highlightCount, memberCount, … }`. Produced by `getRoomSummaries()` in `src/matrix/rooms.ts` from SDK `Room` objects. **RoomSummary** is the only room shape that should appear in feature-layer code.
_Avoid_: matrix-js-sdk `Room`, room object, room info.

**Message**:
Tagged union `ChatMessage | SystemMessage`. The domain-shaped projection of a single Matrix timeline event as the chat UI cares about it. Every **Message** is an immutable snapshot — when the SDK mutates the underlying event (decryption, edits, reactions, local-echo state), the matrix module re-projects and the array is replaced. Feature-layer code never sees `matrix-js-sdk`'s `MatrixEvent`.
_Avoid_: matrix event, timeline event, event payload.

**ChatMessage**:
A user-sent **Message**: `{ kind: 'chat', id, roomId, senderId, timestamp, msgType, body, formattedBody?, content, isRedacted, replyTo?, reactions, threadReplyCount?, sendStatus? }`. `isMine` is NOT a field — UI infers it via `senderId === currentUserId`, so the projection stays pure.
_Avoid_: text message, user message, content event.

**SystemMessage**:
A non-user **Message**: membership change, room rename, topic change, room created. Shape: `{ kind: 'system', id, roomId, timestamp, info: SystemEventInfo }`. The `info` carries enough domain detail to render the "Alice joined" / "Bob renamed the room" line without re-reading the SDK event.
_Avoid_: state event, system event row.

## Relationships

- An **EnterpriseSession** contains exactly one **MuonSession** and exactly one **MatrixSession**.
- A **MuonSession** corresponds 1:1 with a **DeviceSession** on the server. Refresh rotates both.
- A **MatrixSession** can also be created without an **EnterpriseSession** (direct `m.login.password`).
- A **PkceTransientState** is not part of an **EnterpriseSession**; it is a precondition for producing one.
- **Bootstrap** orchestrates **MatrixSession** activation after restoring an **EnterpriseSession**.
- **SignIn** and **SignOut** are the only entry points that callers (Vue components, App startup) should depend on.
- A **Message** is always derived from one Matrix timeline event by a pure projection in `src/matrix/projections/`. It is replaced (not mutated) on any change to the underlying event.
- A **RoomSummary** is a domain projection of an SDK `Room`. Composables and stores expose `RoomSummary`, never `Room`.

## Example dialogue

> **Dev:** "If the **MuonSession** refresh fails with 401, do we clear the **MatrixSession** too?"
> **Domain expert:** "No. The **MuonSession** rotates independently — losing it means the user must re-auth via PKCE, but the **MatrixSession** is still valid on the homeserver. We clear both only on explicit **SignOut**."

> **Dev:** "Where does `deviceName` live?"
> **Domain expert:** "On the server's **DeviceSession** row. The desktop never persists it standalone — it reads `deviceName` off the **MuonSession** the API returns on exchange or refresh."

## Flagged ambiguities

- "enterprise login" and "muon login" were both used in commits and code — resolved: the act is **SignIn (via enterprise)**; the produced object is an **EnterpriseSession**.
- "session" alone is ambiguous — always qualify: **MatrixSession**, **MuonSession**, **DeviceSession**, **EnterpriseSession**.
