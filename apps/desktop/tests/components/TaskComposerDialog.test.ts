import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskComposerDialog from '@/features/chat/components/TaskComposerDialog.vue'
import { useContactStore } from '@/features/contacts/stores/contactStore'

vi.mock('@matrix/media', () => ({
  fetchMediaBlobUrl: vi.fn(async (url: string) => `blob:${url}`),
}))

function seedContacts() {
  const store = useContactStore()
  store.contacts = [
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
