import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('project view layout', () => {
  it('keeps project detail views constrained to the app shell', () => {
    const page = readSource('src/features/projects/ProjectsPage.vue')
    const detail = readSource('src/features/projects/components/ProjectDetail.vue')

    expect(page).toContain('class="flex h-full min-h-0 min-w-0 flex-1 flex-col"')
    expect(detail).toContain('class="flex h-full min-h-0 min-w-0 flex-1 flex-col"')
    expect(detail).toContain('class="relative min-h-0 min-w-0 flex-1 overflow-hidden"')
    expect(detail).toContain('class="truncate text-lg font-semibold"')
  })

  it('keeps board columns and the task drawer inside the project viewport', () => {
    const board = readSource('src/features/projects/components/view/BoardView.vue')
    const drawer = readSource('src/features/projects/components/WorkItemDetail.vue')

    expect(board).toContain('class="relative h-full min-h-0 min-w-0"')
    expect(board).toContain('class="flex h-full min-h-0 w-full min-w-0 gap-3 overflow-x-auto p-4"')
    expect(board).toContain('class="flex h-full min-w-[18rem] flex-1 basis-72 flex-col rounded-lg bg-muted/50"')
    expect(board).toContain('class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"')
    expect(drawer).toContain('class="absolute inset-y-0 right-0 z-40 flex w-96 max-w-full flex-col')
    expect(drawer).toContain('class="min-h-0 flex-1 overflow-y-auto p-4"')
  })

  it('keeps list and gantt views horizontally stable', () => {
    const list = readSource('src/features/projects/components/view/ListView.vue')
    const gantt = readSource('src/features/projects/components/view/GanttView.vue')

    expect(list).toContain('class="min-h-0 flex-1 overflow-auto"')
    expect(list).toContain('class="min-w-[720px] w-full"')
    expect(list).toContain('class="sticky top-0 z-10 bg-background"')
    expect(gantt).toContain('const titleColumnWidth = 256')
    expect(gantt).toMatch(/width: `\$\{titleColumnWidth \+ totalDays\(\) \* columnWidth\}px`/)
    expect(gantt).toContain('class="sticky top-0 z-10 flex shrink-0 border-b bg-background text-xs"')
  })
})
