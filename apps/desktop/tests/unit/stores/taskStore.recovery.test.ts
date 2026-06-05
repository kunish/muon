import { beforeEach, describe, expect, it } from 'vitest'
import { createTask, hydrate, resetTaskStore, taskStore, transitionStatus } from '@/features/chat/stores/taskStore'
import { TASK_STORAGE_KEY } from '@/features/chat/types/task'

function seedPersistedTasks(items: unknown[]) {
  localStorage.setItem(
    TASK_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      items,
    }),
  )
}

function createPersistedTask(id: string) {
  return {
    id,
    title: `Task ${id}`,
    assignee: '@alice:example.org',
    dueAt: 1_000,
    status: 'todo',
    sourceRef: {
      roomId: '!room:example.org',
      eventId: `$${id}:example.org`,
    },
    createdAt: 100,
    updatedAt: 100,
  }
}

describe('taskStore recovery continuity', () => {
  beforeEach(() => {
    localStorage.clear()
    resetTaskStore()
  })

  it('repeated hydrate/recovery entry restores persisted tasks exactly once', () => {
    seedPersistedTasks([createPersistedTask('persisted-task')])

    // re-run createInitialState via resetTaskStore to load persisted data
    resetTaskStore()

    // Reset tasks to empty then hydrate twice — should always restore exactly the persisted list
    taskStore.setState((s) => ({ ...s, tasks: [] }))
    hydrate()
    hydrate()

    expect(taskStore.state.tasks.map((task) => task.id)).toEqual(['persisted-task'])
  })

  it('recovery bootstrap filters invalid legacy rows and rewrites a deterministic payload', () => {
    seedPersistedTasks([
      createPersistedTask('persisted-task'),
      {
        id: 'legacy-invalid-task',
        title: 'Legacy invalid',
      },
    ])

    resetTaskStore()

    expect(taskStore.state.tasks.map((task) => task.id)).toEqual(['persisted-task'])

    const persisted = JSON.parse(localStorage.getItem(TASK_STORAGE_KEY) ?? '{}')
    expect(persisted.items).toHaveLength(1)
    expect(persisted.items[0]?.id).toBe('persisted-task')
  })

  it('task creation and status updates still work after recovery hydrate restores persisted tasks', () => {
    seedPersistedTasks([createPersistedTask('persisted-task')])

    resetTaskStore()

    // Reset tasks then re-hydrate to simulate the original test's store.tasks = [] + store.hydrate()
    taskStore.setState((s) => ({ ...s, tasks: [] }))
    hydrate()

    transitionStatus('persisted-task', 'doing')
    createTask({
      id: 'fresh-task',
      title: 'Fresh task',
      assignee: '@bob:example.org',
      dueAt: 2_000,
      sourceRef: {
        roomId: '!room:example.org',
        eventId: '$fresh:example.org',
      },
      now: 200,
    })

    expect(taskStore.state.tasks.map((task) => ({ id: task.id, status: task.status }))).toEqual([
      { id: 'persisted-task', status: 'doing' },
      { id: 'fresh-task', status: 'todo' },
    ])
  })
})
