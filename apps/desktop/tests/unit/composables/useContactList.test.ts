import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useContactList } from '@/shared/composables/useContactList'

const loadContactsMock = vi.fn()
const loadGroupsMock = vi.fn()

vi.mock('@/features/contacts/queries/contactsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/contacts/queries/contactsApi')>()),
  loadContacts: () => loadContactsMock(),
  loadGroups: () => loadGroupsMock(),
}))

beforeEach(() => {
  loadContactsMock.mockReset()
  loadGroupsMock.mockReset()
  loadGroupsMock.mockResolvedValue([])
})

describe('useContactList facade reactivity', () => {
  // Guards the facade's getter shape: a consumer computed/render must re-run when
  // the underlying vue-query data arrives. The getter reads `query.contacts.value`
  // inside the consumer's tracking scope, so the ComputedRef is tracked as a dep.
  it('reactively reflects contacts once the query resolves', async () => {
    loadContactsMock.mockResolvedValue([{ userId: '@a:localhost', displayName: 'Alice', presence: 'offline' }])

    const Probe = defineComponent({
      setup() {
        const contactList = useContactList()
        return () => h('div', { 'data-testid': 'names' }, contactList.contacts.map((c) => c.displayName).join(','))
      },
    })

    const wrapper = mount(Probe)
    // Auto-fetch is in flight: the list is still empty on first render.
    expect(wrapper.get('[data-testid="names"]').text()).toBe('')

    await flushPromises()

    // The query resolved; the consumer re-rendered through the facade getter.
    expect(wrapper.get('[data-testid="names"]').text()).toBe('Alice')
  })
})
