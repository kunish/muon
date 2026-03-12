/**
 * Module augmentation for matrix-js-sdk
 *
 * Extends the SDK's typed event maps to include Muon's custom event types,
 * allowing us to use `sendStateEvent`, `getAccountData`, `setAccountData`, etc.
 * without `as any` casts.
 */

import 'matrix-js-sdk'

/** Content types for Muon custom state events */
export interface MuonAnnouncementContent {
  body: string
}

export interface MuonMessageRetentionContent {
  enabled: boolean
  max_lifetime?: number
}

export interface MuonVoiceChannelContent {
  enabled: boolean
}

export interface MuonStarredContent {
  starred: { roomId: string, eventId: string }[]
}

export interface MuonDirectContent {
  [userId: string]: string[]
}

declare module 'matrix-js-sdk' {
  interface StateEvents {
    'im.muon.announcement': MuonAnnouncementContent
    'im.muon.message_retention': MuonMessageRetentionContent
    'im.muon.voice_channel': MuonVoiceChannelContent
    'im.muon.roles': { roles: { name: string, level: number }[] }
    'm.room.avatar': { url: string }
    'm.room.power_levels': {
      users?: Record<string, number>
      events?: Record<string, number>
      state_default?: number
      events_default?: number
      users_default?: number
      ban?: number
      kick?: number
      redact?: number
    }
  }

  interface AccountDataEvents {
    'im.muon.starred': MuonStarredContent
    'm.direct': Record<string, string[]>
  }

  interface TimelineEvents {
    'im.muon.contact_card': {
      'msgtype': 'im.muon.contact_card'
      'body': string
      'im.muon.contact_card': {
        user_id: string
        display_name: string
        avatar_url: string
      }
    }
  }
}
