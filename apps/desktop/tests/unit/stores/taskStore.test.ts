import { beforeEach, describe, expect, it } from 'vitest'
import {
  createTask,
  resetTaskStore,
  selectTasksByStatus,
  taskStore,
  transitionStatus,
} from '@/features/chat/stores/taskStore'
import { TASK_STORAGE_KEY } from '@/features/chat/types/task'

describe('taskStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetTaskStore()
  })

  it('createTask 必须写入 assignee/dueAt/status/sourceRef', () => {
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)
    const task = createTask({
      id: 'task-1',
      title: 'Follow up',
      assignee: '@alice:example.org',
      dueAt: now + 3_600_000,
      sourceRef: {
        roomId: '!room:example.org',
        eventId: '$event:example.org',
      },
      now,
    })

    expect(task.assignee).toBe('@alice:example.org')
    expect(task.dueAt).toBe(now + 3_600_000)
    expect(task.status).toBe('todo')
    expect(task.sourceRef).toEqual({
      roomId: '!room:example.org',
      eventId: '$event:example.org',
    })
  })

  it('transitionStatus 仅接受合法状态迁移', () => {
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)
    createTask({
      id: 'task-2',
      title: 'Follow up',
      assignee: '@alice:example.org',
      dueAt: now + 3_600_000,
      sourceRef: {
        roomId: '!room:example.org',
        eventId: '$event:example.org',
      },
      now,
    })

    transitionStatus('task-2', 'doing')
    transitionStatus('task-2', 'todo')
    transitionStatus('task-2', 'doing')
    transitionStatus('task-2', 'done')

    expect(() => transitionStatus('task-2', 'todo')).toThrowError()
  })

  it('tasksByStatus 三组列表互斥', () => {
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)

    createTask({
      id: 'todo-1',
      title: 'Todo',
      assignee: '@alice:example.org',
      dueAt: now + 1_000,
      sourceRef: { roomId: '!room:example.org', eventId: '$todo' },
      now,
    })
    createTask({
      id: 'doing-1',
      title: 'Doing',
      assignee: '@alice:example.org',
      dueAt: now + 2_000,
      sourceRef: { roomId: '!room:example.org', eventId: '$doing' },
      now,
    })
    createTask({
      id: 'done-1',
      title: 'Done',
      assignee: '@alice:example.org',
      dueAt: now + 3_000,
      sourceRef: { roomId: '!room:example.org', eventId: '$done' },
      now,
    })

    transitionStatus('doing-1', 'doing')
    transitionStatus('done-1', 'doing')
    transitionStatus('done-1', 'done')

    const grouped = selectTasksByStatus(taskStore.state)
    const allIds = new Set([
      ...grouped.todo.map((item) => item.id),
      ...grouped.doing.map((item) => item.id),
      ...grouped.done.map((item) => item.id),
    ])

    expect(grouped.todo.map((item) => item.id)).toContain('todo-1')
    expect(grouped.doing.map((item) => item.id)).toContain('doing-1')
    expect(grouped.done.map((item) => item.id)).toContain('done-1')
    expect(allIds.size).toBe(3)
  })

  it('hydrate 可恢复任务并过滤缺失关键字段的旧数据', () => {
    localStorage.setItem(
      TASK_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        items: [
          {
            id: 'persisted-task',
            title: 'Persisted',
            assignee: '@alice:example.org',
            dueAt: 100,
            status: 'todo',
            sourceRef: { roomId: '!room:example.org', eventId: '$event:persisted' },
            createdAt: 10,
            updatedAt: 10,
          },
          {
            id: 'invalid-task',
            title: 'Invalid',
          },
        ],
      }),
    )

    resetTaskStore()

    expect(taskStore.state.tasks).toHaveLength(1)
    expect(taskStore.state.tasks[0]?.id).toBe('persisted-task')
  })
})
