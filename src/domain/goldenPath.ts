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
  /** Optional extras. Each appears only once the person has started using it, so projects that do not use it look exactly as before. */
  shape?: { characters: number; withProfile: number }
  camera?: { shots: number; withDetails: number }
  visualReview?: { checked: number; needReview: number }
}

export type GoldenState = 'done' | 'active' | 'upcoming'

export interface GoldenStep {
  id: 'create' | 'analyze' | 'design' | 'generate' | 'review' | 'direct' | 'deliver' | 'shape' | 'camera' | 'visual-review'
  label: string
  state: GoldenState
  detail: string
  workspace: 'Projects' | 'Story' | 'Design' | 'Direct' | 'Deliver'
  action: string
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Create -> Analyze -> Design -> Generate -> Review -> Deliver, with Direct inserted only when storyboards are on. Every line is derived from real project data. */
export function goldenPath(i: GoldenPathInput): { steps: GoldenStep[]; next: GoldenStep | null; progress: number; extras: GoldenStep[] } {
  const raw: Array<Omit<GoldenStep, 'state'> & { done: boolean }> = [
    { id: 'create', label: 'Create', workspace: 'Story', action: 'Add your script', done: i.hasScript || i.assetCount > 0, detail: i.hasScript ? 'Source material added' : i.assetCount > 0 ? 'Started from your own images' : 'Paste or import a script, lyrics or story, or add your own images in Design' },
    { id: 'analyze', label: 'Analyze', workspace: 'Story', action: 'Analyze the script', done: i.assetCount > 0, detail: i.assetCount > 0 ? (i.hasScript ? `${plural(i.assetCount, 'asset')} found` : `${plural(i.assetCount, 'asset')} added`) : 'Find characters, sets and props' },
    { id: 'design', label: 'Design', workspace: 'Design', action: 'Approve a visual style', done: i.styleLocked, detail: i.styleLocked ? 'Style approved and locked' : 'Choose and lock the look of the film' },
    { id: 'generate', label: 'Generate', workspace: 'Design', action: i.jobsActive > 0 ? 'Watch the queue' : 'Generate references', done: i.assetCount > 0 && i.outputsCount >= i.assetCount, detail: i.assetCount === 0 ? 'Needs assets: analyze a script or add your own images' : i.jobsActive > 0 ? `${plural(i.jobsActive, 'job')} in progress` : `${i.outputsCount} of ${i.assetCount} references saved` },
    { id: 'review', label: 'Review', workspace: 'Design', action: 'Review and approve', done: i.assetCount > 0 && i.approvedCount >= i.assetCount, detail: i.assetCount === 0 ? 'Needs assets' : `${i.approvedCount} of ${i.assetCount} approved` },
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
  return { steps, next, progress, extras: extraSteps(i) }
}

/**
 * Recommended, skippable steps. They never become the "next step", never count toward progress and never block Deliver; they only report where an optional
 * part of the work stands. A step is listed only after the person has started it.
 */
export function extraSteps(i: GoldenPathInput): GoldenStep[] {
  const out: GoldenStep[] = []
  if (i.shape && i.shape.withProfile > 0) {
    const all = i.shape.withProfile >= i.shape.characters
    out.push({ id: 'shape', label: 'Shape', workspace: 'Design', action: 'Set target proportions', state: all ? 'done' : 'upcoming', detail: `${i.shape.withProfile} of ${plural(i.shape.characters, 'character')} ${i.shape.withProfile === 1 && i.shape.characters !== 1 ? 'has' : 'have'} target proportions (optional)` })
  }
  if (i.camera && i.camera.withDetails > 0) {
    out.push({ id: 'camera', label: 'Camera and light', workspace: 'Direct', action: 'Add camera and lighting direction', state: i.camera.withDetails >= i.camera.shots ? 'done' : 'upcoming', detail: `${i.camera.withDetails} of ${plural(i.camera.shots, 'shot')} ${i.camera.withDetails === 1 && i.camera.shots !== 1 ? 'has' : 'have'} camera or lighting direction (optional)` })
  }
  if (i.visualReview && i.visualReview.checked > 0) {
    const n = i.visualReview.needReview
    out.push({ id: 'visual-review', label: 'Visual review', workspace: 'Design', action: 'Look at the review findings', state: n === 0 ? 'done' : 'upcoming', detail: n === 0 ? `${plural(i.visualReview.checked, 'picture')} checked, nothing needs review (optional)` : `${plural(n, 'picture')} need${n === 1 ? 's' : ''} review (optional)` })
  }
  return out
}
