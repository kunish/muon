import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import MessageActionBar from '@/features/chat/components/MessageActionBar.vue'
import TaskComposerDialog from '@/features/chat/components/TaskComposerDialog.vue'
import { resolveReminderDueAt, useDeferStore } from '@/features/chat/stores/deferStore'
import { useTaskStore } from '@/features/chat/stores/taskStore'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getUserId: vi.fn(() => '@me:localhost'),
  })),
}))

vi.mock('@matrix/index', () => ({
  redactMessage: vi.fn(async () => {}),
}))

vi.mock('@matrix/rooms', () => ({
  isMessagePinned: vi.fn(() => false),
  pinMessage: vi.fn(async () => {}),
  unpinMessage: vi.fn(async () => {}),
}))

function createEventMock() {
  return {
    getSender: () => '@alice:localhost',
    getId: () => '$event-1',
    getContent: () => ({ body: 'hello world' }),
  }
}

describe('MessageActionBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('creates deferred item from more menu and keeps source room/event', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-preset-tomorrow"]').trigger('click')

    const deferStore = useDeferStore()
    expect(deferStore.activeItems.length).toBe(1)
    expect(deferStore.activeItems[0]).toMatchObject({
      roomId: '!room:test',
      eventId: '$event-1',
      status: 'deferred',
    })
  })

  it('uses shared preset/custom defer time logic', async () => {
    const now = new Date('2026-03-05T08:00:00Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)

    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-preset-1h"]').trigger('click')

    const deferStore = useDeferStore()
    expect(deferStore.activeItems.length).toBe(1)
    expect(deferStore.activeItems[0]?.dueAt).toBe(resolveReminderDueAt({ preset: 'in-1-hour' }, now))

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-custom-toggle"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-custom-input"]').setValue('2026-03-06T10:30')
    await wrapper.find('[data-testid="message-defer-custom-submit"]').trigger('click')

    expect(deferStore.activeItems.length).toBe(2)
    const latestItem = deferStore.activeItems[1]
    expect(latestItem).toBeTruthy()
    expect(Math.abs((latestItem?.dueAt ?? 0) - new Date('2026-03-06T10:30:00').getTime())).toBeLessThan(60_000)

    nowSpy.mockRestore()
  })

  it('create task from message opens task composer dialog', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-convert-task-trigger"]').trigger('click')

    expect(document.body.querySelector('[data-testid="task-composer-dialog"]')).not.toBeNull()
  })

  it('create task from message submits assignee/dueAt/status/sourceRef', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    const taskStore = useTaskStore()
    const createTaskSpy = vi.spyOn(taskStore, 'createTask')

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-convert-task-trigger"]').trigger('click')

    const composer = wrapper.findComponent(TaskComposerDialog)
    composer.vm.$emit('submit', {
      title: 'hello world',
      assignee: '@alice:localhost',
      dueAt: '2026-03-06T10:30',
      status: 'todo',
    })
    await nextTick()

    expect(createTaskSpy).toHaveBeenCalledTimes(1)
    expect(createTaskSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: 'hello world',
      assignee: '@alice:localhost',
      dueAt: '2026-03-06T10:30',
      status: 'todo',
      sourceRef: {
        roomId: '!room:test',
        eventId: '$event-1',
      },
    }))
  })

  it('create task from message prevents duplicate submission while pending', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    const taskStore = useTaskStore()
    let resolveCreateTask: ((value: unknown) => void) | null = null
    const createTaskSpy = vi.spyOn(taskStore, 'createTask').mockImplementation(() => {
      return new Promise((resolve) => {
        resolveCreateTask = resolve
      }) as any
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-convert-task-trigger"]').trigger('click')

    const composer = wrapper.findComponent(TaskComposerDialog)
    const payload = {
      title: 'hello world',
      assignee: '@alice:localhost',
      dueAt: '2026-03-06T10:30',
      status: 'todo' as const,
    }
    composer.vm.$emit('submit', payload)
    composer.vm.$emit('submit', payload)
    await nextTick()

    expect(createTaskSpy).toHaveBeenCalledTimes(1)

    createTaskSpy.mockRestore()
  })
})
