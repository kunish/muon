export const BITABLE_STORAGE_KEY = 'muon.bitable.tables.v1'

/** 字段（列）类型：文本 / 数字 / 单选 / 日期 / 勾选 */
export type FieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox'

/** 单元格取值：文本/日期用 string，数字用 number，勾选用 boolean，空用 null。 */
export type CellValue = string | number | boolean | null

export interface Field {
  id: string
  name: string
  type: FieldType
  /** 单选字段的候选项；其它类型忽略。 */
  options?: string[]
}

export interface BitableRecord {
  id: string
  /** 按 fieldId 索引的单元格值。 */
  cells: Record<string, CellValue>
}

export interface BitableTable {
  id: string
  name: string
  fields: Field[]
  records: BitableRecord[]
  /** 创建时间戳（毫秒），用于稳定排序。 */
  createdAt: number
}

export const FIELD_TYPES: readonly FieldType[] = ['text', 'number', 'select', 'date', 'checkbox']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && FIELD_TYPES.includes(value as FieldType)
}

function isCellValue(value: unknown): value is CellValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isValidField(value: unknown): value is Field {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Field>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.name === 'string' &&
    isValidFieldType(candidate.type) &&
    (candidate.options === undefined ||
      (Array.isArray(candidate.options) && candidate.options.every((opt) => typeof opt === 'string')))
  )
}

function isValidRecord(value: unknown): value is BitableRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BitableRecord>
  if (typeof candidate.id !== 'string' || !candidate.id) return false
  if (!candidate.cells || typeof candidate.cells !== 'object') return false
  return Object.values(candidate.cells).every(isCellValue)
}

export function isValidTable(value: unknown): value is BitableTable {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BitableTable>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.fields) &&
    candidate.fields.every(isValidField) &&
    Array.isArray(candidate.records) &&
    candidate.records.every(isValidRecord) &&
    typeof candidate.createdAt === 'number'
  )
}

export function isValidDateCell(value: string): boolean {
  return DATE_RE.test(value)
}

/** 某字段类型的空白默认值。 */
export function defaultCellValue(type: FieldType): CellValue {
  if (type === 'checkbox') return false
  if (type === 'number') return null
  return ''
}

/** 把任意输入规整为该字段类型的合法单元格值。 */
export function coerceCellValue(type: FieldType, raw: unknown): CellValue {
  if (type === 'checkbox') return raw === true || raw === 'true'
  if (type === 'number') {
    if (raw === '' || raw === null || raw === undefined) return null
    const num = Number(raw)
    return Number.isFinite(num) ? num : null
  }
  if (type === 'date') {
    return typeof raw === 'string' && (raw === '' || isValidDateCell(raw)) ? raw : ''
  }
  return raw === null || raw === undefined ? '' : String(raw)
}

export function generateTableId(now: number): string {
  return `tbl:${now}:${Math.random().toString(36).slice(2, 10)}`
}

export function generateFieldId(now: number): string {
  return `fld:${now}:${Math.random().toString(36).slice(2, 10)}`
}

export function generateRecordId(now: number): string {
  return `rec:${now}:${Math.random().toString(36).slice(2, 10)}`
}
