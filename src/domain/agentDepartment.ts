import type { AnalysisResult } from './productionStudio'
import type { QueueState } from './generationQueue'

export type DepartmentRole = 'orchestrator' | 'script-analyst' | 'character-designer' | 'costume-designer' | 'set-designer' | 'prop-designer' | 'matte-painter' | 'sound-designer' | 'continuity-supervisor' | 'qa-supervisor' | 'delivery-producer'
export type DepartmentStatus = 'ready' | 'waiting-approval' | 'blocked' | 'complete'
export interface DepartmentAssignment { role: DepartmentRole; title: string; brief: string; evidence: string[]; dependencies: string[]; status: DepartmentStatus; cost: string; nextAction: string }

const roleTitle: Record<DepartmentRole, string> = { orchestrator: 'Production orchestrator', 'script-analyst': 'Script analyst', 'character-designer': 'Character designer', 'costume-designer': 'Costume designer', 'set-designer': 'Set designer', 'prop-designer': 'Prop designer', 'matte-painter': 'Matte painter', 'sound-designer': 'Sound designer', 'continuity-supervisor': 'Continuity supervisor', 'qa-supervisor': 'QA supervisor', 'delivery-producer': 'Delivery producer' }
export const departmentRoles: DepartmentRole[] = Object.keys(roleTitle) as DepartmentRole[]

export function buildDepartmentPlan(analysis: AnalysisResult, queue: QueueState, audit: { ready: boolean; missingAssets: string[]; incompleteShots: string[] }, styleLocked: boolean): DepartmentAssignment[] {
  const active = queue.jobs.filter((job) => ['queued', 'generating', 'validating'].includes(job.status)).length
  const waiting = queue.jobs.filter((job) => job.status === 'needs-review').length
  const evidence = (analysis.story?.scenes ?? analysis.scenes).slice(0, 3).map((scene) => `${scene.heading}${'startLine' in scene ? ` · lines ${scene.startLine}-${scene.endLine}` : ''}`)
  const common = { evidence, dependencies: ['Director scope approval'], cost: 'Unknown until an approved provider/model is selected' }
  return [
    { ...common, role: 'orchestrator', title: roleTitle.orchestrator, brief: 'Coordinate typed asset tasks and approval gates.', status: active ? 'ready' : 'complete', nextAction: active ? 'Monitor the approved batch.' : 'Propose the next missing deliverable.' },
    { ...common, role: 'script-analyst', title: roleTitle['script-analyst'], brief: 'Maintain evidence-backed characters, props, wardrobe, sets, sound, and continuity findings.', status: analysis.assets.length ? 'complete' : 'ready', nextAction: analysis.assets.length ? 'Review extracted findings.' : 'Analyze the script.' },
    { ...common, role: 'character-designer', title: roleTitle['character-designer'], brief: `Prepare identity and reference sheets for ${analysis.assets.filter((asset) => asset.type === 'character').length} character assets.`, status: audit.missingAssets.length ? 'ready' : 'complete', nextAction: audit.missingAssets.length ? 'Propose required character views.' : 'Review approved anchors.' },
    { ...common, role: 'costume-designer', title: roleTitle['costume-designer'], brief: 'Track wardrobe variants and scene-linked costume continuity.', status: 'waiting-approval', dependencies: ['Script findings', 'Character identity approval'], nextAction: 'Approve wardrobe direction before generation.' },
    { ...common, role: 'set-designer', title: roleTitle['set-designer'], brief: 'Prepare reusable environment geography, layout, lighting, and continuity references.', status: 'waiting-approval', dependencies: ['Script findings', 'Art direction approval'], nextAction: 'Approve environment bible scope.' },
    { ...common, role: 'prop-designer', title: roleTitle['prop-designer'], brief: 'Prepare functional, material, scale, and recurring-prop references.', status: 'waiting-approval', dependencies: ['Script findings'], nextAction: 'Approve required prop views.' },
    { ...common, role: 'matte-painter', title: roleTitle['matte-painter'], brief: 'Prepare environment-extension and background reference briefs, not finished-film composites.', status: 'waiting-approval', dependencies: ['Set designer proposal', 'Art direction approval'], nextAction: 'Define extension references.' },
    { ...common, role: 'sound-designer', title: roleTitle['sound-designer'], brief: 'Prepare dialogue, vocalization, ambience, SFX, and music briefs with rights/consent notes.', status: 'waiting-approval', dependencies: ['Script findings'], nextAction: 'Review sound requirements.' },
    { ...common, role: 'continuity-supervisor', title: roleTitle['continuity-supervisor'], brief: 'Detect stale downstream assets when approved references or style direction change.', status: audit.missingAssets.length ? 'blocked' : 'ready', dependencies: ['Immutable revision IDs'], nextAction: 'Resolve stale dependencies.' },
    { ...common, role: 'qa-supervisor', title: roleTitle['qa-supervisor'], brief: 'Separate technical QA from semantic visual review and keep uncertainty visible.', status: waiting ? 'ready' : 'waiting-approval', dependencies: ['Returned asset revisions'], nextAction: waiting ? 'Review flagged revisions.' : 'Wait for returned assets.' },
    { ...common, role: 'delivery-producer', title: roleTitle['delivery-producer'], brief: 'Validate approvals, hashes, stale dependencies, and draft/verified package mode.', status: audit.ready && styleLocked ? 'complete' : 'blocked', dependencies: ['Final review approval', 'Locked style direction'], nextAction: audit.ready && styleLocked ? 'Export the verified package.' : 'Resolve readiness blockers.' },
  ]
}
