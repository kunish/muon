import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createTask, resetTaskStore } from '@/features/chat/stores/taskStore'
import TasksPage from '@/features/tasks/components/TasksPage.vue'

const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.value }),
  useRouter: () => ({ push: vi.fn() }),
}))

function seedTask(id: string, title: string) {
  return createTask({
    id,
    title,
    assignee: '@me:muon.dev',
    dueAt: 1_700_000_000_000,
    sourceRef: { roomId: '!room:muon.dev', eventId: `$${id}` },
    now: 1_700_000_000_000,
  })
}

describe('tasksPage focus deep-link', () => {
  beforeEach(() => {
    localStorage.clear()
    resetTaskStore()
    routeQuery.value = {}
  })

  it('highlights the task card named by ?focus on mount', async () => {
    seedTask('task-focus-1', 'Nebula 联调')
    seedTask('task-other', '其他任务')
    routeQuery.value = { focus: 'task-focus-1' }

    const wrapper = mount(TasksPage)
    await nextTick()

    const focused = wrapper.find('[data-testid="tasks-item-task-focus-1"]')
    const other = wrapper.find('[data-testid="tasks-item-task-other"]')
    expect(focused.classes()).toContain('border-primary')
    expect(other.classes()).not.toContain('border-primary')
  })

  it('highlights nothing when ?focus does not match', async () => {
    seedTask('task-1', '任务一')
    routeQuery.value = { focus: 'no-such-task' }

    const wrapper = mount(TasksPage)
    await nextTick()

    expect(wrapper.find('[data-testid="tasks-item-task-1"]').classes()).not.toContain('border-primary')
  })
})
