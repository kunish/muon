export const REPORTS_STORAGE_KEY = 'muon.reports.v1'

/** 汇报类型：日报 / 周报 */
export type ReportType = 'daily' | 'weekly'

export interface ReportSection {
  key: string
  /** i18n key for the section label */
  labelKey: string
  /** i18n key for the textarea placeholder */
  placeholderKey: string
}

export interface Report {
  id: string
  type: ReportType
  /** 周期：日报=当天 YYYY-MM-DD；周报=当周内任一日期（按当周呈现） */
  periodKey: string
  /** 按 section key 索引的正文 */
  content: Record<string, string>
  /** 汇报对象 */
  recipient: string
  /** 提交时间戳；未设表示草稿 */
  submittedAt?: number
  createdAt: number
}

export const REPORT_TYPES: readonly ReportType[] = ['daily', 'weekly']

const DAILY_SECTIONS: ReportSection[] = [
  { key: 'done', labelKey: 'reports.sec_done_label', placeholderKey: 'reports.sec_done_ph' },
  { key: 'plan', labelKey: 'reports.sec_plan_daily_label', placeholderKey: 'reports.sec_plan_daily_ph' },
  { key: 'blocker', labelKey: 'reports.sec_blocker_label', placeholderKey: 'reports.sec_blocker_ph' },
]

const WEEKLY_SECTIONS: ReportSection[] = [
  { key: 'summary', labelKey: 'reports.sec_summary_label', placeholderKey: 'reports.sec_summary_ph' },
  { key: 'plan', labelKey: 'reports.sec_plan_weekly_label', placeholderKey: 'reports.sec_plan_weekly_ph' },
  { key: 'risk', labelKey: 'reports.sec_risk_label', placeholderKey: 'reports.sec_risk_ph' },
]

export function sectionsFor(type: ReportType): ReportSection[] {
  return type === 'daily' ? DAILY_SECTIONS : WEEKLY_SECTIONS
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidReportType(value: unknown): value is ReportType {
  return typeof value === 'string' && REPORT_TYPES.includes(value as ReportType)
}

export function isValidReport(value: unknown): value is Report {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Report>
  if (
    typeof candidate.id !== 'string' ||
    !candidate.id ||
    !isValidReportType(candidate.type) ||
    typeof candidate.periodKey !== 'string' ||
    !DATE_RE.test(candidate.periodKey) ||
    typeof candidate.recipient !== 'string' ||
    typeof candidate.createdAt !== 'number' ||
    (candidate.submittedAt !== undefined && typeof candidate.submittedAt !== 'number')
  ) {
    return false
  }
  if (!candidate.content || typeof candidate.content !== 'object') return false
  return Object.values(candidate.content).every((item) => typeof item === 'string')
}

export function isSubmitted(report: Report): boolean {
  return report.submittedAt !== undefined
}

/** 汇报是否填写了至少一个小节。 */
export function hasContent(report: Report): boolean {
  return Object.values(report.content).some((text) => text.trim().length > 0)
}

export function todayKey(now: number): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function generateReportId(now: number): string {
  return `report:${now}:${Math.random().toString(36).slice(2, 10)}`
}
