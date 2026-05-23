import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useDocSync } from '@/features/docs/composables/useDocSync'

const mockProvider = vi.hoisted(() => ({
  destroy: vi.fn(),
  sendSnapshot: vi.fn(),
}))

const mockClient = vi.hoisted(() => ({
  getRoom: vi.fn(() => ({ roomId: '!doc:localhost' })),
  joinRoom: vi.fn(),
}))

const MatrixSyncProviderMock = vi.hoisted(() => {
  class MockMatrixSyncProvider {
    constructor() {
      return mockProvider
    }
  }

  return vi.fn(MockMatrixSyncProvider)
})

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => mockClient),
}))

vi.mock('@/features/docs/services/matrixSyncProvider', () => ({
  MatrixSyncProvider: MatrixSyncProviderMock,
}))

function mountSyncHarness(docId = '!doc:localhost') {
  return mount(
    defineComponent({
      setup() {
        const sync = useDocSync(docId)
        void sync.connect()
        return { connected: sync.connected }
      },
      template: '<div>{{ connected }}</div>',
    }),
  )
}

describe('useDocSync', () => {
  beforeEach(() => {
    MatrixSyncProviderMock.mockClear()
    mockProvider.sendSnapshot.mockClear()
    mockProvider.destroy.mockClear()
    mockClient.getRoom.mockReset()
    mockClient.getRoom.mockReturnValue({ roomId: '!doc:localhost' })
    mockClient.joinRoom.mockReset()
  })

  it('sends a snapshot after connecting so edits made before provider startup are persisted', async () => {
    mountSyncHarness()
    await flushPromises()

    expect(MatrixSyncProviderMock).toHaveBeenCalled()
    expect(mockProvider.sendSnapshot).toHaveBeenCalledTimes(1)
  })

  it('uses the joined room id when the Matrix room cache is not populated during refresh', async () => {
    mockClient.getRoom.mockReturnValueOnce(null).mockReturnValueOnce(null)
    mockClient.joinRoom.mockResolvedValue({ roomId: '!joined:localhost' })

    mountSyncHarness('!alias:localhost')
    await flushPromises()

    expect(MatrixSyncProviderMock.mock.calls[0]?.[1]).toBe('!joined:localhost')
    expect(mockProvider.sendSnapshot).toHaveBeenCalledTimes(1)
  })
})
