import { beforeEach, describe, expect, it } from 'vitest'
import {
  addField,
  addRecord,
  addTable,
  bitableStore,
  removeField,
  removeRecord,
  removeTable,
  renameTable,
  resetBitableStore,
  setCell,
} from '@/features/bitable/stores/bitableStore'
import { BITABLE_STORAGE_KEY } from '@/features/bitable/types/bitable'

function onlyTable() {
  return bitableStore.state.tables[0]
}

describe('bitableStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetBitableStore()
  })

  it('starts empty without any seeded mock tables', () => {
    expect(bitableStore.state.tables).toEqual([])
  })

  it('creates a table seeded with a 标题 text field and persists it', () => {
    const table = addTable('风险登记表')

    expect(table.name).toBe('风险登记表')
    expect(table.fields).toHaveLength(1)
    expect(table.fields[0]).toMatchObject({ name: '标题', type: 'text' })

    resetBitableStore()
    expect(bitableStore.state.tables).toHaveLength(1)
    expect(onlyTable().name).toBe('风险登记表')
  })

  it('rejects a table with an empty name', () => {
    expect(() => addTable('   ')).toThrow()
    expect(bitableStore.state.tables).toEqual([])
  })

  it('renames a table and persists it', () => {
    addTable('旧名')
    renameTable(onlyTable().id, '新名')

    resetBitableStore()
    expect(onlyTable().name).toBe('新名')
  })

  it('adds a select field and trims/filters its options', () => {
    const table = addTable('表')
    const field = addField(table.id, { name: '状态', type: 'select', options: [' 进行中 ', '', '已完成'] })

    expect(field?.type).toBe('select')
    expect(onlyTable().fields).toHaveLength(2)
    expect(onlyTable().fields[1].options).toEqual(['进行中', '已完成'])
  })

  it('coerces cell values by field type', () => {
    const table = addTable('表')
    const num = addField(table.id, { name: '数量', type: 'number' })!
    const flag = addField(table.id, { name: '完成', type: 'checkbox' })!
    const date = addField(table.id, { name: '截止', type: 'date' })!
    addRecord(table.id)
    const recordId = onlyTable().records[0].id

    setCell(table.id, recordId, num.id, '42')
    setCell(table.id, recordId, flag.id, true)
    setCell(table.id, recordId, date.id, '2026-06-07')

    let cells = onlyTable().records[0].cells
    expect(cells[num.id]).toBe(42)
    expect(cells[flag.id]).toBe(true)
    expect(cells[date.id]).toBe('2026-06-07')

    // 非法输入被规整：数字 → null、日期 → ''
    setCell(table.id, recordId, num.id, 'abc')
    setCell(table.id, recordId, date.id, 'not-a-date')
    cells = onlyTable().records[0].cells
    expect(cells[num.id]).toBeNull()
    expect(cells[date.id]).toBe('')
  })

  it('ignores writes to an unknown field', () => {
    const table = addTable('表')
    addRecord(table.id)
    const recordId = onlyTable().records[0].id

    setCell(table.id, recordId, 'no-such-field', 'x')
    expect(onlyTable().records[0].cells).toEqual({})
  })

  it('removes a field and drops its cells from records', () => {
    const table = addTable('表')
    const extra = addField(table.id, { name: '备注', type: 'text' })!
    addRecord(table.id)
    const recordId = onlyTable().records[0].id
    setCell(table.id, recordId, extra.id, '一些备注')
    expect(onlyTable().records[0].cells[extra.id]).toBe('一些备注')

    removeField(table.id, extra.id)
    expect(onlyTable().fields.some((f) => f.id === extra.id)).toBe(false)
    expect(extra.id in onlyTable().records[0].cells).toBe(false)
  })

  it('adds and removes records, persisting both', () => {
    const table = addTable('表')
    addRecord(table.id)
    addRecord(table.id)
    expect(onlyTable().records).toHaveLength(2)

    const firstId = onlyTable().records[0].id
    removeRecord(table.id, firstId)

    resetBitableStore()
    expect(onlyTable().records).toHaveLength(1)
    expect(onlyTable().records[0].id).not.toBe(firstId)
  })

  it('removes a table and persists the removal', () => {
    const table = addTable('临时表')
    removeTable(table.id)

    resetBitableStore()
    expect(bitableStore.state.tables).toEqual([])
  })

  it('drops invalid persisted tables when hydrating', () => {
    localStorage.setItem(
      BITABLE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        tables: [
          {
            id: 'good',
            name: 'Valid',
            fields: [{ id: 'f1', name: '标题', type: 'text' }],
            records: [{ id: 'r1', cells: { f1: 'hello' } }],
            createdAt: 1,
          },
          {
            id: 'bad',
            name: 'Broken',
            fields: [{ id: 'f1', name: 'X', type: 'unknown-type' }],
            records: [],
            createdAt: 2,
          },
        ],
      }),
    )

    resetBitableStore()
    expect(bitableStore.state.tables).toHaveLength(1)
    expect(bitableStore.state.tables[0].id).toBe('good')
  })
})
