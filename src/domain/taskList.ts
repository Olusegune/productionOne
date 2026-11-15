import { buildDepartmentPlan, type DepartmentRole } from './agentDepartment'
import type { AnalysisResult, AssetType } from './productionStudio'
import type { QueueState } from './generationQueue'

export type TaskGroup = 'needs-approval' | 'running' | 'blocked' | 'complete'
export const taskGroups: Array<{ id: TaskGroup; label: string }> = [
  { id: 'needs-approval', label: 'Needs approval' },
  { id: 'running', label: 'Ready or running' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'complete', label: 'Complete' },
]

/** A real place to go to do the task. There is no agent behind a task: the person does the work, and this takes them there. */
export interface TaskAction { kind: 'review' | 'style' | 'asset' | 'script'; assetId?: string; label: string }

export interface TaskItem {
  role: DepartmentRole
  title: string
  /** What the task is about, in a few words. */
  target: string
  /** Why it is in this group, in one line. */
  reason: string
  group: TaskGroup
  next: string
  action?: TaskAction
  /** Shown on request: the longer brief, where the findings came from, what it waits on. */
  drawer: { brief: string; evidence: string[]; dependencies: string[]; cost: string }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The work to be done, by role, grouped by where it stands. Built from the same plan the department board used, plus a target, a reason and a place to go. */
export function buildTaskList(analysis: AnalysisResult, queue: QueueState, audit: { ready: boolean; missingAssets: string[]; incompleteShots: string[] }, styleLocked: boolean): TaskItem[] {
  const plan = buildDepartmentPlan(analysis, queue, audit, styleLocked)
  const missing = new Set(audit.missingAssets)
  const ofType = (types: AssetType[]) => analysis.assets.filter((a) => types.includes(a.type))
  const missingOf = (types: AssetType[]) => ofType(types).filter((a) => missing.has(a.id))
  const open = (a: { id: string; name: string } | undefined, verb = 'Open'): TaskAction | undefined => (a ? { kind: 'asset', assetId: a.id, label: `${verb} ${a.name}` } : undefined)
  const running = queue.jobs.filter((j) => ['queued', 'generating', 'validating'].includes(j.status)).length
  const review = queue.jobs.filter((j) => j.status === 'needs-review').length

  const detail = (role: DepartmentRole): { target: string; reason: string; action?: TaskAction } => {
    const make = (types: AssetType[], noun: string) => {
      const all = ofType(types), miss = missingOf(types)
      return { target: plural(all.length, noun), reason: all.length === 0 ? `No ${noun}s in the script` : miss.length ? `${miss.length} without an approved sheet` : 'All have an approved sheet', action: open(miss[0]) }
    }
    switch (role) {
      case 'orchestrator': return { target: 'The whole project', reason: running ? `${plural(running, 'view')} in the queue` : 'Nothing is running' }
      case 'script-analyst': return { target: 'The script', reason: analysis.assets.length ? `${plural(analysis.assets.length, 'asset')} found` : 'No script has been read yet', action: analysis.assets.length ? undefined : { kind: 'script', label: 'Open Story' } }
      case 'character-designer': return make(['character'], 'character')
      case 'costume-designer': return make(['costume'], 'costume')
      case 'set-designer': return make(['set', 'environment'], 'set')
      case 'prop-designer': return make(['prop'], 'prop')
      case 'matte-painter': return { target: 'Backgrounds', reason: 'Starts once the sets are approved' }
      case 'sound-designer': return { target: 'Voices and sound', reason: 'Made per character and prop', action: open(ofType(['character'])[0], 'Voices for') }
      case 'continuity-supervisor': return { target: 'Approved references', reason: audit.missingAssets.length ? `Waits for ${plural(audit.missingAssets.length, 'approved sheet')}` : 'Watching for changed references' }
      case 'qa-supervisor': return { target: 'Pictures to check', reason: review ? `${plural(review, 'picture')} waiting for your decision` : 'Nothing to check', action: review ? { kind: 'review', label: 'Open Review' } : undefined }
      case 'delivery-producer': return !styleLocked
        ? { target: 'The package', reason: 'The visual style is not locked', action: { kind: 'style', label: 'Choose a style' } }
        : { target: 'The package', reason: audit.missingAssets.length ? `${plural(audit.missingAssets.length, 'sheet')} still to approve` : 'Ready to package', action: open(analysis.assets.find((a) => missing.has(a.id)), 'Open') }
    }
  }
  /** Where a role really stands, from the project's own data: pictures waiting for a decision, assets still without an approved sheet, and what is in the queue. */
  const reviewFor = (types: AssetType[]) => queue.jobs.some((j) => j.status === 'needs-review' && ofType(types).some((x) => x.id === j.assetId))
  const designer = (types: AssetType[]): TaskGroup => {
    if (ofType(types).length === 0 || missingOf(types).length === 0) return 'complete'
    return reviewFor(types) ? 'needs-approval' : 'running'
  }
  const groupFor = (role: DepartmentRole, planned: TaskGroup): TaskGroup => {
    switch (role) {
      case 'orchestrator': return running ? 'running' : 'complete'
      case 'script-analyst': return analysis.assets.length ? 'complete' : 'running'
      case 'character-designer': return designer(['character'])
      case 'costume-designer': return designer(['costume'])
      case 'set-designer': return designer(['set', 'environment'])
      case 'prop-designer': return designer(['prop'])
      case 'matte-painter': return ofType(['set', 'environment']).length === 0 ? 'complete' : missingOf(['set', 'environment']).length ? 'blocked' : 'running'
      case 'sound-designer': return ofType(['character', 'prop']).length ? 'running' : 'complete'
      case 'qa-supervisor': return review ? 'needs-approval' : 'complete'
      default: return planned
    }
  }
  return plan.map((a) => ({
    role: a.role,
    title: a.title,
    ...detail(a.role),
    group: groupFor(a.role, a.status === 'waiting-approval' ? 'needs-approval' : a.status === 'ready' ? 'running' : a.status),
    next: a.nextAction,
    drawer: { brief: a.brief, evidence: a.evidence, dependencies: a.dependencies, cost: a.cost },
  }))
}

/** Tasks in each group, in the order the groups are shown; empty groups are left out. */
export function groupTasks(tasks: TaskItem[]): Array<{ id: TaskGroup; label: string; tasks: TaskItem[] }> {
  return taskGroups.map((g) => ({ ...g, tasks: tasks.filter((t) => t.group === g.id) })).filter((g) => g.tasks.length > 0)
}
