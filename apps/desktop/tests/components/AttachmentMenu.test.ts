import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AttachmentMenu from '@/features/chat/components/AttachmentMenu.vue'

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
}))

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('@/desktop/dialog', () => ({
  open: dialogMocks.open,
}))

vi.mock('@/desktop/fs', () => ({
  readFile: fsMocks.readFile,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
  },
}))

async function openAttachmentMenu(wrapper: ReturnType<typeof mount<InstanceType<typeof AttachmentMenu>>>) {
  await wrapper.get('button').trigger('click')
  await flushPromises()
}

function getMenuButton(text: string) {
  const button = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
    .find(element => element.textContent?.includes(text))
  expect(button).not.toBeNull()
  return button!
}

describe('attachmentMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    dialogMocks.open.mockReset()
    fsMocks.readFile.mockReset()
    toastMocks.error.mockReset()
  })

  it('keeps file-dialog cancellation quiet', async () => {
    dialogMocks.open.mockResolvedValueOnce(null)
    const wrapper = mount(AttachmentMenu)

    await openAttachmentMenu(wrapper)
    getMenuButton('文件').click()
    await flushPromises()

    expect(fsMocks.readFile).not.toHaveBeenCalled()
    expect(toastMocks.error).not.toHaveBeenCalled()
  })

  it('shows a localized error when the selected attachment cannot be read', async () => {
    dialogMocks.open.mockResolvedValueOnce('/tmp/report.pdf')
    fsMocks.readFile.mockRejectedValueOnce(new Error('permission denied'))
    const wrapper = mount(AttachmentMenu)

    await openAttachmentMenu(wrapper)
    getMenuButton('文件').click()
    await flushPromises()

    expect(fsMocks.readFile).toHaveBeenCalledWith('/tmp/report.pdf')
    expect(toastMocks.error).toHaveBeenCalledWith('上传失败')
    expect(wrapper.emitted('file')).toBeUndefined()
  })
})
