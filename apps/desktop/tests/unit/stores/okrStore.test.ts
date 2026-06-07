import { beforeEach, describe, expect, it } from 'vitest'
import {
  addKeyResult,
  addObjective,
  checkIn,
  okrStore,
  removeObjective,
  resetOkrStore,
  setAlignment,
  setKeyResultProgress,
} from '@/features/okr/stores/okrStore'
import { objectiveProgress, OKR_STORAGE_KEY } from '@/features/okr/types/okr'

describe('okrStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetOkrStore()
  })

  it('starts empty without any seeded mock objectives', () => {
    expect(okrStore.state.objectives).toEqual([])
  })

  it('persists a created objective with its key results across a reload', () => {
    const objective = addObjective({
      id: 'objective-1',
      period: '2026-Q2',
      title: '打造领先的桌面端协作体验',
      owner: '客户端团队',
      keyResults: [{ title: '崩溃率 < 0.1%' }, { title: '周活提升 20%' }],
    })

    expect(objective.confidence).toBe('medium')
    expect(objective.keyResults).toHaveLength(2)
    expect(okrStore.state.objectives).toHaveLength(1)

    // resetOkrStore re-hydrates from localStorage, simulating a reload
    resetOkrStore()
    expect(okrStore.state.objectives).toHaveLength(1)
    expect(okrStore.state.objectives[0]).toMatchObject({
      id: 'objective-1',
      period: '2026-Q2',
      title: '打造领先的桌面端协作体验',
      owner: '客户端团队',
    })
    expect(okrStore.state.objectives[0].keyResults).toHaveLength(2)
  })

  it('defaults owner to 我 when none provided', () => {
    const objective = addObjective({ period: '2026-Q2', title: '专注体验打磨' })
    expect(objective.owner).toBe('我')
  })

  it('rejects an objective with an empty title', () => {
    expect(() => addObjective({ period: '2026-Q2', title: '   ' })).toThrow()
    expect(okrStore.state.objectives).toEqual([])
  })

  it('rejects an objective with an invalid period', () => {
    expect(() => addObjective({ period: '2026-05', title: '季度目标' })).toThrow()
    expect(okrStore.state.objectives).toEqual([])
  })

  it('computes objective progress as the average of key-result progress', () => {
    const objective = addObjective({
      id: 'objective-avg',
      period: '2026-Q2',
      title: '提升交付质量',
      keyResults: [
        { title: 'KR1', progress: 80 },
        { title: 'KR2', progress: 40 },
      ],
    })
    expect(objectiveProgress(objective)).toBe(60)
  })

  it('reports zero progress for an objective without key results', () => {
    const objective = addObjective({ id: 'objective-empty', period: '2026-Q2', title: '探索性目标' })
    expect(objectiveProgress(objective)).toBe(0)
  })

  it('clamps key-result progress to 0–100 and marks 100% as done', () => {
    addObjective({ id: 'objective-2', period: '2026-Q2', title: '稳定性目标', keyResults: [{ title: 'KR' }] })
    const krId = okrStore.state.objectives[0].keyResults[0].id

    setKeyResultProgress('objective-2', krId, 150)
    expect(okrStore.state.objectives[0].keyResults[0].progress).toBe(100)
    expect(okrStore.state.objectives[0].keyResults[0].status).toBe('done')

    setKeyResultProgress('objective-2', krId, -20)
    expect(okrStore.state.objectives[0].keyResults[0].progress).toBe(0)
  })

  it('appends a key result and persists it', () => {
    addObjective({ id: 'objective-3', period: '2026-Q2', title: '增长目标' })
    addKeyResult('objective-3', { title: '新增注册 +30%' })

    resetOkrStore()
    expect(okrStore.state.objectives[0].keyResults).toHaveLength(1)
    expect(okrStore.state.objectives[0].keyResults[0].title).toBe('新增注册 +30%')
  })

  it('records a check-in by updating confidence and note', () => {
    addObjective({ id: 'objective-4', period: '2026-Q2', title: '协作效率目标' })
    checkIn('objective-4', 'high', '本周完成关键链路联调')

    resetOkrStore()
    expect(okrStore.state.objectives[0].confidence).toBe('high')
    expect(okrStore.state.objectives[0].lastCheckIn).toBe('本周完成关键链路联调')
  })

  it('removes an objective and persists the removal', () => {
    addObjective({ id: 'objective-5', period: '2026-Q2', title: '临时目标' })
    removeObjective('objective-5')

    resetOkrStore()
    expect(okrStore.state.objectives).toEqual([])
  })

  it('drops invalid persisted objectives when hydrating', () => {
    localStorage.setItem(
      OKR_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        objectives: [
          {
            id: 'good',
            period: '2026-Q2',
            title: 'Valid',
            owner: '我',
            confidence: 'medium',
            keyResults: [],
            createdAt: 1,
          },
          {
            id: 'bad',
            period: 'not-a-period',
            title: 'Broken',
            owner: '我',
            confidence: 'medium',
            keyResults: [],
            createdAt: 2,
          },
        ],
      }),
    )

    resetOkrStore()
    expect(okrStore.state.objectives).toHaveLength(1)
    expect(okrStore.state.objectives[0].id).toBe('good')
  })

  function objectiveById(id: string) {
    return okrStore.state.objectives.find((objective) => objective.id === id)
  }

  it('aligns an objective to a parent and persists it', () => {
    addObjective({ id: 'parent', period: '2026-Q2', title: '公司目标' })
    addObjective({ id: 'child', period: '2026-Q2', title: '团队目标' })

    setAlignment('child', 'parent')
    resetOkrStore()
    expect(objectiveById('child')?.alignsTo).toBe('parent')
  })

  it('clears alignment when passed null, empty, or self', () => {
    addObjective({ id: 'parent', period: '2026-Q2', title: '公司目标' })
    addObjective({ id: 'child', period: '2026-Q2', title: '团队目标' })
    setAlignment('child', 'parent')

    setAlignment('child', null)
    expect(objectiveById('child')?.alignsTo).toBeUndefined()

    setAlignment('child', 'parent')
    setAlignment('child', 'child') // 自身视为清除
    expect(objectiveById('child')?.alignsTo).toBeUndefined()
  })

  it('rejects aligning to an unknown objective', () => {
    addObjective({ id: 'child', period: '2026-Q2', title: '团队目标' })
    setAlignment('child', 'ghost')
    expect(objectiveById('child')?.alignsTo).toBeUndefined()
  })

  it('rejects an alignment that would create a cycle', () => {
    addObjective({ id: 'a', period: '2026-Q2', title: 'A' })
    addObjective({ id: 'b', period: '2026-Q2', title: 'B' })
    setAlignment('b', 'a') // b → a

    setAlignment('a', 'b') // a → b would form a cycle, rejected
    expect(objectiveById('a')?.alignsTo).toBeUndefined()
  })

  it('clears dangling alignment when the parent objective is removed', () => {
    addObjective({ id: 'parent', period: '2026-Q2', title: '公司目标' })
    addObjective({ id: 'child', period: '2026-Q2', title: '团队目标' })
    setAlignment('child', 'parent')

    removeObjective('parent')
    resetOkrStore()
    expect(objectiveById('child')?.alignsTo).toBeUndefined()
  })
})
