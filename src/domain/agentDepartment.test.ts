import { describe, expect, it } from 'vitest'
import { buildDepartmentPlan } from './agentDepartment'
import { emptyQueue } from './generationQueue'
import { analyzeScript } from './productionStudio'
describe('agent department plan', () => { it('creates supervised specialist assignments with gates and cost honesty', () => { const plan = buildDepartmentPlan(analyzeScript('INT. HOUSE - NIGHT\nMARA\nThe lantern glows.'), emptyQueue(), { ready: false, missingAssets: ['A1'], incompleteShots: [] }, false); expect(plan.map((item) => item.role)).toContain('costume-designer'); expect(plan.every((item) => item.cost.includes('Unknown'))).toBe(true); expect(plan.find((item) => item.role === 'delivery-producer')?.status).toBe('blocked') }) })
