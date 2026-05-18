# Keep the matrix-only Bootstrap fallback

`Bootstrap` (`src/auth/lifecycle.ts`) tries `restoreEnterprise` first and, on null, falls back to `restoreMatrixSession` — i.e. activates a stored **MatrixSession** without a **MuonSession**. We keep this fallback even though enterprise OAuth is the canonical sign-in path.

## Why

- `signInWithPassword` (`m.login.password`) is still wired into `LoginPage.vue` and supported as an alternative to enterprise OAuth. A password sign-in produces a **MatrixSession** with no **MuonSession**, so on next launch only the matrix-only branch can resume the user without re-login.
- The same branch also covers the documented case (see CONTEXT.md "Relationships") where a **MuonSession** has been revoked (`EnterpriseSessionError.refresh-revoked`) but the **MatrixSession** is still valid on the homeserver — the user can keep chatting while re-doing PKCE later.

## Considered and rejected

- _"Delete the matrix-only branch; require enterprise sign-in for all returning users."_ Rejected because it forces a re-login on every existing password-login user every time the app starts, and it discards a still-valid **MatrixSession** when only the **MuonSession** is gone.

## When to revisit

When password sign-in is removed from `LoginPage.vue` _and_ all production deployments require enterprise OAuth. At that point the matrix-only branch becomes dead code and this ADR should be superseded.
