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

describe('bitablePage kanban view', () => {
  beforeEach(() => {
    localStorage.clear()
    resetBitableStore()
  })

  it('renders kanban columns grouped by a select field', async () => {
    const table = addTable('风险表')
    const status = addField(table.id, { name: '状态', type: 'select', options: ['未开始', '进行中', '已完成'] })!
    addRecord(table.id)
    addRecord(table.id)
    const records = bitableStore.state.tables[0].records
    setCell(table.id, records[0].id, status.id, '进行中')
    setCell(table.id, records[1].id, status.id, '已完成')

    const wrapper = mount(BitablePage)
    await nextTick()

    await wrapper.find('[data-testid="bitable-view-kanban"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="bitable-kanban-column-进行中"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bitable-kanban-column-已完成"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bitable-kanban-column-__ungrouped__"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="bitable-kanban-card"]').length).toBe(2)
  })

  it('shows a hint when the active table has no select field', async () => {
    addTable('纯文本表')

    const wrapper = mount(BitablePage)
    await nextTick()

    await wrapper.find('[data-testid="bitable-view-kanban"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="bitable-kanban-empty"]').exists()).toBe(true)
  })
})
