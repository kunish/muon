import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskComposerDialog from '@/features/chat/components/TaskComposerDialog.vue'
import { resetContactStore } from '@/features/contacts/stores/contactStore'

const contactsSeed = vi.hoisted(() => ({ contacts: [] as any[], groups: [] as any[] }))
vi.mock('@/features/contacts/queries/useContacts', () => ({
  useContactsQuery: () => ({
    contacts: {
      get value() {
        return contactsSeed.contacts
      },
    },
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
  useGroupsQuery: () => ({
    groups: {
      get value() {
        return contactsSeed.groups
      },
    },
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@matrix/media', () => ({
  fetchMediaBlobUrl: vi.fn(async (url: string) => `blob:${url}`),
}))

function seedContacts() {
  contactsSeed.contacts = [
    { userId: '@alice:localhost', displayName: 'Alice Chen', presence: 'online' },
    { userId: '@bob:localhost', displayName: 'Bob Li', presence: 'offline' },
  ]
}

function mountDialog() {
  return mount(TaskComposerDialog, {
    props: {
      open: true,
      initialTitle: '跟进上线风险',
    },
    global: {
      stubs: {
        Teleport: true,
      },
    },
  })
}

describe('task composer dialog', () => {
  beforeEach(() => {
    resetContactStore()
    localStorage.clear()
    contactsSeed.contacts = []
    contactsSeed.groups = []
    seedContacts()
  })

  it('selects a single assignee from contacts before submitting the task', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="group-member-row-@alice:localhost"]').trigger('click')
    await wrapper.get('[data-testid="group-member-row-@bob:localhost"]').trigger('click')
    await wrapper.get('[data-testid="task-due-at-input"]').setValue('2026-05-08T10:30')
    await wrapper.get('[data-testid="task-submit"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          title: '跟进上线风险',
          assignee: '@bob:localhost',
          dueAt: '2026-05-08T10:30',
          status: 'todo',
        },
      ],
    ])
  })
})
