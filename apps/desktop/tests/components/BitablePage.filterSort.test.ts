import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import BitablePage from '@/features/bitable/components/BitablePage.vue'
import {
  addField,
  addRecord,
  addTable,
  bitableStore,
  resetBitableStore,
  setCell,
} from '@/features/bitable/stores/bitableStore'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}))

function seed() {
  const table = addTable('水果表')
  const titleId = bitableStore.state.tables[0].fields[0].id
  const numId = addField(table.id, { name: '数量', type: 'number' })!.id
  addRecord(table.id)
  addRecord(table.id)
  addRecord(table.id)
  const records = bitableStore.state.tables[0].records
  setCell(table.id, records[0].id, titleId, 'Apple')
  setCell(table.id, records[0].id, numId, 3)
  setCell(table.id, records[1].id, titleId, 'Banana')
  setCell(table.id, records[1].id, numId, 1)
  setCell(table.id, records[2].id, titleId, 'Cherry')
  setCell(table.id, records[2].id, numId, 2)
  return { titleId, numId }
}

describe('bitablePage filter and sort', () => {
  beforeEach(() => {
    localStorage.clear()
    resetBitableStore()
  })

  it('filters grid rows by a field value (contains)', async () => {
    const { titleId } = seed()
    const wrapper = mount(BitablePage)
    await nextTick()

    expect(wrapper.findAll('[data-testid="bitable-row"]').length).toBe(3)

    await wrapper.find('[data-testid="bitable-filter-field"]').setValue(titleId)
    await wrapper.find('[data-testid="bitable-filter-text"]').setValue('an')
    await nextTick()

    expect(wrapper.findAll('[data-testid="bitable-row"]').length).toBe(1)
  })

  it('sorts grid rows by a number field ascending', async () => {
    const { numId } = seed()
    const wrapper = mount(BitablePage)
    await nextTick()

    await wrapper.find('[data-testid="bitable-sort-field"]').setValue(numId)
    await nextTick()

    const rows = wrapper.findAll('[data-testid="bitable-row"]')
    const firstTitle = (rows[0].findAll('input')[0].element as HTMLInputElement).value
    expect(firstTitle).toBe('Banana')
  })
})
