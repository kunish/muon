import type { BitableTable, CellValue, Field, FieldType } from '../types/bitable'
import { Store } from '@tanstack/vue-store'
import {
  BITABLE_STORAGE_KEY,
  coerceCellValue,
  generateFieldId,
  generateRecordId,
  generateTableId,
  isValidTable,
} from '../types/bitable'

interface PersistedBitableState {
  version: 1
  tables: BitableTable[]
}

interface LoadedBitableState {
  tables: BitableTable[]
  normalized: boolean
}

interface AddFieldInput {
  name: string
  type: FieldType
  options?: string[]
  now?: number
}

function normalizePersistedTables(tables: unknown[]): LoadedBitableState {
  const deduped = new Map<string, BitableTable>()
  let normalized = false

  for (const table of tables) {
    if (!isValidTable(table)) {
      normalized = true
      continue
    }
    if (deduped.has(table.id)) normalized = true
    deduped.set(table.id, table)
  }

  return { tables: [...deduped.values()], normalized }
}

function loadState(): LoadedBitableState {
  try {
    const raw = localStorage.getItem(BITABLE_STORAGE_KEY)
    if (!raw) return { tables: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedBitableState>
    if (parsed.version !== 1 || !Array.isArray(parsed.tables)) return { tables: [], normalized: false }

    return normalizePersistedTables(parsed.tables)
  } catch {
    return { tables: [], normalized: false }
  }
}

function persistTables(tables: BitableTable[]): void {
  const payload: PersistedBitableState = { version: 1, tables }
  try {
    localStorage.setItem(BITABLE_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[bitableStore] Failed to persist tables:', err)
  }
}

export interface BitableState {
  /** 用户创建的数据表，持久化到 localStorage（version-1 信封）。 */
  tables: BitableTable[]
  hydrated: boolean
}

function createInitialState(): BitableState {
  const { tables, normalized } = loadState()
  if (normalized) persistTables(tables)
  return { tables, hydrated: true }
}

export const bitableStore = new Store<BitableState>(createInitialState())

/** 响应式读取数据表列表 —— 消费方通过 `useSelector` 选用。 */
export function selectTables(state: BitableState): BitableTable[] {
  return state.tables
}

/** 从 localStorage 重新读取数据表到 store。 */
export function hydrate(): void {
  const { tables, normalized } = loadState()
  bitableStore.setState((s) => ({ ...s, tables, hydrated: true }))
  if (normalized) persistTables(tables)
}

function commit(tables: BitableTable[]): void {
  bitableStore.setState((s) => ({ ...s, tables }))
  persistTables(bitableStore.state.tables)
}

function mapTable(tableId: string, fn: (table: BitableTable) => BitableTable): void {
  commit(bitableStore.state.tables.map((table) => (table.id === tableId ? fn(table) : table)))
}

/** 新建数据表，默认带一个文本字段「标题」。 */
export function addTable(name: string, now = Date.now()): BitableTable {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Table name is required')

  const table: BitableTable = {
    id: generateTableId(now),
    name: trimmed,
    fields: [{ id: generateFieldId(now), name: '标题', type: 'text' }],
    records: [],
    createdAt: now,
  }
  commit([...bitableStore.state.tables, table])
  return table
}

export function renameTable(tableId: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  mapTable(tableId, (table) => ({ ...table, name: trimmed }))
}

export function removeTable(tableId: string): void {
  const next = bitableStore.state.tables.filter((table) => table.id !== tableId)
  if (next.length === bitableStore.state.tables.length) return
  commit(next)
}

export function addField(tableId: string, input: AddFieldInput): Field | undefined {
  const name = input.name.trim()
  if (!name) return undefined
  const now = input.now ?? Date.now()
  const field: Field = {
    id: generateFieldId(now),
    name,
    type: input.type,
    options: input.type === 'select' ? (input.options ?? []).map((opt) => opt.trim()).filter(Boolean) : undefined,
  }
  mapTable(tableId, (table) => ({ ...table, fields: [...table.fields, field] }))
  return field
}

export function updateField(tableId: string, fieldId: string, patch: Partial<Pick<Field, 'name' | 'options'>>): void {
  mapTable(tableId, (table) => ({
    ...table,
    fields: table.fields.map((field) =>
      field.id === fieldId
        ? {
            ...field,
            ...(patch.name !== undefined ? { name: patch.name.trim() || field.name } : {}),
            ...(patch.options !== undefined && field.type === 'select'
              ? { options: patch.options.map((opt) => opt.trim()).filter(Boolean) }
              : {}),
          }
        : field,
    ),
  }))
}

export function removeField(tableId: string, fieldId: string): void {
  mapTable(tableId, (table) => ({
    ...table,
    fields: table.fields.filter((field) => field.id !== fieldId),
    records: table.records.map((record) => {
      if (!(fieldId in record.cells)) return record
      const { [fieldId]: _removed, ...rest } = record.cells
      return { ...record, cells: rest }
    }),
  }))
}

export function addRecord(tableId: string, now = Date.now()): void {
  mapTable(tableId, (table) => ({
    ...table,
    records: [...table.records, { id: generateRecordId(now), cells: {} }],
  }))
}

export function removeRecord(tableId: string, recordId: string): void {
  mapTable(tableId, (table) => ({
    ...table,
    records: table.records.filter((record) => record.id !== recordId),
  }))
}

/** 写入单元格；按字段类型把输入规整为合法值。未知字段忽略。 */
export function setCell(tableId: string, recordId: string, fieldId: string, raw: unknown): void {
  mapTable(tableId, (table) => {
    const field = table.fields.find((item) => item.id === fieldId)
    if (!field) return table
    const value: CellValue = coerceCellValue(field.type, raw)
    return {
      ...table,
      records: table.records.map((record) =>
        record.id === recordId ? { ...record, cells: { ...record.cells, [fieldId]: value } } : record,
      ),
    }
  })
}

/** 重置内存状态，从 localStorage 重新水合（createInitialState 会读取它）。 */
export function resetBitableStore(): void {
  bitableStore.setState(() => createInitialState())
}
