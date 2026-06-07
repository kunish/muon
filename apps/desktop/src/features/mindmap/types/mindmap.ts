// 思维笔记（层级节点树 / 大纲式思维导图），区别于 docs 的线性富文本。
export const MINDMAP_STORAGE_KEY = 'muon.mindmaps.v1'

export interface MindNode {
  id: string
  /** 上级节点 id；根节点为 null */
  parentId: string | null
  text: string
  collapsed: boolean
}

export interface MindMap {
  id: string
  title: string
  nodes: MindNode[]
  createdAt: number
}

function isValidNode(value: unknown): value is MindNode {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MindNode>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    (candidate.parentId === null || typeof candidate.parentId === 'string') &&
    typeof candidate.text === 'string' &&
    typeof candidate.collapsed === 'boolean'
  )
}

export function isValidMindMap(value: unknown): value is MindMap {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MindMap>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.nodes) &&
    candidate.nodes.every(isValidNode) &&
    typeof candidate.createdAt === 'number'
  )
}

export function rootNode(map: MindMap): MindNode | undefined {
  return map.nodes.find((node) => node.parentId === null)
}

export function childrenOf(map: MindMap, parentId: string): MindNode[] {
  return map.nodes.filter((node) => node.parentId === parentId)
}

export interface VisibleNode {
  node: MindNode
  depth: number
  hasChildren: boolean
}

/** 从根做深度优先遍历，跳过折叠节点的子树，产出带层级深度的可见节点列表。 */
export function buildVisibleNodes(map: MindMap): VisibleNode[] {
  const byParent = new Map<string, MindNode[]>()
  for (const node of map.nodes) {
    if (node.parentId === null) continue
    const siblings = byParent.get(node.parentId) ?? []
    siblings.push(node)
    byParent.set(node.parentId, siblings)
  }

  const result: VisibleNode[] = []
  const root = rootNode(map)
  if (!root) return result

  const walk = (node: MindNode, depth: number): void => {
    const children = byParent.get(node.id) ?? []
    result.push({ node, depth, hasChildren: children.length > 0 })
    if (!node.collapsed) {
      for (const child of children) walk(child, depth + 1)
    }
  }
  walk(root, 0)
  return result
}

/** 某节点的全部后代 id（不含自身）。 */
export function descendantIds(map: MindMap, nodeId: string): string[] {
  const byParent = new Map<string, MindNode[]>()
  for (const node of map.nodes) {
    if (node.parentId === null) continue
    const siblings = byParent.get(node.parentId) ?? []
    siblings.push(node)
    byParent.set(node.parentId, siblings)
  }
  const out: string[] = []
  const stack = [...(byParent.get(nodeId) ?? [])]
  while (stack.length > 0) {
    const node = stack.pop()!
    out.push(node.id)
    stack.push(...(byParent.get(node.id) ?? []))
  }
  return out
}

export function generateMindMapId(now: number): string {
  return `mindmap:${now}:${Math.random().toString(36).slice(2, 10)}`
}

export function generateNodeId(now: number): string {
  return `node:${now}:${Math.random().toString(36).slice(2, 10)}`
}
