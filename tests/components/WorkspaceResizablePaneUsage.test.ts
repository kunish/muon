import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ContactsPage from '@/features/contacts/components/ContactsPage.vue'
import SettingsPage from '@/features/settings/components/SettingsPage.vue'

const push = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/settings', query: {} }),
  useRouter: () => ({ push, replace }),
}))

describe('workspace resizable pane usage', () => {
  beforeEach(() => {
    localStorage.clear()
    push.mockReset()
    replace.mockReset()
  })

  it('lets the contacts sidebar use the shared draggable pane container', async () => {
    const wrapper = mount(ContactsPage, {
      global: {
        stubs: {
          ContactList: { template: '<div data-testid="contact-list-stub" />' },
          CreateGroupDialog: true,
          GroupSettings: true,
          UserProfile: true,
        },
      },
    })
    const pane = wrapper.get('[data-testid="contacts-sidebar"]')
    const handle = wrapper.get('[data-testid="contacts-sidebar-resize-handle"]')

    expect(pane.attributes('style')).toContain('width: 308px')

    handle.element.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 308,
    }))
    await nextTick()

    window.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 356,
    }))
    await nextTick()

    expect(pane.attributes('style')).toContain('width: 356px')
    expect(handle.attributes('aria-valuenow')).toBe('356')
    expect(localStorage.getItem('muon_contacts_sidebar_width')).toBe('356')

    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
  })

  it('lets the settings sidebar use the shared draggable pane container', async () => {
    const wrapper = mount(SettingsPage, {
      global: {
        stubs: {
          AboutPage: true,
          AppearanceSettings: true,
          GeneralSettings: true,
          NotificationSettings: true,
          ProfileSettings: true,
          SecuritySettings: true,
          ShortcutSettings: true,
        },
      },
    })
    const pane = wrapper.get('[data-testid="settings-sidebar"]')
    const handle = wrapper.get('[data-testid="settings-sidebar-resize-handle"]')

    expect(pane.attributes('style')).toContain('width: 260px')

    handle.element.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 260,
    }))
    await nextTick()

    window.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 324,
    }))
    await nextTick()

    expect(pane.attributes('style')).toContain('width: 324px')
    expect(handle.attributes('aria-valuenow')).toBe('324')
    expect(localStorage.getItem('muon_settings_sidebar_width')).toBe('324')

    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
  })
})
