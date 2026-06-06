import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatDocsList from '@/features/chat/components/ChatDocsList.vue'
import ChatFileList from '@/features/chat/components/ChatFileList.vue'
import { resetChatStore, setCurrentRoom } from '@/features/chat/stores/chatStore'

const downloadMocks = vi.hoisted(() => ({
  downloadMediaFile: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

function createEvent(overrides: { body: string; info?: Record<string, unknown>; msgtype: string; url: string }) {
  return {
    getContent: () => overrides,
    getId: () => '$file-event',
    getSender: () => '@alice:localhost',
    getTs: () => 1767225600000,
    getType: () => 'm.room.message',
  }
}

const matrixMocks = vi.hoisted(() => ({
  events: [] as ReturnType<typeof createEvent>[],
}))

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getRoom: () => ({
      getLiveTimeline: () => ({
        getEvents: () => matrixMocks.events,
      }),
    }),
    getUser: (userId: string) => ({ displayName: userId === '@alice:localhost' ? 'Alice' : userId }),
  }),
}))

vi.mock('@/shared/lib/download', () => ({
  downloadMediaFile: downloadMocks.downloadMediaFile,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
  },
}))

function prepareStore() {
  resetChatStore()
  setCurrentRoom('!room:localhost')
}

describe('chat side-panel downloads', () => {
  beforeEach(() => {
    prepareStore()
    downloadMocks.downloadMediaFile.mockReset()
    toastMocks.error.mockReset()
    matrixMocks.events = []
  })

  it('shows a localized error when a document download fails', async () => {
    matrixMocks.events = [
      createEvent({
        body: 'brief.pdf',
        info: { mimetype: 'application/pdf', size: 1024 },
        msgtype: 'm.file',
        url: 'mxc://localhost/brief',
      }),
    ]
    downloadMocks.downloadMediaFile.mockRejectedValueOnce(new Error('download failed'))
    const wrapper = mount(ChatDocsList)

    await wrapper.get('button[title="下载"]').trigger('click')
    await flushPromises()

    expect(downloadMocks.downloadMediaFile).toHaveBeenCalledWith('mxc://localhost/brief', 'brief.pdf')
    expect(toastMocks.error).toHaveBeenCalledWith('下载失败')
  })

  it('shows a localized error when a file download fails', async () => {
    matrixMocks.events = [
      createEvent({
        body: 'demo.zip',
        info: { mimetype: 'application/zip', size: 2048 },
        msgtype: 'm.file',
        url: 'mxc://localhost/demo',
      }),
    ]
    downloadMocks.downloadMediaFile.mockRejectedValueOnce(new Error('download failed'))
    const wrapper = mount(ChatFileList)

    await wrapper.get('button[title="下载"]').trigger('click')
    await flushPromises()

    expect(downloadMocks.downloadMediaFile).toHaveBeenCalledWith('mxc://localhost/demo', 'demo.zip')
    expect(toastMocks.error).toHaveBeenCalledWith('下载失败')
  })
})
