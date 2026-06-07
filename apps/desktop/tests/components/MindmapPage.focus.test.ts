import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import MindmapPage from '@/features/mindmap/components/MindmapPage.vue'
import { addMap, resetMindmapStore } from '@/features/mindmap/stores/mindmapStore'

const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.value }),
}))

function activeMapTitle(wrapper: ReturnType<typeof mount>): string {
  return (wrapper.find('[aria-label="笔记标题"]').element as HTMLInputElement).value
}

describe('mindmapPage focus deep-link', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMindmapStore()
    routeQuery.value = {}
  })

  it('selects the map named by ?focus on mount (overriding the default)', async () => {
    const first = addMap('笔记甲')
    addMap('笔记乙') // addMap prepends → 笔记乙 becomes the default active map

    routeQuery.value = { focus: first.id }
    const wrapper = mount(MindmapPage)
    await nextTick()

    expect(activeMapTitle(wrapper)).toBe('笔记甲')
  })

  it('falls back to the first map when ?focus does not match', async () => {
    addMap('笔记甲')
    addMap('笔记乙')

    routeQuery.value = { focus: 'no-such-map' }
    const wrapper = mount(MindmapPage)
    await nextTick()

    expect(activeMapTitle(wrapper)).toBe('笔记乙')
  })
})
