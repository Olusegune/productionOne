import type { ProductionGraph, ProductionNode } from './productionGraph'

const now = '2026-10-20T12:00:00.000Z'
const node = (id: string, kind: ProductionNode['kind'], name: string, status: ProductionNode['status'], metadata: ProductionNode['metadata'] = {}): ProductionNode => ({ id, kind, name, status, revision: 1, metadata, createdAt: now, updatedAt: now })

export const demoGraph: ProductionGraph = {
  schemaVersion: 1,
  nodes: [
    node('PROJ-LAST-HORIZON-001', 'project', 'The Last Horizon', 'ready', { format: 'Short film', runtime: '12 min' }),
    node('SCEN-RETURN-008', 'scene', '08 · The Return', 'ready', { setting: 'Bedroom', time: 'Night' }),
    node('SHOT-RETURN-004', 'shot', '08-04 · Recognition', 'draft', { framing: 'Medium close-up', camera: 'Slow push in' }),
    node('ASSE-AMINA-001', 'asset', 'Amina', 'approved', { type: 'Character', role: 'Explorer' }),
    node('STOR-AMINA-DUST-001', 'storyVariant', 'Dust-worn expedition', 'approved', { costume: 'Field jacket', condition: 'Weathered' }),
    node('SHEE-AMINA-TURN-001', 'sheet', 'Character turnaround', 'ready', { views: 5 }),
    node('REVI-AMINA-TURN-001', 'revision', 'Turnaround v01', 'approved', { filename: 'CHAR_001_Amina_Expedition_Turnaround_v01.png' }),
    node('ASSE-BEDROOM-002', 'asset', 'Cliff bedroom', 'ready', { type: 'Set', state: 'Night' }),
    node('ASSE-COMPASS-007', 'asset', 'Solar compass', 'draft', { type: 'Prop', condition: 'Weathered' }),
  ],
  edges: [
    { id: 'E01', from: 'PROJ-LAST-HORIZON-001', to: 'SCEN-RETURN-008', relation: 'contains' },
    { id: 'E02', from: 'SCEN-RETURN-008', to: 'SHOT-RETURN-004', relation: 'contains' },
    { id: 'E03', from: 'ASSE-AMINA-001', to: 'STOR-AMINA-DUST-001', relation: 'variantOf' },
    { id: 'E04', from: 'STOR-AMINA-DUST-001', to: 'SHEE-AMINA-TURN-001', relation: 'renders' },
    { id: 'E05', from: 'SHEE-AMINA-TURN-001', to: 'REVI-AMINA-TURN-001', relation: 'revises' },
    { id: 'E06', from: 'STOR-AMINA-DUST-001', to: 'SHOT-RETURN-004', relation: 'appearsIn' },
    { id: 'E07', from: 'ASSE-BEDROOM-002', to: 'SHOT-RETURN-004', relation: 'appearsIn' },
    { id: 'E08', from: 'ASSE-COMPASS-007', to: 'SHOT-RETURN-004', relation: 'appearsIn' },
  ],
}
