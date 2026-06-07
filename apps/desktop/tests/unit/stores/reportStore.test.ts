import { beforeEach, describe, expect, it } from 'vitest'
import {
  addReport,
  removeReport,
  reportStore,
  resetReportStore,
  setRecipient,
  setSection,
  submitReport,
  withdrawReport,
} from '@/features/reports/stores/reportStore'
import { isSubmitted, REPORTS_STORAGE_KEY } from '@/features/reports/types/report'

function onlyReport() {
  return reportStore.state.reports[0]
}

describe('reportStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetReportStore()
  })

  it('starts empty without any seeded mock reports', () => {
    expect(reportStore.state.reports).toEqual([])
  })

  it('creates a draft report with empty content and a default recipient', () => {
    const report = addReport({ type: 'daily', periodKey: '2026-06-07' })

    expect(report.content).toEqual({})
    expect(report.recipient).toBe('直属上级')
    expect(isSubmitted(report)).toBe(false)

    resetReportStore()
    expect(onlyReport()).toMatchObject({ type: 'daily', periodKey: '2026-06-07' })
  })

  it('refuses to submit an empty report', () => {
    const report = addReport({ type: 'daily', periodKey: '2026-06-07' })
    expect(() => submitReport(report.id)).toThrow('Empty report')
    expect(isSubmitted(onlyReport())).toBe(false)
  })

  it('submits once content is filled and persists the submission', () => {
    const report = addReport({ type: 'weekly', periodKey: '2026-06-07' })
    setSection(report.id, 'summary', '完成考勤模块')
    submitReport(report.id, 1_700_000_000_000)

    resetReportStore()
    expect(isSubmitted(onlyReport())).toBe(true)
    expect(onlyReport().submittedAt).toBe(1_700_000_000_000)
    expect(onlyReport().content.summary).toBe('完成考勤模块')
  })

  it('withdraws a submitted report back to draft', () => {
    const report = addReport({ type: 'daily', periodKey: '2026-06-07' })
    setSection(report.id, 'done', '写完日报')
    submitReport(report.id)
    expect(isSubmitted(onlyReport())).toBe(true)

    withdrawReport(report.id)
    resetReportStore()
    expect(isSubmitted(onlyReport())).toBe(false)
    expect(onlyReport().submittedAt).toBeUndefined()
  })

  it('updates the recipient and keeps a non-empty fallback', () => {
    const report = addReport({ type: 'daily', periodKey: '2026-06-07' })
    setRecipient(report.id, '张三')
    expect(onlyReport().recipient).toBe('张三')

    setRecipient(report.id, '   ')
    expect(onlyReport().recipient).toBe('张三')
  })

  it('removes a report and persists the removal', () => {
    const report = addReport({ type: 'daily', periodKey: '2026-06-07' })
    removeReport(report.id)

    resetReportStore()
    expect(reportStore.state.reports).toEqual([])
  })

  it('drops invalid persisted reports when hydrating', () => {
    localStorage.setItem(
      REPORTS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        reports: [
          { id: 'good', type: 'daily', periodKey: '2026-06-07', content: { done: 'x' }, recipient: '我', createdAt: 1 },
          { id: 'bad', type: 'monthly', periodKey: '2026-06-07', content: {}, recipient: '我', createdAt: 2 },
        ],
      }),
    )

    resetReportStore()
    expect(reportStore.state.reports).toHaveLength(1)
    expect(reportStore.state.reports[0].id).toBe('good')
  })
})
