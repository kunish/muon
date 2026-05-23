import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShareDialog from '@/features/docs/components/collaboration/ShareDialog.vue'

const matrixMocks = vi.hoisted(() => ({
  invite: vi.fn(),
  searchUserDirectory: vi.fn(),
}))

const contactListState = vi.hoisted(() => ({
  contacts: [] as Array<{ userId: string; displayName: string; avatarUrl?: string; presence: string }>,
  ensureContactsLoaded: vi.fn(),
}))

const clipboardMocks = vi.hoisted(() => ({
  writeText: vi.fn(),
}))

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getDomain: () => 'localhost',
    invite: matrixMocks.invite,
    searchUserDirectory: matrixMocks.searchUserDirectory,
  }),
}))

vi.mock('@shared/composables/useContactList', () => ({
  useContactList: () => ({
    get contacts() {
      return contactListState.contacts
    },
    ensureContactsLoaded: contactListState.ensureContactsLoaded,
  }),
}))

function mountDialog() {
  return mount(ShareDialog, {
    props: {
      docId: '!doc:localhost',
      docTitle: '产品评审',
    },
  })
}

describe('shareDialog', () => {
  beforeEach(() => {
    matrixMocks.invite.mockReset()
    matrixMocks.invite.mockResolvedValue(undefined)
    matrixMocks.searchUserDirectory.mockReset()
    matrixMocks.searchUserDirectory.mockResolvedValue({ results: [] })
    contactListState.contacts = []
    contactListState.ensureContactsLoaded.mockReset()
    clipboardMocks.writeText.mockReset()
    clipboardMocks.writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardMocks.writeText,
      },
    })
  })

  it('invites an explicit Matrix user to the document room', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="doc-share-invite-input"]').setValue('@alice:localhost')
    await wrapper.get('[data-testid="doc-share-invite-form"]').trigger('submit')
    await flushPromises()

    expect(matrixMocks.invite).toHaveBeenCalledWith('!doc:localhost', '@alice:localhost')
    expect(wrapper.get('[data-testid="doc-share-status"]').text()).toContain('已邀请 @alice:localhost')
    expect(wrapper.get('[data-testid="doc-share-invited-users"]').text()).toContain('@alice:localhost')
  })

  it('resolves directory search results before inviting', async () => {
    matrixMocks.searchUserDirectory.mockResolvedValueOnce({
      results: [{ user_id: '@alice:localhost', display_name: 'Alice' }],
    })
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="doc-share-invite-input"]').setValue('Alice')
    await flushPromises()

    expect(matrixMocks.searchUserDirectory).toHaveBeenCalledWith({ term: 'Alice', limit: 8 })
    await wrapper.get('[data-testid="doc-share-option-@alice:localhost"]').trigger('click')
    expect(wrapper.get('[data-testid="doc-share-selected-user"]').text()).toContain('Alice')

    await wrapper.get('[data-testid="doc-share-invite-form"]').trigger('submit')
    await flushPromises()

    expect(matrixMocks.invite).toHaveBeenCalledWith('!doc:localhost', '@alice:localhost')
  })

  it('lets users select an existing contact before inviting', async () => {
    contactListState.contacts = [
      { userId: '@alice:localhost', displayName: 'Alice', avatarUrl: 'mxc://localhost/alice', presence: 'online' },
      { userId: '@bob:localhost', displayName: 'Bob', presence: 'offline' },
    ]
    const wrapper = mountDialog()

    expect(contactListState.ensureContactsLoaded).toHaveBeenCalled()
    await wrapper.get('[data-testid="doc-share-invite-input"]').trigger('focus')

    expect(wrapper.get('[data-testid="doc-share-options"]').text()).toContain('Alice')
    await wrapper.get('[data-testid="doc-share-option-@alice:localhost"]').trigger('click')
    expect(wrapper.get('[data-testid="doc-share-selected-user"]').text()).toContain('Alice')

    await wrapper.get('[data-testid="doc-share-invite-form"]').trigger('submit')
    await flushPromises()

    expect(matrixMocks.invite).toHaveBeenCalledWith('!doc:localhost', '@alice:localhost')
  })

  it('invites multiple selected contacts together', async () => {
    contactListState.contacts = [
      { userId: '@alice:localhost', displayName: 'Alice', presence: 'online' },
      { userId: '@bob:localhost', displayName: 'Bob', presence: 'offline' },
    ]
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="doc-share-invite-input"]').trigger('focus')
    await wrapper.get('[data-testid="doc-share-option-@alice:localhost"]').trigger('click')
    await wrapper.get('[data-testid="doc-share-option-@bob:localhost"]').trigger('click')

    expect(wrapper.get('[data-testid="doc-share-selected-user"]').text()).toContain('Alice')
    expect(wrapper.get('[data-testid="doc-share-selected-user"]').text()).toContain('Bob')

    await wrapper.get('[data-testid="doc-share-invite-form"]').trigger('submit')
    await flushPromises()

    expect(matrixMocks.invite).toHaveBeenCalledWith('!doc:localhost', '@alice:localhost')
    expect(matrixMocks.invite).toHaveBeenCalledWith('!doc:localhost', '@bob:localhost')
    expect(wrapper.get('[data-testid="doc-share-status"]').text()).toBe('已邀请 2 位协作者')
    expect(wrapper.get('[data-testid="doc-share-invited-users"]').text()).toContain('@alice:localhost')
    expect(wrapper.get('[data-testid="doc-share-invited-users"]').text()).toContain('@bob:localhost')
  })

  it('requires a directory result to be selected before inviting', async () => {
    matrixMocks.searchUserDirectory.mockResolvedValueOnce({
      results: [{ user_id: '@alice:localhost', display_name: 'Alice' }],
    })
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="doc-share-invite-input"]').setValue('Alice')
    await flushPromises()
    await wrapper.get('[data-testid="doc-share-invite-form"]').trigger('submit')
    await flushPromises()

    expect(matrixMocks.invite).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="doc-share-status"]').text()).toBe('请选择要邀请的协作者')
  })

  it('shows a visible invite failure state', async () => {
    matrixMocks.invite.mockRejectedValueOnce(new Error('denied'))
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="doc-share-invite-input"]').setValue('@alice:localhost')
    await wrapper.get('[data-testid="doc-share-invite-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="doc-share-status"]').text()).toBe('邀请失败，请稍后重试')
  })

  it('copies a stable document link and reports copy failures', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="doc-share-copy-link"]').trigger('click')
    await flushPromises()
    expect(clipboardMocks.writeText).toHaveBeenCalledWith('http://localhost:3000/docs/!doc%3Alocalhost')

    clipboardMocks.writeText.mockRejectedValueOnce(new Error('permission denied'))
    await wrapper.get('[data-testid="doc-share-copy-link"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('链接复制失败')
  })
})
