import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import BitablePage from '@/features/bitable/components/BitablePage.vue'
import { addRecord, addTable, bitableStore, resetBitableStore, setCell } from '@/features/bitable/stores/bitableStore'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}))

describe('bitablePage gallery view', () => {
  beforeEach(() => {
    localStorage.clear()
    resetBitableStore()
  })

  it('renders one gallery card per record showing the title field', async () => {
    const table = addTable('卡片表')
    const titleId = bitableStore.state.tables[0].fields[0].id
    addRecord(table.id)
    addRecord(table.id)
    const records = bitableStore.state.tables[0].records
    setCell(table.id, records[0].id, titleId, 'Card A')
    setCell(table.id, records[1].id, titleId, 'Card B')

    const wrapper = mount(BitablePage)
    await nextTick()

    await wrapper.find('[data-testid="bitable-view-gallery"]').trigger('click')
    await nextTick()

    expect(wrapper.findAll('[data-testid="bitable-gallery-card"]').length).toBe(2)
    expect(wrapper.text()).toContain('Card A')
    expect(wrapper.text()).toContain('Card B')
  })
})
