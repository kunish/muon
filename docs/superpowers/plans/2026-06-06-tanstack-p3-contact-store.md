# P3.3 — contactStore → vue-query (contacts/groups) + vue-store (search/selection/profiles) Plan

**Goal:** Split the Pinia `contactStore` — the highest-fan-out store so far (~16 files: 5 feature components + the cross-feature `useContactList` facade + `useMention` + 9 tests) — into its matrix-sourced server lists (`contacts`, `groups` → `@tanstack/vue-query`) and its client state (`searchQuery`, `selectedContactId`, and the localStorage-persisted `contactProfiles` → `@tanstack/vue-store`).

**Architecture:**
- **Server → vue-query:** `contactKeys.list()` → `loadContacts()` (matrix DM derivation) and `contactKeys.groups()` → `loadGroups()`. Pure `filterContacts`/`filterGroups` helpers in the data layer; the search-filtered lists are derived in the component (`filterContacts(query.contacts, searchQuery)`), not stored.
- **Client → vue-store:** `{ searchQuery, selectedContactId, contactProfiles }`. `contactProfiles` is local user metadata (blocked/favorite/note/tag) persisted to `localStorage` on every write — it is NOT server state, so it stays in the store (loaded at module init, persisted in `updateContactProfile`). Pure `getContactProfile(profiles, id)` + snapshot `contactProfileFor(id)`.
- **Facade preserved:** `useContactList()` keeps its exact shape (`contacts`/`groups` getters + `loadContacts`/`loadGroups`/`ensureContactsLoaded`/`ensureGroupsLoaded`) but backs onto the vue-query composables. The 7 external (read-only) consumers — chat/projects/approvals/calendar/email/organization — therefore need ZERO changes.
- **Types extracted:** `Contact`/`GroupInfo`/`ContactProfileState`/`DEFAULT_CONTACT_PROFILE` move to `features/contacts/types.ts` (was inline in the store). The 3 type-import sites (ContactItem, ContactList, OrganizationPage) re-point there.

**Why the facade auto-loads:** `useContactList()` → `useContactsQuery()` auto-fetches on mount (keyed + deduped across all consumers), so the old explicit `ensureContactsLoaded()`/`loadContacts()` onMounted triggers become no-ops kept only for API compatibility. One matrix read per stale window, shared.

**Reference:** P3.1 qaStore (mixed split), P3.2 digestStore (multi-facet + persisted client state). Conventions: `apps/desktop/src/shared/query/README.md`.

---

## File Structure

| File | Action |
| --- | --- |
| `features/contacts/types.ts` | Create — extracted types. |
| `features/contacts/queries/contactKeys.ts` | Create — `list()` / `groups()`. |
| `features/contacts/queries/contactsApi.ts` | Create — `loadContacts`, `loadGroups`, `filterContacts`, `filterGroups`. |
| `features/contacts/queries/useContacts.ts` | Create — `useContactsQuery`, `useGroupsQuery`. |
| `features/contacts/stores/contactStore.ts` | Rewrite — vue-store `{ searchQuery, selectedContactId, contactProfiles }` + actions + localStorage. |
| `shared/composables/useContactList.ts` | Rewrite — facade onto vue-query, same shape. |
| `features/contacts/components/{ContactList,ContactsPage,GroupMemberPicker,UserProfile}.vue` | Migrate consumers. |
| `features/contacts/components/ContactItem.vue`, `features/organization/components/OrganizationPage.vue` | Re-point type import only. |
| `features/chat/components/GlobalSearch.vue`, `features/chat/composables/useMention.ts` | Migrate to query/facade for `contacts`. |
| `tests/unit/queries/contactsApi.test.ts` | Create — data-layer tests. |
| `tests/unit/stores/contactStore.test.ts` | Rewrite — vue-store tests. |
| `tests/components/{ContactList,ContactsCallActions,CreateGroupDialog,GlobalSearch,GroupSettingsInvite,TaskComposerDialog,UserProfileLayout}.test.ts`, `tests/unit/composables/useMention.test.ts` | Migrate seeding: install `VueQueryPlugin`, seed via mocked `loadContacts`/matrix client, set search/selection via store actions, `resetContactStore()` in beforeEach. |

---

## Tasks

1. **Query layer** (additive, safe to commit alone): types + contactKeys + contactsApi + useContacts + `contactsApi.test.ts`. ✅ committed.
2. **Atomic swap** (single coherent change — deleting `useContactStore` breaks every consumer until migrated):
   - Rewrite `contactStore.ts` (vue-store) + `contactStore.test.ts`.
   - Rewrite `useContactList.ts` facade.
   - Migrate ContactList, ContactsPage, GroupMemberPicker, UserProfile, GlobalSearch, useMention; re-point ContactItem/OrganizationPage type imports.
   - Migrate the 8 seeding test files (parallelizable — independent files).
   - Verify: src type-check clean → contacts test subset → full unit suite → build → lint. No `useContactStore` residue.

## Self-Review Notes

- **No dual source of truth:** contacts/groups live only in the query cache; profiles/search/selection only in the vue-store. `filteredContacts`/`filteredGroups` are derived, never stored.
- **Behavior preservation:** `contactProfiles` localStorage load+persist ported verbatim (version-1 envelope, per-field validation, persist warn-on-error). DM derivation/sort/system-skip ported verbatim. Selection survives remount via the module-singleton store.
- **Facade keeps external consumers stable:** only contacts-feature-internal components and `useMention`/`GlobalSearch` change; the 7 cross-feature `useContactList` consumers are untouched.
- **Failures stay visible:** `loadContacts`/`loadGroups` reject on matrix error (surfaced via query error state); the only swallow is the pre-existing profile-persist `console.warn` and UserProfile's block/unblock rollback toast (unchanged).
