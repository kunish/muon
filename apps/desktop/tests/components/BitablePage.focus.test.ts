import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import BitablePage from '@/features/bitable/components/BitablePage.vue'
import { addTable, resetBitableStore } from '@/features/bitable/stores/bitableStore'

// 用可变的 query 模拟 useRoute，验证 ?focus 深链定位。
const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.value }),
}))

function activeTableName(wrapper: ReturnType<typeof mount>): string {
  return (wrapper.find('[aria-label="表格名称"]').element as HTMLInputElement).value
}

describe('bitablePage focus deep-link', () => {
  beforeEach(() => {
    localStorage.clear()
    resetBitableStore()
    routeQuery.value = {}
  })

  it('activates the table named by ?focus on mount', async () => {
    addTable('表A')
    const tableB = addTable('表B')
    routeQuery.value = { focus: tableB.id }

    const wrapper = mount(BitablePage)
    await nextTick()

    expect(activeTableName(wrapper)).toBe('表B')
  })

  it('falls back to the first table when ?focus does not match', async () => {
    addTable('表A')
    addTable('表B')
    routeQuery.value = { focus: 'no-such-table' }

    const wrapper = mount(BitablePage)
    await nextTick()

    expect(activeTableName(wrapper)).toBe('表A')
  })
})
