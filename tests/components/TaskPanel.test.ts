import { mount, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ChatWindow from '@/features/chat/components/ChatWindow.vue'
import TaskPanel from '@/features/chat/components/TaskPanel.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'
import { useTaskStore } from '@/features/chat/stores/taskStore'

const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('@matrix/index', () => ({
  loadInboxEventContext: (...args: unknown[]) => loadInboxEventContextMock(...args),
}))

describe('TaskPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
  })

  it('transition task status: renders todo/doing/done and syncs transition to store', async () => {
    const taskStore = useTaskStore()
    taskStore.tasks = [
      {
        id: 'task-1',
        title: 'Todo Task',
        assignee: '@alice:muon.dev',
        dueAt: Date.now() + 60_000,
        status: 'todo',
        sourceRef: { roomId: '!room:muon.dev', eventId: '$event-1' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'task-2',
        title: 'Doing Task',
        assignee: '@bob:muon.dev',
        dueAt: Date.now() + 120_000,
        status: 'doing',
        sourceRef: { roomId: '!room:muon.dev', eventId: '$event-2' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'task-3',
        title: 'Done Task',
        assignee: '@carol:muon.dev',
        dueAt: Date.now() + 180_000,
        status: 'done',
        sourceRef: { roomId: '!room:muon.dev', eventId: '$event-3' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const wrapper = mount(TaskPanel)
    await nextTick()

    expect(wrapper.find('[data-testid="task-column-todo"]').text()).toContain('Todo Task')
    expect(wrapper.find('[data-testid="task-column-doing"]').text()).toContain('Doing Task')
    expect(wrapper.find('[data-testid="task-column-done"]').text()).toContain('Done Task')

    await wrapper.find('[data-testid="task-move-doing-task-1"]').trigger('click')
    await nextTick()

    expect(taskStore.tasks.find(task => task.id === 'task-1')?.status).toBe('doing')
    expect(wrapper.find('[data-testid="task-column-doing"]').text()).toContain('Todo Task')
  })

  it('transition task status: toggles task side panel in ChatWindow', async () => {
    const chatStore = useChatStore()
    const wrapper = shallowMount(ChatWindow, {
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.find('task-panel-stub').exists()).toBe(false)

    chatStore.toggleSidePanel('tasks')
    await nextTick()
    expect(chatStore.activeSidePanel).toBe('tasks')
    expect(wrapper.find('task-panel-stub').exists()).toBe(true)

    chatStore.toggleSidePanel('tasks')
    await nextTick()
    expect(chatStore.activeSidePanel).toBe(null)
  })

  it('jump to source message: preloads context before navigation', async () => {
    const taskStore = useTaskStore()
    taskStore.tasks = [{
      id: 'task-1',
      title: 'Todo Task',
      assignee: '@alice:muon.dev',
      dueAt: Date.now() + 60_000,
      status: 'todo',
      sourceRef: { roomId: '!room:muon.dev', eventId: '$event-1' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }]
    loadInboxEventContextMock.mockResolvedValue({})

    const wrapper = mount(TaskPanel)
    await nextTick()

    await wrapper.find('[data-testid="task-jump-task-1"]').trigger('click')

    expect(loadInboxEventContextMock).toHaveBeenCalledWith('!room:muon.dev', '$event-1')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!room%3Amuon.dev',
      query: {
        focusEventId: '$event-1',
      },
    })
    expect(loadInboxEventContextMock.mock.invocationCallOrder[0]).toBeLessThan(routerPush.mock.invocationCallOrder[0])
  })

  it('jump to source message: falls back to navigation when preload fails', async () => {
    const taskStore = useTaskStore()
    taskStore.tasks = [{
      id: 'task-1',
      title: 'Todo Task',
      assignee: '@alice:muon.dev',
      dueAt: Date.now() + 60_000,
      status: 'todo',
      sourceRef: { roomId: '!room:muon.dev', eventId: '$event-1' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }]
    loadInboxEventContextMock.mockRejectedValue(new Error('network error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mount(TaskPanel)
    await nextTick()

    await wrapper.find('[data-testid="task-jump-task-1"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!room%3Amuon.dev',
      query: {
        focusEventId: '$event-1',
      },
    })
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
