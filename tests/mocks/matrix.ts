import { vi } from 'vitest'

export function createMockMatrixClient() {
  return {
    login: vi.fn().mockResolvedValue({ access_token: 'mock_token', user_id: '@test:localhost' }),
    logout: vi.fn().mockResolvedValue(undefined),
    startClient: vi.fn().mockResolvedValue(undefined),
    stopClient: vi.fn(),
    getRooms: vi.fn().mockReturnValue([]),
    getRoom: vi.fn().mockReturnValue(null),
    getUser: vi.fn().mockReturnValue(null),
    joinRoom: vi.fn().mockResolvedValue({ roomId: '!mock:localhost' }),
    createRoom: vi.fn().mockResolvedValue({ room_id: '!new:localhost' }),
    sendMessage: vi.fn().mockResolvedValue({ event_id: '$mock_event' }),
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$mock_event' }),
    sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$mock_state' }),
    redactEvent: vi.fn().mockResolvedValue(undefined),
    uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://localhost/mock' }),
    isRoomEncrypted: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    getUserId: vi.fn().mockReturnValue('@test:localhost'),
    getAccessToken: vi.fn().mockReturnValue('mock_token'),
    mxcUrlToHttp: vi.fn((url: string) =>
      url.replace('mxc://', 'https://matrix.localhost/_matrix/media/v3/download/'),
    ),
    searchUserDirectory: vi.fn().mockResolvedValue({ results: [] }),
    paginateEventTimeline: vi.fn().mockResolvedValue(true),
    searchRoomEvents: vi.fn().mockResolvedValue({ results: [] }),
  }
}

const mockClient = createMockMatrixClient()

vi.mock('@matrix/client', () => ({
  getClient: () => mockClient,
  initClient: vi.fn().mockResolvedValue(mockClient),
  destroyClient: vi.fn(),
}))

export { mockClient }
