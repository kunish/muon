import { beforeEach, describe, expect, it } from 'vitest'
import {
  addChild,
  addMap,
  mindmapStore,
  removeMap,
  removeNode,
  resetMindmapStore,
  toggleCollapse,
  updateNodeText,
} from '@/features/mindmap/stores/mindmapStore'
import { buildVisibleNodes, descendantIds, MINDMAP_STORAGE_KEY, rootNode } from '@/features/mindmap/types/mindmap'

function onlyMap() {
  return mindmapStore.state.maps[0]
}

describe('mindmapStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMindmapStore()
  })

  it('starts empty without any seeded mock maps', () => {
    expect(mindmapStore.state.maps).toEqual([])
  })

  it('creates a map with a single root node and persists it', () => {
    addMap('产品规划')

    expect(onlyMap().nodes).toHaveLength(1)
    expect(rootNode(onlyMap())?.parentId).toBeNull()

    resetMindmapStore()
    expect(onlyMap().title).toBe('产品规划')
  })

  it('rejects a map with an empty title', () => {
    expect(() => addMap('   ')).toThrow()
    expect(mindmapStore.state.maps).toEqual([])
  })

  it('adds nested child nodes', () => {
    const map = addMap('图')
    const rootId = rootNode(onlyMap())!.id
    const childId = addChild(map.id, rootId, 'A')!
    addChild(map.id, childId, 'A-1')

    resetMindmapStore()
    expect(onlyMap().nodes).toHaveLength(3)
    expect(descendantIds(onlyMap(), rootId)).toHaveLength(2)
  })

  it('removes a node together with all its descendants', () => {
    const map = addMap('图')
    const rootId = rootNode(onlyMap())!.id
    const childId = addChild(map.id, rootId, 'A')!
    addChild(map.id, childId, 'A-1')
    addChild(map.id, childId, 'A-2')
    expect(onlyMap().nodes).toHaveLength(4)

    removeNode(map.id, childId)
    expect(onlyMap().nodes).toHaveLength(1)
    expect(rootNode(onlyMap())?.id).toBe(rootId)
  })

  it('never removes the root node', () => {
    const map = addMap('图')
    const rootId = rootNode(onlyMap())!.id
    removeNode(map.id, rootId)
    expect(onlyMap().nodes).toHaveLength(1)
  })

  it('hides collapsed subtrees in the visible node list', () => {
    const map = addMap('图')
    const rootId = rootNode(onlyMap())!.id
    const childId = addChild(map.id, rootId, 'A')!
    addChild(map.id, childId, 'A-1')

    expect(buildVisibleNodes(onlyMap())).toHaveLength(3)

    toggleCollapse(map.id, childId)
    const visible = buildVisibleNodes(onlyMap())
    expect(visible).toHaveLength(2) // root + A，A-1 被折叠隐藏
    expect(visible.find((item) => item.node.id === childId)?.hasChildren).toBe(true)
  })

  it('updates a node text and persists it', () => {
    const map = addMap('图')
    const rootId = rootNode(onlyMap())!.id
    updateNodeText(map.id, rootId, '核心目标')

    resetMindmapStore()
    expect(rootNode(onlyMap())?.text).toBe('核心目标')
  })

  it('removes a map and persists the removal', () => {
    const map = addMap('临时图')
    removeMap(map.id)

    resetMindmapStore()
    expect(mindmapStore.state.maps).toEqual([])
  })

  it('drops invalid persisted maps when hydrating', () => {
    localStorage.setItem(
      MINDMAP_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        maps: [
          {
            id: 'good',
            title: 'Valid',
            nodes: [{ id: 'r', parentId: null, text: '根', collapsed: false }],
            createdAt: 1,
          },
          { id: 'bad', title: 'Broken', nodes: [{ id: 'r', parentId: null, text: '根' }], createdAt: 2 },
        ],
      }),
    )

    resetMindmapStore()
    expect(mindmapStore.state.maps).toHaveLength(1)
    expect(mindmapStore.state.maps[0].id).toBe('good')
  })
})
