import type { MindMap, MindNode } from '../types/mindmap'
import { Store } from '@tanstack/vue-store'
import {
  descendantIds,
  generateMindMapId,
  generateNodeId,
  isValidMindMap,
  MINDMAP_STORAGE_KEY,
  rootNode,
} from '../types/mindmap'

interface PersistedMindmapState {
  version: 1
  maps: MindMap[]
}

interface LoadedMindmapState {
  maps: MindMap[]
  normalized: boolean
}

function normalizePersistedMaps(maps: unknown[]): LoadedMindmapState {
  const deduped = new Map<string, MindMap>()
  let normalized = false

  for (const map of maps) {
    if (!isValidMindMap(map)) {
      normalized = true
      continue
    }
    if (deduped.has(map.id)) normalized = true
    deduped.set(map.id, map)
  }

  return { maps: [...deduped.values()], normalized }
}

function loadState(): LoadedMindmapState {
  try {
    const raw = localStorage.getItem(MINDMAP_STORAGE_KEY)
    if (!raw) return { maps: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedMindmapState>
    if (parsed.version !== 1 || !Array.isArray(parsed.maps)) return { maps: [], normalized: false }

    return normalizePersistedMaps(parsed.maps)
  } catch {
    return { maps: [], normalized: false }
  }
}

function persistMaps(maps: MindMap[]): void {
  const payload: PersistedMindmapState = { version: 1, maps }
  try {
    localStorage.setItem(MINDMAP_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[mindmapStore] Failed to persist mindmaps:', err)
  }
}

export interface MindmapState {
  maps: MindMap[]
  hydrated: boolean
}

function createInitialState(): MindmapState {
  const { maps, normalized } = loadState()
  if (normalized) persistMaps(maps)
  return { maps, hydrated: true }
}

export const mindmapStore = new Store<MindmapState>(createInitialState())

export function selectMaps(state: MindmapState): MindMap[] {
  return state.maps
}

export function hydrate(): void {
  const { maps, normalized } = loadState()
  mindmapStore.setState((s) => ({ ...s, maps, hydrated: true }))
  if (normalized) persistMaps(maps)
}

function commit(maps: MindMap[]): void {
  mindmapStore.setState((s) => ({ ...s, maps }))
  persistMaps(mindmapStore.state.maps)
}

function mapMap(mapId: string, fn: (map: MindMap) => MindMap): void {
  commit(mindmapStore.state.maps.map((map) => (map.id === mapId ? fn(map) : map)))
}

export function addMap(title: string, now = Date.now()): MindMap {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Mindmap title is required')

  const root: MindNode = { id: generateNodeId(now), parentId: null, text: '中心主题', collapsed: false }
  const map: MindMap = { id: generateMindMapId(now), title: trimmed, nodes: [root], createdAt: now }
  commit([map, ...mindmapStore.state.maps])
  return map
}

export function renameMap(mapId: string, title: string): void {
  const trimmed = title.trim()
  if (!trimmed) return
  mapMap(mapId, (map) => ({ ...map, title: trimmed }))
}

export function removeMap(mapId: string): void {
  const next = mindmapStore.state.maps.filter((map) => map.id !== mapId)
  if (next.length === mindmapStore.state.maps.length) return
  commit(next)
}

/** 在指定父节点下新增子节点，返回新节点 id。 */
export function addChild(mapId: string, parentId: string, text = '新节点', now = Date.now()): string | undefined {
  const map = mindmapStore.state.maps.find((item) => item.id === mapId)
  if (!map || !map.nodes.some((node) => node.id === parentId)) return undefined
  const child: MindNode = { id: generateNodeId(now), parentId, text: text.trim() || '新节点', collapsed: false }
  mapMap(mapId, (item) => ({
    ...item,
    // 新增子节点时自动展开父节点
    nodes: [...item.nodes.map((node) => (node.id === parentId ? { ...node, collapsed: false } : node)), child],
  }))
  return child.id
}

export function updateNodeText(mapId: string, nodeId: string, text: string): void {
  mapMap(mapId, (map) => ({
    ...map,
    nodes: map.nodes.map((node) => (node.id === nodeId ? { ...node, text } : node)),
  }))
}

export function toggleCollapse(mapId: string, nodeId: string): void {
  mapMap(mapId, (map) => ({
    ...map,
    nodes: map.nodes.map((node) => (node.id === nodeId ? { ...node, collapsed: !node.collapsed } : node)),
  }))
}

/** 删除节点及其全部后代；根节点不可删除。 */
export function removeNode(mapId: string, nodeId: string): void {
  const map = mindmapStore.state.maps.find((item) => item.id === mapId)
  if (!map) return
  if (rootNode(map)?.id === nodeId) return
  const toRemove = new Set([nodeId, ...descendantIds(map, nodeId)])
  mapMap(mapId, (item) => ({ ...item, nodes: item.nodes.filter((node) => !toRemove.has(node.id)) }))
}

export function resetMindmapStore(): void {
  mindmapStore.setState(() => createInitialState())
}
