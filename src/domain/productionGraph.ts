export type NodeKind = 'project' | 'scene' | 'shot' | 'asset' | 'storyVariant' | 'sheet' | 'revision'
export type NodeStatus = 'draft' | 'ready' | 'approved' | 'stale'

export interface ProductionNode {
  id: string
  kind: NodeKind
  name: string
  status: NodeStatus
  revision: number
  metadata: Record<string, string | number | boolean>
  createdAt: string
  updatedAt: string
}

export interface ProductionEdge {
  id: string
  from: string
  to: string
  relation: 'contains' | 'appearsIn' | 'uses' | 'variantOf' | 'renders' | 'revises'
}

export interface ProductionGraph {
  schemaVersion: 1
  nodes: ProductionNode[]
  edges: ProductionEdge[]
}

export const stableId = (kind: NodeKind, slug: string, sequence: number) =>
  `${kind.slice(0, 4).toUpperCase()}-${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${String(sequence).padStart(3, '0')}`

export function dependentsOf(graph: ProductionGraph, nodeId: string): ProductionNode[] {
  const visited = new Set<string>()
  const queue = [nodeId]
  while (queue.length) {
    const current = queue.shift()!
    for (const edge of graph.edges.filter((candidate) => candidate.from === current)) {
      if (!visited.has(edge.to)) { visited.add(edge.to); queue.push(edge.to) }
    }
  }
  return graph.nodes.filter((node) => visited.has(node.id))
}

export function reviseNode(graph: ProductionGraph, nodeId: string, at = new Date().toISOString()): ProductionGraph {
  const affected = new Set(dependentsOf(graph, nodeId).map((node) => node.id))
  return {
    ...graph,
    nodes: graph.nodes.map((node) => node.id === nodeId
      ? { ...node, revision: node.revision + 1, updatedAt: at }
      : affected.has(node.id) ? { ...node, status: 'stale', updatedAt: at } : node),
  }
}
