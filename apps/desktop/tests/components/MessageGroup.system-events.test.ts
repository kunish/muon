import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MessageGroup from '@/features/chat/components/MessageGroup.vue'

const { memberNames, mockClient } = vi.hoisted(() => {
  const names = new Map<string, string>()
  return {
    memberNames: names,
    mockClient: {
      getUserId: vi.fn(() => '@owner:localhost'),
      getRoom: vi.fn(() => ({
        getMember: vi.fn((userId: string) => ({
          name: names.get(userId) ?? userId,
          getMxcAvatarUrl: vi.fn(),
        })),
      })),
    },
  }
})

vi.mock('@matrix/client', () => ({
  getClient: () => mockClient,
}))

vi.mock('@matrix/index', async () => {
  const messages = await vi.importActual<typeof import('@/matrix/messages')>('@/matrix/messages')
  return {
    canMergeSystemEvents: messages.canMergeSystemEvents,
    getSystemEventInfo: messages.getSystemEventInfo,
    isSystemEvent: messages.isSystemEvent,
  }
})

function createInviteEvent(opts: { id: string; stateKey: string; displayName: string; ts: number }) {
  return {
    getId: () => opts.id,
    getType: () => 'm.room.member',
    getContent: () => ({ membership: 'invite', displayname: opts.displayName }),
    getPrevContent: () => ({ membership: 'leave' }),
    getSender: () => '@owner:localhost',
    getStateKey: () => opts.stateKey,
    getRoomId: () => '!room:localhost',
    getTs: () => opts.ts,
    isRedacted: () => false,
  } as any
}

function createRoomCreateEvent(opts: { id: string; ts: number }) {
  return {
    getId: () => opts.id,
    getType: () => 'm.room.create',
    getContent: () => ({ creator: '@owner:localhost' }),
    getPrevContent: () => ({}),
    getSender: () => '@owner:localhost',
    getStateKey: () => '',
    getRoomId: () => '!room:localhost',
    getTs: () => opts.ts,
    isRedacted: () => false,
  } as any
}

function createSelfJoinEvent(opts: { id: string; ts: number }) {
  return {
    getId: () => opts.id,
    getType: () => 'm.room.member',
    getContent: () => ({ membership: 'join', displayname: 'Owner' }),
    getPrevContent: () => ({ membership: 'leave' }),
    getSender: () => '@owner:localhost',
    getStateKey: () => '@owner:localhost',
    getRoomId: () => '!room:localhost',
    getTs: () => opts.ts,
    isRedacted: () => false,
  } as any
}

function createRoomNameEvent(opts: { id: string; name: string; ts: number }) {
  return {
    getId: () => opts.id,
    getType: () => 'm.room.name',
    getContent: () => ({ name: opts.name }),
    getPrevContent: () => ({}),
    getSender: () => '@owner:localhost',
    getStateKey: () => '',
    getRoomId: () => '!room:localhost',
    getTs: () => opts.ts,
    isRedacted: () => false,
  } as any
}

function mountMessageGroup(events: any[]) {
  return mount(MessageGroup, {
    props: {
      events,
      roomId: '!room:localhost',
    },
    global: {
      plugins: [createPinia()],
      stubs: {
        ChatMessage: true,
        MessageGroupAvatar: true,
        NewMessageSeparator: true,
        TimeStamp: true,
      },
    },
  })
}

describe('message group system events', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    memberNames.clear()
    memberNames.set('@owner:localhost', 'Owner')
    memberNames.set('@alice:localhost', 'Alice')
    memberNames.set('@bob:localhost', 'Bob')
  })

  it('merges consecutive member invite notices from the same inviter', () => {
    const wrapper = mountMessageGroup([
      createInviteEvent({
        id: '$invite-alice',
        stateKey: '@alice:localhost',
        displayName: 'Alice',
        ts: 1767225600000,
      }),
      createInviteEvent({
        id: '$invite-bob',
        stateKey: '@bob:localhost',
        displayName: 'Bob',
        ts: 1767225603000,
      }),
    ])

    const notices = wrapper.findAll('.animate-sys-fade-in')
    expect(notices).toHaveLength(1)
    expect(notices[0].text()).toContain('Owner 邀请了 Alice、Bob')
    expect(wrapper.find('[data-event-id="$invite-alice"]').exists()).toBe(true)
    expect(wrapper.find('[data-event-id="$invite-bob"]').exists()).toBe(true)
  })

  it('merges the initial group creation setup notices into one notice', () => {
    const wrapper = mountMessageGroup([
      createRoomCreateEvent({
        id: '$create',
        ts: 1767225600000,
      }),
      createSelfJoinEvent({
        id: '$owner-join',
        ts: 1767225601000,
      }),
      createRoomNameEvent({
        id: '$room-name',
        name: 'kk',
        ts: 1767225602000,
      }),
      createInviteEvent({
        id: '$invite-alice',
        stateKey: '@alice:localhost',
        displayName: 'Alice',
        ts: 1767225603000,
      }),
      createInviteEvent({
        id: '$invite-bob',
        stateKey: '@bob:localhost',
        displayName: 'Bob',
        ts: 1767225604000,
      }),
    ])

    const notices = wrapper.findAll('.animate-sys-fade-in')
    expect(notices).toHaveLength(1)
    expect(notices[0].text()).toContain('Owner 创建了群聊 "kk"，并邀请了 Alice、Bob')
    expect(notices[0].text()).not.toContain('加入了群聊')
    expect(wrapper.find('[data-event-id="$create"]').exists()).toBe(true)
    expect(wrapper.find('[data-event-id="$owner-join"]').exists()).toBe(true)
    expect(wrapper.find('[data-event-id="$room-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-event-id="$invite-alice"]').exists()).toBe(true)
    expect(wrapper.find('[data-event-id="$invite-bob"]').exists()).toBe(true)
  })

  it('does not merge later room rename and invite notices without a creation event', () => {
    const wrapper = mountMessageGroup([
      createRoomNameEvent({
        id: '$room-name',
        name: 'kk',
        ts: 1767225600000,
      }),
      createInviteEvent({
        id: '$invite-alice',
        stateKey: '@alice:localhost',
        displayName: 'Alice',
        ts: 1767225601000,
      }),
    ])

    const notices = wrapper.findAll('.animate-sys-fade-in')
    expect(notices).toHaveLength(2)
    expect(notices[0].text()).toContain('Owner 将群名改为 "kk"')
    expect(notices[1].text()).toContain('Owner 邀请了 Alice')
  })
})
