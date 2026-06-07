import type { Report, ReportType } from '../types/report'
import { Store } from '@tanstack/vue-store'
import { generateReportId, hasContent, isValidReport, REPORTS_STORAGE_KEY } from '../types/report'

interface PersistedReportState {
  version: 1
  reports: Report[]
}

interface LoadedReportState {
  reports: Report[]
  normalized: boolean
}

interface AddReportInput {
  id?: string
  type: ReportType
  periodKey: string
  recipient?: string
  now?: number
}

function normalizePersistedReports(reports: unknown[]): LoadedReportState {
  const deduped = new Map<string, Report>()
  let normalized = false

  for (const report of reports) {
    if (!isValidReport(report)) {
      normalized = true
      continue
    }
    if (deduped.has(report.id)) normalized = true
    deduped.set(report.id, report)
  }

  return { reports: [...deduped.values()], normalized }
}

function loadState(): LoadedReportState {
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY)
    if (!raw) return { reports: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedReportState>
    if (parsed.version !== 1 || !Array.isArray(parsed.reports)) return { reports: [], normalized: false }

    return normalizePersistedReports(parsed.reports)
  } catch {
    return { reports: [], normalized: false }
  }
}

function persistReports(reports: Report[]): void {
  const payload: PersistedReportState = { version: 1, reports }
  try {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[reportStore] Failed to persist reports:', err)
  }
}

export interface ReportState {
  reports: Report[]
  hydrated: boolean
}

function createInitialState(): ReportState {
  const { reports, normalized } = loadState()
  if (normalized) persistReports(reports)
  return { reports, hydrated: true }
}

export const reportStore = new Store<ReportState>(createInitialState())

export function selectReports(state: ReportState): Report[] {
  return state.reports
}

export function hydrate(): void {
  const { reports, normalized } = loadState()
  reportStore.setState((s) => ({ ...s, reports, hydrated: true }))
  if (normalized) persistReports(reports)
}

function commit(reports: Report[]): void {
  reportStore.setState((s) => ({ ...s, reports }))
  persistReports(reportStore.state.reports)
}

function mapReport(id: string, fn: (report: Report) => Report): void {
  commit(reportStore.state.reports.map((report) => (report.id === id ? fn(report) : report)))
}

export function addReport(input: AddReportInput): Report {
  const now = input.now ?? Date.now()
  const report: Report = {
    id: input.id ?? generateReportId(now),
    type: input.type,
    periodKey: input.periodKey,
    content: {},
    recipient: input.recipient?.trim() || '直属上级',
    createdAt: now,
  }
  if (!isValidReport(report)) throw new Error('Invalid report')

  commit([report, ...reportStore.state.reports])
  return report
}

export function setSection(id: string, sectionKey: string, value: string): void {
  mapReport(id, (report) => ({ ...report, content: { ...report.content, [sectionKey]: value } }))
}

export function setRecipient(id: string, recipient: string): void {
  mapReport(id, (report) => ({ ...report, recipient: recipient.trim() || report.recipient }))
}

/** 提交汇报：内容全空时抛错；否则记录提交时间。 */
export function submitReport(id: string, now = Date.now()): void {
  const report = reportStore.state.reports.find((item) => item.id === id)
  if (!report) return
  if (!hasContent(report)) throw new Error('Empty report')
  mapReport(id, (item) => ({ ...item, submittedAt: now }))
}

/** 撤回提交，回到草稿。 */
export function withdrawReport(id: string): void {
  mapReport(id, (report) => {
    if (report.submittedAt === undefined) return report
    const { submittedAt: _omit, ...rest } = report
    return rest
  })
}

export function removeReport(id: string): void {
  const next = reportStore.state.reports.filter((report) => report.id !== id)
  if (next.length === reportStore.state.reports.length) return
  commit(next)
}

export function resetReportStore(): void {
  reportStore.setState(() => createInitialState())
}
