import { beforeEach, describe, expect, it } from 'vitest'
import {
  contactProfileFor,
  contactStore,
  getContactProfile,
  resetContactStore,
  selectContact,
  setSearchQuery,
  toggleContactBlocked,
  toggleContactFavorite,
  updateContactProfile,
} from '@/features/contacts/stores/contactStore'

const STORAGE_KEY = 'muon.contacts.profiles.v1'
const DEFAULT_PROFILE = { isBlocked: false, isFavorite: false, note: '', tag: '' }

describe('contactStore (client state)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetContactStore()
  })

  it('starts with empty search, no selection, and no profiles', () => {
    expect(contactStore.state.searchQuery).toBe('')
    expect(contactStore.state.selectedContactId).toBeNull()
    expect(contactStore.state.contactProfiles).toEqual({})
  })

  it('setSearchQuery and selectContact update the client state', () => {
    setSearchQuery('ali')
    selectContact('@alice:localhost')
    expect(contactStore.state.searchQuery).toBe('ali')
    expect(contactStore.state.selectedContactId).toBe('@alice:localhost')

    selectContact(null)
    expect(contactStore.state.selectedContactId).toBeNull()
  })

  it('contactProfileFor returns the default profile for an unknown contact', () => {
    expect(contactProfileFor('@nobody:localhost')).toEqual(DEFAULT_PROFILE)
  })

  it('updateContactProfile merges fields onto the default and persists to localStorage', () => {
    updateContactProfile('@alice:localhost', { tag: 'Work', note: 'PM' })

    expect(contactProfileFor('@alice:localhost')).toEqual({
      isBlocked: false,
      isFavorite: false,
      note: 'PM',
      tag: 'Work',
    })

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toEqual({
      version: 1,
      profiles: { '@alice:localhost': { isBlocked: false, isFavorite: false, note: 'PM', tag: 'Work' } },
    })
  })

  it('toggleContactFavorite and toggleContactBlocked flip the respective flags', () => {
    toggleContactFavorite('@alice:localhost')
    expect(contactProfileFor('@alice:localhost').isFavorite).toBe(true)
    toggleContactFavorite('@alice:localhost')
    expect(contactProfileFor('@alice:localhost').isFavorite).toBe(false)

    toggleContactBlocked('@alice:localhost')
    expect(contactProfileFor('@alice:localhost').isBlocked).toBe(true)
  })

  it('getContactProfile is a pure lookup with a default fallback', () => {
    const profiles = { '@a:localhost': { isBlocked: true, isFavorite: false, note: '', tag: 'x' } }
    expect(getContactProfile(profiles, '@a:localhost').tag).toBe('x')
    expect(getContactProfile(profiles, '@missing:localhost')).toEqual(DEFAULT_PROFILE)
  })

  it('reloads persisted profiles from localStorage when the store re-initializes', () => {
    updateContactProfile('@alice:localhost', { isFavorite: true })

    resetContactStore()

    expect(contactProfileFor('@alice:localhost').isFavorite).toBe(true)
  })
})
