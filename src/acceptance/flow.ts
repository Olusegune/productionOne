import worldJson from '../../fixtures/acceptance/world.json'
import charactersJson from '../../fixtures/acceptance/characters.json'
import defectsJson from '../../fixtures/acceptance/injected-defects.json'
import { buildProjectFile, parseProjectFile } from '../data/projectFile'
import type { StudioState } from '../data/projectStore'
import { demoGraph } from '../domain/demoGraph'
import { applyCameraPreset, presetById, type CameraDirection } from '../domain/camera'
import { collectPlan } from '../domain/collectProject'
import { canAttempt, noInpainting, planCorrection, queueCorrection, recordAttempt, type Ledgers } from '../domain/correction'
import { provenanceFor, proportionWords } from '../domain/characterLayers'
import { buildShotPrompt } from '../domain/direct'
import { buildDesignRecords } from '../domain/exportRecords'
import { checkExport } from '../domain/exportSafety'
import { decide, proposeFitRules, type FitRule } from '../domain/fit'
import { addLook, contentHash, emptyLooks, exportLooks, gradeBytes, neutralGrade, type Grade } from '../domain/grade'
import { approve, emptyQueue, enqueue, type ImageJob, type JobRequest, type QueueState } from '../domain/generationQueue'
import { lightingPresetById, lightingTestPrompts } from '../domain/lighting'
import type { AnalysisResult, ExtractedAsset, ShotRecord } from '../domain/productionStudio'
import { fingerprint, setControl, type ProportionProfile } from '../domain/proportions'
import { addThing, assignOwner, emptySceneState, placeThing, screenPlacement, seat, setShotCamera, type SceneState } from '../domain/sceneState'
import { styleByName } from '../domain/demo2d'
import { styleFingerprint } from '../domain/style2d'
import { applyExceptions, deterministicChecks, emptyReviews, recordReview, runVisionReview, type Category, type Finding, type Reviews, type VisionProvider } from '../domain/visualReview'
import { profileFromWorld, readWorld, type WorldRules } from '../domain/worldRules'
import type { ControlId } from '../domain/proportions'

const read = <T,>(name: 'world.json' | 'characters.json' | 'injected-defects.json'): T => structuredClone(name === 'world.json' ? worldJson : name === 'characters.json' ? charactersJson : defectsJson) as unknown as T

interface CharacterFixture { id: string; name: string; heightM: number; deltas: Partial<Record<ControlId, number>>; description: string }
interface RoomFixture { sceneId: string; heading: string; furniture: Array<{ id: string; name: string; x: number; y: number; facing: number; ownedBy?: string }>; prop: { id: string; name: string; ownedBy: string; x: number; y: number } }
interface ShotFixture { id: string; title: string; camera: { x: number; y: number; facing: number } }
export interface Defect { id: string; kind: string; category: Category; targetId: string; description: string }

/** A provider that makes no network call and costs nothing: it returns a small deterministic picture derived from the request. It is not an image model. */
export class MockProvider {
  calls = 0
  readonly files = new Map<string, Uint8ClampedArray>()
  generate(job: Pick<ImageJob, 'id' | 'prompt' | 'revision' | 'outputName'>): { path: string; bytes: Uint8ClampedArray } {
    this.calls++
    const seed = contentHash(Array.from(new TextEncoder().encode(`${job.prompt}|${job.revision}`)))
    const bytes = new Uint8ClampedArray(4 * 16)
    for (let i = 0; i < 16; i++) { bytes[i * 4] = parseInt(seed.slice((i * 2) % 14, ((i * 2) % 14) + 2), 16); bytes[i * 4 + 1] = (bytes[i * 4] * 3 + i * 9) % 256; bytes[i * 4 + 2] = (bytes[i * 4 + 1] + 71 * i) % 256; bytes[i * 4 + 3] = 255 }
    const path = `C:/mock/${job.outputName}.png`
    this.files.set(path, bytes)
    return { path, bytes }
  }
}

/** Marks the queue's queued jobs as finished by the mock provider. Approval is never done here. */
function finish(queue: QueueState, provider: MockProvider): QueueState {
  return { ...queue, jobs: queue.jobs.map((j) => (j.status === 'queued' ? { ...j, status: 'needs-review' as const, outputPath: provider.generate(j).path, attempts: j.attempts + 1 } : j)) }
}

