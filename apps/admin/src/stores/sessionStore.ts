import { createStore, Store } from '@tanstack/vue-store'

export interface SessionState {
  installed: boolean
  adminToken: string
  mustChangePassword: boolean
}

/** localStorage key the admin token is persisted under. Mirrors the legacy AdminApp.vue value. */
export const adminTokenStorageKey = 'muon_admin_token'

function readStoredAdminToken(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(adminTokenStorageKey) ?? ''
}

function createInitialState(): SessionState {
  return {
    installed: false,
    adminToken: readStoredAdminToken(),
    mustChangePassword: false,
  }
}

export const sessionStore = new Store<SessionState>(createInitialState())

/**
 * Derived `loggedIn` flag — reactive `ReadonlyStore` whose `state` is true
 * whenever an admin token is present. Reading `sessionStore.get()` inside the
 * getter wires up automatic dependency tracking.
 */
export const loggedIn = createStore<boolean>(() => Boolean(sessionStore.get().adminToken))

export function setToken(token: string): void {
  sessionStore.setState((s) => ({ ...s, adminToken: token }))
  if (typeof window !== 'undefined') window.localStorage.setItem(adminTokenStorageKey, token)
}

export function clearToken(): void {
  sessionStore.setState((s) => ({ ...s, adminToken: '', mustChangePassword: false }))
  if (typeof window !== 'undefined') window.localStorage.removeItem(adminTokenStorageKey)
}

export function setInstalled(installed: boolean): void {
  sessionStore.setState((s) => ({ ...s, installed }))
}

export function setMustChangePassword(mustChangePassword: boolean): void {
  sessionStore.setState((s) => ({ ...s, mustChangePassword }))
}

/** Reset to initial state. Used by tests for isolation. */
export function resetSessionStore(): void {
  sessionStore.setState(() => createInitialState())
}
