import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DownloadManager from '@/features/chat/components/DownloadManager.vue'
import { useDownloadStore } from '@/features/chat/stores/downloadStore'

const openerMocks = vi.hoisted(() => ({
  openPath: vi.fn(),
  revealItemInDir: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/electron/opener', () => ({
  openPath: openerMocks.openPath,
  revealItemInDir: openerMocks.revealItemInDir,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: openerMocks.toastError,
  },
}))

function seedCompletedDownload() {
  useDownloadStore().items = [{
    id: 'download-1',
    fileName: 'report.pdf',
    url: 'mxc://localhost/report',
    savePath: '/tmp/report.pdf',
    size: 1024,
    downloaded: 1024,
    status: 'completed',
    startedAt: 100,
    completedAt: 200,
  }]
}

describe('download manager localization', () => {
  beforeEach(() => {
    openerMocks.openPath.mockReset()
    openerMocks.revealItemInDir.mockReset()
    openerMocks.toastError.mockReset()
    seedCompletedDownload()
  })

  it('shows localized open failure messages', async () => {
    openerMocks.openPath.mockRejectedValueOnce(new Error('missing file'))
    openerMocks.revealItemInDir.mockRejectedValueOnce(new Error('missing folder'))

    const wrapper = mount(DownloadManager, {
      global: {
        stubs: {
          Progress: true,
        },
      },
    })

    await wrapper.get('button[title="打开文件"]').trigger('click')
    await wrapper.get('button[title="打开文件夹"]').trigger('click')

    expect(openerMocks.toastError).toHaveBeenNthCalledWith(1, '无法打开文件，文件可能已移动或删除')
    expect(openerMocks.toastError).toHaveBeenNthCalledWith(2, '无法打开文件夹')
  })
})
