import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FileMessage from '@/features/chat/components/messages/FileMessage.vue'

vi.mock('@matrix/index', () => ({
  downloadMedia: vi.fn(),
}))

vi.mock('@/desktop/dialog', () => ({
  save: vi.fn(),
}))

vi.mock('@/desktop/fs', () => ({
  writeFile: vi.fn(),
}))

vi.mock('@/features/chat/components/ForwardDialog.vue', () => ({
  default: {
    name: 'ForwardDialog',
    props: ['event'],
    emits: ['close'],
    template: '<div data-testid="forward-dialog">Forward dialog</div>',
  },
}))

function createFileEvent() {
  return {
    getContent: () => ({
      body: 'report.pdf',
      url: 'mxc://muon.dev/report',
      info: { size: 2048, mimetype: 'application/pdf' },
    }),
  }
}

describe('fileMessage', () => {
  it('opens the real forward dialog instead of a WIP toast', async () => {
    const wrapper = mount(FileMessage, {
      props: {
        event: createFileEvent(),
      },
    })

    await wrapper.find('[data-testid="file-forward-button"]').trigger('click')

    expect(wrapper.find('[data-testid="forward-dialog"]').exists()).toBe(true)
  })
})
