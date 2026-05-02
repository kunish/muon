import { setAuthMediaResolver } from '@muon/ui/media'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import ContactItem from '@/features/contacts/components/ContactItem.vue'
import ContactList from '@/features/contacts/components/ContactList.vue'
import { useContactStore } from '@/features/contacts/stores/contactStore'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getUserId: vi.fn().mockReturnValue('@me:localhost'),
  })),
}))

describe('contactItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setAuthMediaResolver(async (url: string) => `blob:${url}`)
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

  it('should render contact avatar image when avatarUrl is available', async () => {
    const wrapper = mount(ContactItem, {
      props: {
        contact: {
          userId: '@alice:localhost',
          displayName: 'Alice',
          avatarUrl: 'mxc://localhost/avatar_alice',
          presence: 'online',
        },
        selected: false,
      },
    })

    await vi.dynamicImportSettled()

    const image = wrapper.get('img[alt="Alice"]')
    expect(image.attributes('src')).toBe('blob:mxc://localhost/avatar_alice')
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
    expect(wrapper.classes()).toContain('workspace-row-active')
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

describe('contactList layout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders contacts and groups inside one bounded scroll container', () => {
    const store = useContactStore()
    store.contacts = [
      { userId: '@alice:localhost', displayName: 'Alice', presence: 'online' },
    ]
    store.groups = Array.from({ length: 16 }, (_, index) => ({
      roomId: `!group_${index}:localhost`,
      name: `群组 ${index}`,
      memberCount: index + 3,
    }))

    const wrapper = mount(ContactList)

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['min-h-0', 'flex-col']),
    )

    const scroller = wrapper.get('[data-testid="contacts-list-scroll-container"]')
    expect(scroller.classes()).toEqual(
      expect.arrayContaining(['min-h-0', 'flex-1', 'overflow-y-auto']),
    )
    expect(wrapper.findAll('[data-testid^="contacts-group-row-"]')).toHaveLength(16)
    expect(wrapper.text()).toContain('群组 15')
  })

  it('keeps the search icon and placeholder vertically centered', () => {
    const wrapper = mount(ContactList)

    expect(wrapper.get('[data-testid="contacts-search-control"]').classes()).toEqual(
      expect.arrayContaining(['h-8', 'items-center']),
    )
    expect(wrapper.get('[data-testid="contacts-search-icon"]').classes()).toEqual(
      expect.arrayContaining(['size-4', 'shrink-0']),
    )
    expect(wrapper.get('[data-testid="contacts-search-input"]').classes()).toEqual(
      expect.arrayContaining(['h-full', 'min-w-0', 'leading-5']),
    )
  })
})
