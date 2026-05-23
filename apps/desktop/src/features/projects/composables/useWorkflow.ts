import type { Workflow, WorkflowStatus } from '../types'
import { computed } from 'vue'
import { projectRepo } from '../db/projectDb'
import { useWorkItemStore } from './useWorkItemStore'

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
  const itemStore = useWorkItemStore()

  async function loadWorkflow(): Promise<Workflow> {
    const pid = projectId()
    let wf = await projectRepo.getWorkflow(pid)
    if (!wf) {
      wf = createDefaultWorkflow(pid)
      await projectRepo.saveWorkflow(wf)
    }
    return wf
  }

  async function saveWorkflow(workflow: Workflow): Promise<Workflow> {
    await projectRepo.saveWorkflow(workflow)
    return workflow
  }

  function canTransition(wf: Workflow, fromStatus: string, toStatus: string): boolean {
    return wf.transitions.some(t => t.from === fromStatus && t.to === toStatus)
  }

  function getAvailableTransitions(wf: Workflow, currentStatus: string): string[] {
    return wf.transitions
      .filter(t => t.from === currentStatus)
      .map(t => t.to)
  }

  async function changeStatus(itemId: string, toStatus: string): Promise<void> {
    const wf = await loadWorkflow()
    const item = await projectRepo.getWorkItem(itemId)
    if (!item)
      throw new Error('Work item not found')

    if (!canTransition(wf, item.status, toStatus)) {
      throw new Error(`Cannot transition from "${item.status}" to "${toStatus}"`)
    }

    await itemStore.updateItem(itemId, { status: toStatus })
  }

  const statusesByCategory = computed(() => {
    const grouped: Record<string, WorkflowStatus[]> = { todo: [], in_progress: [], done: [] }
    return grouped
  })

  return {
    loadWorkflow,
    saveWorkflow,
    canTransition,
    getAvailableTransitions,
    changeStatus,
    statusesByCategory,
    DEFAULT_WORKFLOW,
  }
}
