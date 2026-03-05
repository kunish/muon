import { describe, expect, it } from 'vitest'
import {
  canTransitionTaskStatus,
  createTaskItem,
} from '@/features/chat/types/task'

describe('task contracts (wave 0)', () => {
  it('task item 必含 assignee、dueAt、status、sourceRef', () => {
    const task = createTaskItem({
      id: 'task-1',
      title: 'Follow up',
      assignee: '@alice:example.org',
      dueAt: Date.now() + 3_600_000,
      sourceRef: {
        roomId: '!room:example.org',
        eventId: '$event:example.org',
      },
    })

    expect(task.assignee).toBe('@alice:example.org')
    expect(task.dueAt).toBeGreaterThan(0)
    expect(task.status).toBe('todo')
    expect(task.sourceRef.roomId).toBe('!room:example.org')
    expect(task.sourceRef.eventId).toBe('$event:example.org')
  })

  it('task status 仅允许受控迁移', () => {
    expect(canTransitionTaskStatus('todo', 'doing')).toBe(true)
    expect(canTransitionTaskStatus('doing', 'todo')).toBe(true)
    expect(canTransitionTaskStatus('doing', 'done')).toBe(true)

    expect(canTransitionTaskStatus('todo', 'done')).toBe(false)
    expect(canTransitionTaskStatus('done', 'todo')).toBe(false)
    expect(canTransitionTaskStatus('done', 'doing')).toBe(false)
  })
})
