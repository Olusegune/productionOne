export interface GoldenPathInput {
  hasScript: boolean
  assetCount: number
  styleLocked: boolean
  outputsCount: number
  approvedCount: number
  jobsActive: number
  storyboards: boolean
  shotCount: number
  ready: boolean
}

export type GoldenState = 'done' | 'active' | 'upcoming'

export interface GoldenStep {
  id: 'create' | 'analyze' | 'design' | 'generate' | 'review' | 'direct' | 'deliver'
  label: string
  state: GoldenState
  detail: string
  workspace: 'Projects' | 'Story' | 'Design' | 'Direct' | 'Deliver'
  action: string
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Create -> Analyze -> Design -> Generate -> Review -> Deliver, with Direct inserted only when storyboards are on. Every line is derived from real project data. */
export function goldenPath(i: GoldenPathInput): { steps: GoldenStep[]; next: GoldenStep | null; progress: number } {
  const raw: Array<Omit<GoldenStep, 'state'> & { done: boolean }> = [
    { id: 'create', label: 'Create', workspace: 'Story', action: 'Add your script', done: i.hasScript, detail: i.hasScript ? 'Source material added' : 'Paste or import a script, lyrics or story' },
    { id: 'analyze', label: 'Analyze', workspace: 'Story', action: 'Analyze the script', done: i.assetCount > 0, detail: i.assetCount > 0 ? `${plural(i.assetCount, 'asset')} found` : 'Find characters, sets and props' },
    { id: 'design', label: 'Design', workspace: 'Design', action: 'Approve a visual style', done: i.styleLocked, detail: i.styleLocked ? 'Style approved and locked' : 'Choose and lock the look of the film' },
    { id: 'generate', label: 'Generate', workspace: 'Design', action: i.jobsActive > 0 ? 'Watch the queue' : 'Generate references', done: i.assetCount > 0 && i.outputsCount >= i.assetCount, detail: i.assetCount === 0 ? 'Needs analyzed assets' : i.jobsActive > 0 ? `${plural(i.jobsActive, 'job')} in progress` : `${i.outputsCount} of ${i.assetCount} references saved` },
    { id: 'review', label: 'Review', workspace: 'Design', action: 'Review and approve', done: i.assetCount > 0 && i.approvedCount >= i.assetCount, detail: i.assetCount === 0 ? 'Needs analyzed assets' : `${i.approvedCount} of ${i.assetCount} approved` },
  ]
  if (i.storyboards) raw.push({ id: 'direct', label: 'Direct', workspace: 'Direct', action: 'Plan your shots', done: i.shotCount > 0 && i.ready, detail: i.shotCount === 0 ? 'No shots planned yet' : `${plural(i.shotCount, 'shot')} planned` })
  raw.push({ id: 'deliver', label: 'Deliver', workspace: 'Deliver', action: 'Export the package', done: i.assetCount > 0 && i.ready, detail: i.assetCount > 0 && i.ready ? 'Ready to export' : 'Audit passes when every asset is approved with a verified file' })
  let activeAssigned = false
  const steps: GoldenStep[] = raw.map(({ done, ...step }) => {
    if (done) return { ...step, state: 'done' }
    if (!activeAssigned) { activeAssigned = true; return { ...step, state: 'active' } }
    return { ...step, state: 'upcoming' }
  })
  const next = steps.find((step) => step.state === 'active') ?? null
  const progress = Math.round((steps.filter((step) => step.state === 'done').length / steps.length) * 100)
  return { steps, next, progress }
}