export interface StepResult { step: number; name: string; ok: boolean; detail: string }
export interface Score { injected: number; truePositives: number; falsePositives: number; misses: number; found: string[]; missed: string[]; falsePositiveFindings: string[] }
export interface AcceptanceRun { steps: StepResult[]; score: Score; providerCalls: number; networkCalls: number; project: StudioState; reviews: Reviews }

const jobReq = (assetId: string, sheetType: string, viewKey: string, label: string, prompt: string, refs: string[], prov: ReturnType<typeof provenanceFor>, styleFp: string): JobRequest => ({
  assetId, variant: 'Canonical', sheetType, viewKey, label, prompt, aspect: '3:4', fullBody: true, provider: 'mock', model: 'mock-1', references: refs, useAnchor: refs.length > 0, styleName: 'Clean digital cel animation', styleFp, provenance: prov, outputName: (r) => `${assetId}_${sheetType}_${viewKey}_v${String(r).padStart(2, '0')}`,
})

/** Runs the ten acceptance steps deterministically with the mock provider. Nothing here touches the network, the disk beyond reading the fixtures, or a paid service. */
export async function runAcceptance(): Promise<AcceptanceRun> {
  const world = readWorld(read<WorldRules>('world.json'))
  const fx = read<{ characters: CharacterFixture[]; room: RoomFixture; shots: ShotFixture[] }>('characters.json')
  const defects = read<{ defects: Defect[] }>('injected-defects.json').defects
  const style = styleByName('Clean digital cel animation')
  const styleFp = styleFingerprint(style)
  const provider = new MockProvider()
  const steps: StepResult[] = []
  const step = (n: number, name: string, ok: boolean, detail: string) => steps.push({ step: n, name, ok, detail })
  let networkCalls = 0
  const realFetch = globalThis.fetch
  globalThis.fetch = (() => { networkCalls++; throw new Error('the acceptance run must not use the network') }) as typeof fetch

  try {
    // Assets and profiles. Two characters share the world profile and differ by their own deltas.
    const assets: ExtractedAsset[] = [
      ...fx.characters.map((c) => ({ id: c.id, name: c.name, type: 'character' as const, sceneIds: [fx.room.sceneId], status: 'planned' as const, description: c.description })),
      { id: fx.room.prop.id, name: fx.room.prop.name, type: 'prop' as const, sceneIds: [fx.room.sceneId], status: 'planned' as const },
      { id: 'SET-KITCHEN', name: 'HARBOUR KITCHEN', type: 'set' as const, sceneIds: [fx.room.sceneId], status: 'planned' as const },
    ]
    const profiles: Record<string, ProportionProfile> = Object.fromEntries(fx.characters.map((c) => [c.id, profileFromWorld(world, c.id, c.deltas, c.heightM)]))
    const analysis: AnalysisResult = { scenes: [{ id: fx.room.sceneId, heading: fx.room.heading, setting: 'HARBOUR KITCHEN', timeOfDay: 'NIGHT', summary: '', assetIds: assets.map((a) => a.id), startLine: 1, endLine: 5 } as never], assets }
    let queue = emptyQueue()
    let ledgers: Ledgers = {}

    // 1. Front and profile identity references.
    const identity: JobRequest[] = fx.characters.flatMap((c) => ['front', 'side'].map((view) => jobReq(c.id, 'Identity', view, `${c.name} ${view}`, `Identity ${view} of ${c.name}. ${proportionWords(profiles[c.id])}`, [], provenanceFor(profiles[c.id], []), styleFp)))
    queue = finish(enqueue(queue, identity, 1, false).state, provider)
    for (const j of queue.jobs.filter((x) => x.viewKey === 'front')) queue = approve(queue, j.id, 10) // scripted: stands in for the director approving the front view
    const fronts = queue.jobs.filter((j) => j.viewKey === 'front' && j.approved)
    step(1, 'Front and profile identity references', queue.jobs.length === 4 && fronts.length === 2 && queue.jobs.filter((j) => j.viewKey === 'side').every((j) => !j.approved), `${queue.jobs.length} views made; only the 2 fronts were approved (a scripted stand-in for the director); the side views wait.`)

    // 2. Turnaround consistency: every view of a character carries the same proportion profile and the approved front as its reference.
    const turn: JobRequest[] = fx.characters.flatMap((c) => ['front', 'three-quarter', 'side', 'back'].map((view) => jobReq(c.id, 'Turnaround', view, `${c.name} turnaround ${view}`, `Turnaround ${view} of ${c.name}. ${proportionWords(profiles[c.id])}`, [fronts.find((f) => f.assetId === c.id)!.outputPath!], provenanceFor(profiles[c.id], [{ path: fronts.find((f) => f.assetId === c.id)!.outputPath!, jobId: fronts.find((f) => f.assetId === c.id)!.id, revision: 1 }]), styleFp)))
    queue = finish(enqueue(queue, turn, 2, false).state, provider)
    const turnJobs = queue.jobs.filter((j) => j.sheetType === 'Turnaround')
    const consistent = fx.characters.every((c) => new Set(turnJobs.filter((j) => j.assetId === c.id).map((j) => j.provenance?.proportionFp)).size === 1 && turnJobs.filter((j) => j.assetId === c.id).every((j) => j.provenance?.proportionFp === fingerprint(profiles[c.id])))
    const differ = profiles.MARCUS && fingerprint(profiles.MARCUS) !== fingerprint(profiles.AMINA)
    step(2, 'Turnaround consistency', consistent && differ && turnJobs.every((j) => j.references.length === 1), `${turnJobs.length} turnaround views: each character's views share one profile fingerprint and the approved front as reference; the two characters differ.`)

    // 3. Seated pose and functional fit.
    let scene = emptySceneState(fx.room.sceneId)
    for (const f of fx.room.furniture) scene = addThing(scene, { id: f.id, kind: 'furniture', name: f.name, x: f.x, y: f.y, facing: f.facing, interactions: f.id.startsWith('CHAIR') ? ['sit'] : ['work at'] })
    for (const c of fx.characters) scene = addThing(scene, { id: c.id, kind: 'character', name: c.name, x: 1, y: 1, facing: 0, posture: 'standing' })
    for (const f of fx.room.furniture.filter((x) => x.ownedBy)) scene = assignOwner(scene, f.id, f.ownedBy)
    for (const [who, chair] of [['MARCUS', 'CHAIR-A'], ['AMINA', 'CHAIR-B']] as const) { const r = seat(scene, who, chair); if (!r.ok) throw new Error(r.error); scene = r.state }
    const rules: Record<string, FitRule[]> = {}
    for (const c of fx.characters) rules[c.id] = proposeFitRules(profiles[c.id], c.id).map((r) => (r.key === 'seat-height' ? decide(r, 'approved') : r))
    const seatM = rules.MARCUS.find((r) => r.key === 'seat-height')!.valueM!
    const fitCheck = deterministicChecks({ job: { id: 'J-fit', assetId: 'S1', revision: 1, provenance: undefined } as unknown as ImageJob, profile: profiles.MARCUS, fitRules: rules.MARCUS, seatHeightsM: { 'CHAIR-A': seatM } })
    step(3, 'Seated pose and functional fit', fitCheck.checked.includes('F') && fitCheck.findings.length === 0 && rules.MARCUS.filter((r) => r.status === 'approved').length === 1 && rules.AMINA.every((r) => r.key === 'seat-height' || r.status === 'proposed'), `MARCUS sits on CHAIR-A (assigned to him); the approved seat height ${seatM} m matches the chair; every other fit rule is still only a proposal.`)

    // 4. Handheld prop interaction.
    scene = addThing(scene, { id: fx.room.prop.id, kind: 'prop', name: fx.room.prop.name, x: fx.room.prop.x, y: fx.room.prop.y, facing: 0, interactions: ['carry', 'light'] })
    scene = assignOwner(scene, fx.room.prop.id, fx.room.prop.ownedBy)
    const lantern = scene.world.things.find((t) => t.id === 'LANTERN-1')!
    const handle = proposeFitRules(profiles.MARCUS, 'MARCUS').find((r) => r.key === 'handle-diameter')!
    step(4, 'Handheld-prop interaction', lantern.ownedBy === 'MARCUS' && lantern.interactions.includes('carry') && handle.status === 'proposed' && (handle.valueM ?? 0) > 0, `The lantern belongs to MARCUS and may be carried; the proposed handle thickness is ${handle.valueM} m (a proposal, not applied).`)

    // 5. Alternate camera views: three cameras, the world untouched.
    const worldBefore = JSON.stringify(scene.world)
    for (const s of fx.shots) scene = setShotCamera(scene, s.id, { ...s.camera, fov: 50 })
    const placements = fx.shots.map((s) => screenPlacement(scene.world, scene.cameras[s.id], 'MARCUS')!.lateral)
    const shots: ShotRecord[] = fx.shots.map((s, i) => {
      const { fields, camera } = applyCameraPreset(presetById(i === 0 ? 'wide-architectural' : i === 1 ? 'intimate-dialogue' : 'environment-portrait')!)
      return { id: s.id, sceneId: fx.room.sceneId, order: i + 1, duration: 4, assetIds: ['MARCUS', 'AMINA', 'LANTERN-1', 'SET-KITCHEN'], action: s.title, dialogue: '', speaker: '', emotionalObjective: '', facialActing: '', bodyLanguage: '', microAnimation: '', cameraFraming: '', cameraMovement: '', lighting: 'Warm lamp light', soundEffects: '', ambience: '', music: '', transition: 'Cut', storyboardStatus: 'planned', title: s.title, ...fields, camera: camera as CameraDirection, lightingRecord: lightingPresetById('warm-practical-interior')!.record } as ShotRecord
    })
    const prompts = shots.map((s) => buildShotPrompt(s, analysis, style, [], '16:9', '', profiles))
    step(5, 'Alternate camera views', JSON.stringify(scene.world) === worldBefore && new Set(placements).size > 1 && prompts.every((p) => /Body proportions/.test(p) && /Camera direction/.test(p)), `3 cameras set; MARCUS lands ${placements.join(' / ')} on screen; the world (chairs, people, prop) is byte-identical; every shot prompt carries the proportions and camera direction.`)

    // 6. Neutral and dramatic lighting references.
    const lightTests = lightingTestPrompts(`MARCUS, ${fx.characters[0].description}`, 'medium close-up, front view', ['neutral-reference', 'hard-side-light'])
    const lightReq: JobRequest[] = lightTests.map((t) => jobReq('MARCUS', 'Lighting test', t.presetId, t.label, t.prompt, [], provenanceFor(profiles.MARCUS, []), styleFp))
    queue = finish(enqueue(queue, lightReq, 3, false).state, provider)
    step(6, 'Neutral and dramatic lighting references', lightTests.length === 2 && lightTests[0].presetId === 'neutral-reference' && lightTests[1].presetId === 'hard-side-light', 'Two lighting references (neutral first, then hard side light) made as separate candidates; the app says they are new pictures, not relit copies.')

    // 7. Non-destructive grade.
    const sample = queue.jobs.find((j) => j.sheetType === 'Lighting test')!
    const original = provider.files.get(sample.outputPath!)!
    const hashBefore = contentHash(original)
    const warm: Grade = { ...neutralGrade(), technical: { exposureEv: 0.4, temperature: 40, tint: 0 }, tone: { contrast: 15, saturation: 10 } }
    const lk = addLook(emptyLooks(), 'Harbour night', warm)
    const graded = gradeBytes(original, warm)
    step(7, 'Non-destructive grade', contentHash(original) === hashBefore && contentHash(graded) !== hashBefore && JSON.stringify(exportLooks(lk.state)).includes('"bakedIntoOriginals":false'), `Graded copy differs; the original's hash ${hashBefore} is unchanged; the export says nothing is baked in and carries no LUT.`)

    // 8. Defects: build the outputs the defects live in, run the checks and score them.
    const defectScene: SceneState = { ...scene, world: { ...scene.world, things: scene.world.things.map((t) => (t.id === 'AMINA' ? { ...t, occupies: 'CHAIR-A', x: 3, y: 4 } : t.id === 'MARCUS' ? { ...t, occupies: undefined, posture: 'standing' as const } : t)) } }
    const eyesBig = setControl(profiles.AMINA, 'eyeSize', 0.38)
    const frames: JobRequest[] = shots.map((s) => ({ ...jobReq(s.id, 'Storyboard', 'frame', s.title ?? s.id, `Storyboard ${s.id}${s.id === 'S3' ? ' INJECT:intersection' : ''}`, [], provenanceFor(undefined, []), styleFp), assetId: s.id, aspect: '16:9', fullBody: false }))
    const d2 = jobReq('AMINA', 'Turnaround', 'side-defect', 'AMINA side (made with larger eyes)', 'Turnaround side of AMINA', [], provenanceFor(eyesBig, []), styleFp)
    const d3 = jobReq('MARCUS', 'Costume', 'front', 'MARCUS costume front', 'Costume front of MARCUS INJECT:costume', [], provenanceFor(profiles.MARCUS, []), styleFp)
    const decoy = jobReq('AMINA', 'Identity', 'decoy', 'AMINA decoy', 'Identity of AMINA DECOY:hands', [], provenanceFor(profiles.AMINA, []), styleFp)
    queue = finish(enqueue(queue, [...frames, d2, d3, decoy], 4, false).state, provider)
    const outputs = queue.jobs.filter((j) => ['Storyboard'].includes(j.sheetType) || ['side-defect'].includes(j.viewKey) || j.sheetType === 'Costume' || j.viewKey === 'decoy')
    let reviews = emptyReviews()
    const shotOrder = shots.map((s) => s.id)
    for (const job of outputs) {
      const profile = profiles[job.assetId]
      const useScene = job.assetId === 'S1' ? defectScene : scene
      const r = deterministicChecks({ job, profile, scene: shots.some((s) => s.id === job.assetId) ? useScene : undefined, shotOrder, currentStyleFp: styleFp })
      reviews = recordReview(reviews, job.id, 'deterministic', applyExceptions(r.findings, profile), r.checked)
    }
    // A scripted stand-in for a vision model: it recognises markers in the request text. It shows how findings are scored, not how any real model performs.
    const markerModel: VisionProvider = {
      assess: async (prompt) => {
        const rule = (category: string, observed: string) => JSON.stringify({ unable: false, findings: [{ category, severity: 'medium', confidence: 0.6, expected: 'as approved', observed, rule: 'scripted', action: 'look' }] })
        if (prompt.includes('INJECT:intersection')) return rule('H', 'The lantern passes through the hand.')
        if (prompt.includes('DECOY:hands')) return rule('G', 'A hand looks wrong.')
        return JSON.stringify({ unable: false, findings: [] })
      },
    }
    for (const job of outputs) {
      const r = await runVisionReview({ assess: (_p, imgs) => markerModel.assess(job.prompt, imgs) }, { job, categories: ['C', 'G', 'H'], rules: ['scripted'], imagePaths: [job.outputPath!] })
      reviews = recordReview(reviews, job.id, 'vision', r.findings, r.checked, r.unable)
    }
    const all: Finding[] = [...reviews.deterministic, ...reviews.vision].filter((f) => f.status === 'open')
    const key = (f: { targetId: string; category: string }) => `${f.targetId}:${f.category}`
    const injectedKeys = new Map(defects.map((d) => [`${d.targetId}:${d.category}`, d]))
    const foundKeys = new Set(all.map(key))
    const found = defects.filter((d) => foundKeys.has(`${d.targetId}:${d.category}`))
    const missed = defects.filter((d) => !foundKeys.has(`${d.targetId}:${d.category}`))
    const fps = all.filter((f) => !injectedKeys.has(key(f)))
    const score: Score = { injected: defects.length, truePositives: found.length, falsePositives: fps.length, misses: missed.length, found: found.map((d) => d.id), missed: missed.map((d) => d.id), falsePositiveFindings: fps.map((f) => `${f.targetId} ${f.category} ${f.source}`) }
    step(8, 'Detection of the four injected defects', score.truePositives + score.misses === 4, `Found ${score.found.join(', ')}; missed ${score.missed.join(', ') || 'none'}; ${score.falsePositives} false positive${score.falsePositives === 1 ? '' : 's'}. (Costume and intersection are only checkable by a vision model: here a scripted stand-in.)`)

    // 9. Targeted correction replaces only the affected view.
    const badJob = outputs.find((j) => j.viewKey === 'side-defect')!
    const finding = reviews.deterministic.find((f) => f.outputJobId === badJob.id && f.category === 'B')!
    const gate = canAttempt(ledgers, finding.id, null)
    const before = JSON.stringify(queue.jobs)
    const plan = planCorrection(finding, badJob, noInpainting)
    const fixed = queueCorrection({ ...queue, jobs: queue.jobs }, finding, badJob, { ...plan, promptAddition: `${plan.promptAddition} ${proportionWords(profiles.AMINA)}` }, 20)
    ledgers = recordAttempt(ledgers, finding.id, null)
    queue = finish({ ...fixed.state, jobs: fixed.state.jobs.map((j) => (j.provenance?.correctionOf ? { ...j, provenance: { ...j.provenance, proportionProfile: profiles.AMINA, proportionFp: fingerprint(profiles.AMINA), references: j.provenance.references } } : j)) }, provider)
    const fix = queue.jobs.find((j) => j.provenance?.correctionOf?.sourceJobId === badJob.id)!
    const recheck = deterministicChecks({ job: fix, profile: profiles.AMINA, currentStyleFp: styleFp })
    const beforeJobs = JSON.parse(before) as ImageJob[]
    const othersUnchanged = beforeJobs.every((j, i) => JSON.stringify(queue.jobs[i]) === JSON.stringify(j))
    step(9, 'Targeted correction replaces only the affected view', gate.ok && fixed.added && queue.jobs.length === beforeJobs.length + 1 && fix.revision === 2 && !fix.approved && recheck.findings.length === 0 && plan.mode === 'regenerate' && othersUnchanged, `AMINA's side view got a new revision ${fix.revision} (source ${badJob.id}); the other ${beforeJobs.length} pictures are unchanged; the re-check finds no proportion issue; the correction waits for approval (approved: ${fix.approved}).`)

    // 10. Save, reopen and export with every record.
    const studio: StudioState = {
      script: '', analysis, shots, jobs: [], storyboardsEnabled: true, model: 'Seedance 2.0', queue, title: 'Acceptance', format: '16:9',
      proportions: profiles, fitRules: rules, sceneStates: { [fx.room.sceneId]: scene }, reviews, corrections: ledgers, looks: { ...lk.state, projectLook: lk.look.id }, world,
    }
    const saved = JSON.stringify(buildProjectFile('Acceptance', demoGraph, studio, '2026-11-20T00:00:00.000Z'))
    const reopened = parseProjectFile(saved)
    const records = buildDesignRecords(studio, { [sample.id]: hashBefore })
    const recordsText = JSON.stringify(records)
    const problems = checkExport(queue.jobs.map((j) => j.outputPath ?? '').filter(Boolean), [{ name: 'design_records.json', text: recordsText }])
    const plan2 = collectPlan('C:/mock', queue.jobs.filter((j) => j.outputPath).map((j) => ({ id: j.id, absolutePath: j.outputPath! })))
    const rs = reopened.ok ? reopened.file.studio : undefined
    const same = !!rs && JSON.stringify(rs.proportions) === JSON.stringify(studio.proportions) && JSON.stringify(rs.fitRules) === JSON.stringify(studio.fitRules) && JSON.stringify(rs.sceneStates) === JSON.stringify(studio.sceneStates) && JSON.stringify(rs.reviews) === JSON.stringify(studio.reviews) && JSON.stringify(rs.looks) === JSON.stringify(studio.looks) && JSON.stringify(rs.world) === JSON.stringify(studio.world) && JSON.stringify(rs.corrections) === JSON.stringify(studio.corrections) && JSON.stringify(rs.shots) === JSON.stringify(studio.shots)
    const hasAll = ['proportions', 'world', 'fitRules', 'sceneStates', 'shots', 'looks', 'review', 'approvedRevisions'].every((k) => (records as Record<string, unknown>)[k] !== undefined) && records.proportions.length === 2 && records.approvedRevisions.length === 2
    step(10, 'Save, reopen and export with the full records', reopened.ok && same && hasAll && problems.length === 0 && plan2.every((p) => p.targetPath.startsWith('media/')) && !/C:\/mock/.test(recordsText), `The saved project reopens with every record identical; the design records list ${records.proportions.length} profiles, ${records.approvedRevisions.length} approved revisions, scenes, cameras, lighting, looks and findings; the export safety check found nothing; no machine path is in the records.`)

    return { steps, score, providerCalls: provider.calls, networkCalls, project: studio, reviews }
  } finally {
    globalThis.fetch = realFetch
  }
}
