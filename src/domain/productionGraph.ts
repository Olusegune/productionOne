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

import type { AnalysisResult, ShotRecord } from './productionStudio'
import type { SheetPlan } from './visualDevelopment'

export function synchronizeProductionGraph(previous:ProductionGraph,analysis:AnalysisResult,shots:ShotRecord[],sheets:SheetPlan[],outputs:Record<string,string>,at=new Date().toISOString()):ProductionGraph{
  const existing=new Map(previous.nodes.map(node=>[node.id,node]))
  const node=(id:string,kind:NodeKind,name:string,status:NodeStatus,metadata:ProductionNode['metadata']={}):ProductionNode=>{
    const prior=existing.get(id)
    if(prior)return{...prior,name,status,metadata:{...prior.metadata,...metadata},updatedAt:prior.name===name&&prior.status===status&&JSON.stringify({...prior.metadata,...metadata})===JSON.stringify(prior.metadata)?prior.updatedAt:at}
    return{id,kind,name,status,revision:1,metadata,createdAt:at,updatedAt:at}
  }
  const projectId='PROJ-THE-LAST-HORIZON-001'
  const nodes:ProductionNode[]=[node(projectId,'project','The Last Horizon','ready',{sceneCount:analysis.scenes.length,assetCount:analysis.assets.length})]
  const edges:ProductionEdge[]=[]
  const edge=(from:string,to:string,relation:ProductionEdge['relation'])=>edges.push({id:`EDGE-${from}-${relation}-${to}`,from,to,relation})
  for(const scene of analysis.scenes){nodes.push(node(scene.id,'scene',scene.heading,'ready',{number:scene.number,setting:scene.setting,timeOfDay:scene.timeOfDay}));edge(projectId,scene.id,'contains')}
  for(const shot of shots){nodes.push(node(shot.id,'shot',`${shot.cameraFraming} · ${shot.action}`,shot.storyboardStatus==='approved'?'approved':'draft',{sceneId:shot.sceneId,order:shot.order,duration:shot.duration,dialogue:shot.dialogue,speaker:shot.speaker}));edge(shot.sceneId,shot.id,'contains');for(const assetId of shot.assetIds)edge(shot.id,assetId,'uses')}
  for(const asset of analysis.assets){nodes.push(node(asset.id,'asset',asset.name,asset.status==='approved'?'approved':'draft',{type:asset.type,scenes:asset.sceneIds.join(',')}));for(const sceneId of asset.sceneIds)edge(sceneId,asset.id,'uses')
    const assetSheets=sheets.filter(sheet=>sheet.assetId===asset.id)
    for(const variantName of [...new Set(assetSheets.map(sheet=>sheet.variant))]){const variantId=`VARI-${asset.id}-${variantName.toUpperCase().replace(/[^A-Z0-9]+/g,'-')}`;nodes.push(node(variantId,'storyVariant',`${asset.name} · ${variantName}`,'ready',{assetId:asset.id,variant:variantName}));edge(asset.id,variantId,'variantOf');for(const sheet of assetSheets.filter(item=>item.variant===variantName)){nodes.push(node(sheet.id,'sheet',`${asset.name} · ${sheet.type}`,sheet.status==='approved'?'approved':'draft',{assetId:asset.id,variant:sheet.variant,sheetType:sheet.type,required:sheet.required}));edge(variantId,sheet.id,'renders')}}
    if(outputs[asset.id]){const targetSheet=assetSheets[0];const revisionId=`REVI-${asset.id}-001`;nodes.push(node(revisionId,'revision',`${asset.name} verified file`,'approved',{assetId:asset.id,path:outputs[asset.id],fileRevision:1}));if(targetSheet)edge(targetSheet.id,revisionId,'revises')}
  }
  return{schemaVersion:1,nodes,edges}
}
