import { vi } from 'vitest'
import {
  ALL_ROOMS,
  M_DIRECT_CONTENT,
  MOCK_ROOM_OBJECTS,
  SELF_USER_ID,
  USERS,
  getMockRoomById,
} from './data'

export function createMockMatrixClient() {
  return {
    // ---- 认证 ----
    login: vi.fn().mockResolvedValue({ access_token: 'mock_token', user_id: SELF_USER_ID }),
    logout: vi.fn().mockResolvedValue(undefined),
    startClient: vi.fn().mockResolvedValue(undefined),
    stopClient: vi.fn(),

    // ---- 用户 ----
    getUserId: vi.fn().mockReturnValue(SELF_USER_ID),
    getAccessToken: vi.fn().mockReturnValue('mock_token'),
    getHomeserverUrl: vi.fn().mockReturnValue('https://matrix.localhost'),
    getUser: vi.fn((userId: string) => {
      const u = USERS[userId]
      return u ? { userId: u.userId, displayName: u.displayName, avatarUrl: u.avatarUrl } : null
    }),

    // ---- 房间 ----
    getRooms: vi.fn().mockReturnValue(MOCK_ROOM_OBJECTS),
    getRoom: vi.fn((roomId: string) => getMockRoomById(roomId)),
    joinRoom: vi.fn().mockResolvedValue({ roomId: '!mock:localhost' }),
    leave: vi.fn().mockResolvedValue(undefined),
    createRoom: vi.fn().mockResolvedValue({ room_id: '!new:localhost' }),
    isRoomEncrypted: vi.fn().mockReturnValue(false),

    // ---- 消息 ----
    sendMessage: vi.fn().mockResolvedValue({ event_id: '$mock_event' }),
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$mock_event' }),
    sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$mock_state' }),
    redactEvent: vi.fn().mockResolvedValue(undefined),
    paginateEventTimeline: vi.fn().mockResolvedValue(true),

    // ---- 媒体 ----
    uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://localhost/mock' }),
    mxcUrlToHttp: vi.fn((url: string) =>
      url.replace('mxc://', 'https://matrix.localhost/_matrix/media/v3/download/'),
    ),

    // ---- Account Data ----
    getAccountData: vi.fn((type: string) => {
      if (type === 'm.direct') {
        return { getContent: () => M_DIRECT_CONTENT }
      }
      return null
    }),
    setAccountData: vi.fn().mockResolvedValue(undefined),

    // ---- Push Rules ----
    pushRules: { global: { override: [] } },
    addPushRule: vi.fn().mockResolvedValue(undefined),
    deletePushRule: vi.fn().mockResolvedValue(undefined),

    // ---- Room Tags ----
    setRoomTag: vi.fn().mockResolvedValue(undefined),
    deleteRoomTag: vi.fn().mockResolvedValue(undefined),

    // ---- 搜索 ----
    searchUserDirectory: vi.fn().mockResolvedValue({
      results: Object.values(USERS)
        .filter(u => u.userId !== SELF_USER_ID)
        .map(u => ({ user_id: u.userId, display_name: u.displayName, avatar_url: u.avatarUrl ?? null })),
      limited: false,
    }),
    searchRoomEvents: vi.fn().mockResolvedValue({ results: [] }),

    // ---- 事件系统 ----
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),

    // ---- Presence ----
    setPresence: vi.fn().mockResolvedValue(undefined),

    // ---- 房间名称 / 话题 ----
    setRoomName: vi.fn().mockResolvedValue(undefined),
    setRoomTopic: vi.fn().mockResolvedValue(undefined),

    // ---- Invite / Kick ----
    invite: vi.fn().mockResolvedValue(undefined),
    kick: vi.fn().mockResolvedValue(undefined),
    setPowerLevel: vi.fn().mockResolvedValue(undefined),
  }
}

const mockClient = createMockMatrixClient()

vi.mock('@matrix/client', () => ({
  getClient: () => mockClient,
  createClient: vi.fn().mockReturnValue(mockClient),
  initClient: vi.fn().mockResolvedValue(mockClient),
  destroyClient: vi.fn(),
}))

export { mockClient }
