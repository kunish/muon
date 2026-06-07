import { beforeEach, describe, expect, it } from 'vitest'
import {
  adminTokenStorageKey,
  clearToken,
  loggedIn,
  resetSessionStore,
  sessionStore,
  setInstalled,
  setMustChangePassword,
  setToken,
} from '@/stores/sessionStore'

describe('sessionStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSessionStore()
  })

  it('starts logged out with empty token', () => {
    expect(sessionStore.state.adminToken).toBe('')
    expect(loggedIn.state).toBe(false)
  })

  it('setToken marks loggedIn true and persists to localStorage', () => {
    setToken('token-123')

    expect(sessionStore.state.adminToken).toBe('token-123')
    expect(loggedIn.state).toBe(true)
    expect(localStorage.getItem(adminTokenStorageKey)).toBe('token-123')
  })

  it('clearToken marks loggedIn false and removes from localStorage', () => {
    setToken('token-123')
    setMustChangePassword(true)

    clearToken()

    expect(sessionStore.state.adminToken).toBe('')
    expect(loggedIn.state).toBe(false)
    expect(sessionStore.state.mustChangePassword).toBe(false)
    expect(localStorage.getItem(adminTokenStorageKey)).toBeNull()
  })

  it('reads a persisted token from localStorage on reset', () => {
    localStorage.setItem(adminTokenStorageKey, 'persisted-token')

    resetSessionStore()

    expect(sessionStore.state.adminToken).toBe('persisted-token')
    expect(loggedIn.state).toBe(true)
  })

  it('setInstalled and setMustChangePassword update flags independently', () => {
    setInstalled(true)
    setMustChangePassword(true)

    expect(sessionStore.state.installed).toBe(true)
    expect(sessionStore.state.mustChangePassword).toBe(true)
  })
})
