export interface Contact {
  userId: string
  displayName: string
  avatarUrl?: string
  presence: 'online' | 'offline' | 'unavailable'
}

export interface GroupInfo {
  roomId: string
  name: string
  memberCount: number
  avatarUrl?: string
}

export interface ContactProfileState {
  isBlocked: boolean
  isFavorite: boolean
  note: string
  tag: string
}

export const DEFAULT_CONTACT_PROFILE: ContactProfileState = {
  isBlocked: false,
  isFavorite: false,
  note: '',
  tag: '',
}
