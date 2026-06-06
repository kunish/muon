import type { Workflow, WorkflowStatus } from '../types'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { computed } from 'vue'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { projectRepo } from '../db/projectDb'
import { updateItem } from './useWorkItemStore'

const DEFAULT_WORKFLOW: Omit<Workflow, 'projectId'> = {
  id: '',
  statuses: [
    { key: 'todo', name: '待办', color: '#e5e7eb', category: 'todo' as const },
    { key: 'in_progress', name: '进行中', color: '#3b82f6', category: 'in_progress' as const },
    { key: 'done', name: '已完成', color: '#22c55e', category: 'done' as const },
  ],
  transitions: [
    { from: 'todo', to: 'in_progress', name: '开始处理' },
    { from: 'in_progress', to: 'done', name: '完成' },
    { from: 'in_progress', to: 'todo', name: '退回' },
    { from: 'done', to: 'in_progress', name: '重新打开' },
  ],
}

function createDefaultWorkflow(projectId: string): Workflow {
  return {
    ...DEFAULT_WORKFLOW,
    id: crypto.randomUUID(),
    projectId,
  }
}

export function useWorkflow(projectId: () => string) {
  function loadWorkflowEffect(): DesktopEffect<Workflow> {
    return Effect.gen(function* () {
      const pid = projectId()
      const existing = yield* fromPromise(() => projectRepo.getWorkflow(pid))
      if (existing) return existing

      const workflow = createDefaultWorkflow(pid)
      yield* fromPromise(() => projectRepo.saveWorkflow(workflow))
      return workflow
    })
  }

  function loadWorkflow(): Promise<Workflow> {
    return runDesktopEffect(loadWorkflowEffect())
  }

  function saveWorkflowEffect(workflow: Workflow): DesktopEffect<Workflow> {
    return Effect.gen(function* () {
      yield* fromPromise(() => projectRepo.saveWorkflow(workflow))
      return workflow
    })
  }

  function saveWorkflow(workflow: Workflow): Promise<Workflow> {
    return runDesktopEffect(saveWorkflowEffect(workflow))
  }

  function canTransition(wf: Workflow, fromStatus: string, toStatus: string): boolean {
    return wf.transitions.some((t) => t.from === fromStatus && t.to === toStatus)
  }

  function getAvailableTransitions(wf: Workflow, currentStatus: string): string[] {
    return wf.transitions.filter((t) => t.from === currentStatus).map((t) => t.to)
  }

  function changeStatusEffect(itemId: string, toStatus: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      const wf = yield* loadWorkflowEffect()
      const item = yield* fromPromise(() => projectRepo.getWorkItem(itemId))
      if (!item) {
        return yield* fromSync(() => {
          throw new Error('Work item not found')
        })
      }

      if (!canTransition(wf, item.status, toStatus)) {
        return yield* fromSync(() => {
          throw new Error(`Cannot transition from "${item.status}" to "${toStatus}"`)
        })
      }

      yield* fromPromise(() => updateItem(itemId, { status: toStatus }))
    })
  }

  function changeStatus(itemId: string, toStatus: string): Promise<void> {
    return runDesktopEffect(changeStatusEffect(itemId, toStatus))
  }

  const statusesByCategory = computed(() => {
    const grouped: Record<string, WorkflowStatus[]> = { todo: [], in_progress: [], done: [] }
    return grouped
  })

  return {
    loadWorkflowEffect,
    saveWorkflowEffect,
    changeStatusEffect,
    loadWorkflow,
    saveWorkflow,
    canTransition,
    getAvailableTransitions,
    changeStatus,
    statusesByCategory,
    DEFAULT_WORKFLOW,
  }
}
