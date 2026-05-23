import { describe, expect, it } from 'vitest'
import { LOCAL_SERVICE_MOCK_DATA } from '@/shared/data/localServiceMock'
import { USERS } from '../mocks/data'

describe('local service mock data', () => {
  it('covers the Matrix surfaces used by local services', () => {
    expect(LOCAL_SERVICE_MOCK_DATA.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/)
    expect(LOCAL_SERVICE_MOCK_DATA.users.length).toBeGreaterThanOrEqual(8)
    expect(LOCAL_SERVICE_MOCK_DATA.profileUsers.length).toBeGreaterThanOrEqual(5)
    expect(LOCAL_SERVICE_MOCK_DATA.dmRooms.length).toBeGreaterThanOrEqual(5)
    expect(LOCAL_SERVICE_MOCK_DATA.groupRooms.length).toBeGreaterThanOrEqual(3)
    expect(LOCAL_SERVICE_MOCK_DATA.spaces.length).toBeGreaterThanOrEqual(2)

    const allChannels = LOCAL_SERVICE_MOCK_DATA.spaces.flatMap(space => [
      ...space.channels,
      ...space.categories.flatMap(category => category.channels),
    ])

    expect(allChannels.some(channel => channel.isVoice)).toBe(true)
    expect(allChannels.some(channel => !channel.isVoice && channel.messages.length > 0)).toBe(true)
    expect(allChannels.some(channel =>
      channel.messages.some(message => message.content.format === 'org.matrix.custom.html'),
    )).toBe(true)
    expect(allChannels.some(channel =>
      channel.messages.some(message => message.content.msgtype === 'im.muon.contact_card'),
    )).toBe(true)
  })

  it('references only seeded local users', () => {
    const localparts = new Set([
      LOCAL_SERVICE_MOCK_DATA.owner.localpart,
      ...LOCAL_SERVICE_MOCK_DATA.users.map(user => user.localpart),
      ...LOCAL_SERVICE_MOCK_DATA.profileUsers.map(user => user.localpart),
    ])

    function expectKnownUser(localpart: string) {
      expect(localparts.has(localpart), `${localpart} should be declared as a local service user`).toBe(true)
    }

    for (const dm of LOCAL_SERVICE_MOCK_DATA.dmRooms) {
      expectKnownUser(dm.peer)
      for (const message of dm.messages)
        expectKnownUser(message.sender)
    }

    for (const room of LOCAL_SERVICE_MOCK_DATA.groupRooms) {
      for (const member of room.members)
        expectKnownUser(member)
      for (const message of room.messages)
        expectKnownUser(message.sender)
    }

    for (const space of LOCAL_SERVICE_MOCK_DATA.spaces) {
      for (const member of space.members)
        expectKnownUser(member)

      for (const channel of space.channels) {
        for (const member of channel.members)
          expectKnownUser(member)
        for (const message of channel.messages)
          expectKnownUser(message.sender)
      }

      for (const category of space.categories) {
        for (const channel of category.channels) {
          for (const member of channel.members)
            expectKnownUser(member)
          for (const message of channel.messages)
            expectKnownUser(message.sender)
        }
      }
    }
  })

  it('assigns avatars to every local service contact', () => {
    const contacts = [
      LOCAL_SERVICE_MOCK_DATA.owner,
      ...LOCAL_SERVICE_MOCK_DATA.users,
      ...LOCAL_SERVICE_MOCK_DATA.profileUsers,
    ]

    for (const contact of contacts) {
      expect(contact.avatarUrl, `${contact.localpart} should have an avatar`).toMatch(/^mxc:\/\/localhost\/avatar_/)
    }
  })

  it('keeps test Matrix contacts avatar-backed', () => {
    for (const user of Object.values(USERS)) {
      expect(user.avatarUrl, `${user.userId} should have an avatar`).toMatch(/^mxc:\/\/localhost\/avatar_/)
    }
  })

  it('uses stable unique keys for seed markers', () => {
    const keys = [
      ...LOCAL_SERVICE_MOCK_DATA.dmRooms.map(room => room.key),
      ...LOCAL_SERVICE_MOCK_DATA.groupRooms.map(room => room.key),
      ...LOCAL_SERVICE_MOCK_DATA.spaces.flatMap(space => [
        space.key,
        ...space.channels.map(channel => channel.key),
        ...space.categories.flatMap(category => [
          category.key,
          ...category.channels.map(channel => channel.key),
        ]),
      ]),
    ]

    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys)
      expect(key).toMatch(/^[a-z0-9-]+$/)
  })
})
