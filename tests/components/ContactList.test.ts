import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import ContactItem from '@/features/contacts/components/ContactItem.vue'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getUserId: vi.fn().mockReturnValue('@me:localhost'),
  })),
}))

describe('contactItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should render contact display name', () => {
    const wrapper = mount(ContactItem, {
      props: {
        contact: {
          userId: '@alice:localhost',
          displayName: 'Alice',
          presence: 'online',
        },
        selected: false,
      },
    })
    expect(wrapper.text()).toContain('Alice')
  })

  it('should show online indicator', () => {
    const wrapper = mount(ContactItem, {
      props: {
        contact: {
          userId: '@alice:localhost',
          displayName: 'Alice',
          presence: 'online',
        },
        selected: false,
      },
    })
    expect(wrapper.find('.bg-success').exists()).toBe(true)
  })

  it('should apply selected style', () => {
    const wrapper = mount(ContactItem, {
      props: {
        contact: {
          userId: '@alice:localhost',
          displayName: 'Alice',
          presence: 'offline',
        },
        selected: true,
      },
    })
    expect(wrapper.find('.bg-accent').exists()).toBe(true)
  })

  it('should emit click event', async () => {
    const wrapper = mount(ContactItem, {
      props: {
        contact: {
          userId: '@alice:localhost',
          displayName: 'Alice',
          presence: 'online',
        },
        selected: false,
      },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
