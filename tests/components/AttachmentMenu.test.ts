import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AttachmentMenu from '@/features/chat/components/AttachmentMenu.vue'

vi.mock('@/electron/dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@/electron/fs', () => ({
  readFile: vi.fn(),
}))

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
let triggerElement: HTMLElement | null = null

describe('attachmentMenu', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 768,
    })

    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRectMock() {
      const element = this as HTMLElement

      if (element.classList.contains('fixed') && element.classList.contains('z-50')) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 160,
          bottom: 120,
          width: 160,
          height: 120,
          toJSON: () => {},
        }
      }

      if (element === triggerElement) {
        return {
          x: 300,
          y: 500,
          left: 300,
          top: 500,
          right: 328,
          bottom: 528,
          width: 28,
          height: 28,
          toJSON: () => {},
        }
      }

      return originalGetBoundingClientRect.call(this)
    }
  })

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    triggerElement = null
    document.body.innerHTML = ''
  })

  it('positions the attachment panel next to the trigger after opening', async () => {
    const wrapper = mount(AttachmentMenu, {
      attachTo: document.body,
    })
    triggerElement = wrapper.element as HTMLElement

    await wrapper.get('button').trigger('click')
    await nextTick()

    const panel = document.body.querySelector('.fixed.z-50') as HTMLElement | null
    expect(panel).not.toBeNull()
    expect(panel?.style.left).toBe('300px')
    expect(panel?.style.top).toBe('372px')

    wrapper.unmount()
  })
})
