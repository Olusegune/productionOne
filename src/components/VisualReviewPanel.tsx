import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { AnalysisResult, ShotRecord } from '../domain/productionStudio'
import type { ImageJob, QueueState } from '../domain/generationQueue'
import { addException, type ProportionProfile } from '../domain/proportions'
import type { FitRule } from '../domain/fit'
import type { SceneState } from '../domain/sceneState'
import { styleFingerprint } from '../domain/style2d'
import type { StyleBible } from '../domain/visualDevelopment'
import { canAttempt, noInpainting, planCorrection, queueCorrection, recordAttempt, type Ledgers } from '../domain/correction'
import {
  applyExceptions, categories, categoryLabels, deterministicChecks, outputStatus, recordReview, runVisionReview, setFindingStatus, type Category, type Finding, type Reviews, type VisionProvider,
} from '../domain/visualReview'
import { RealImage } from './RealImage'

const STATUS_LABEL = { passed: 'Passed', 'needs-review': 'Needs review', 'not-checked': 'Not checked', 'unable-to-assess': 'Unable to assess' } as const

interface Props {
  analysis: AnalysisResult
  shots: ShotRecord[]
  queue: QueueState
  setQueue: (update: (q: QueueState) => QueueState) => void
  style: StyleBible
  reviews: Reviews
  setReviews: (update: (r: Reviews) => Reviews) => void
  ledgers: Ledgers
  setLedgers: (update: (l: Ledgers) => Ledgers) => void
  proportions: Record<string, ProportionProfile>
  setProportions: (update: (p: Record<string, ProportionProfile>) => Record<string, ProportionProfile>) => void
  fitRules: Record<string, FitRule[]>
  sceneStates: Record<string, SceneState>
  /** A local vision model, if one is set up. Absent: the vision check is not offered as available. */
  vision: { ok: true; provider: VisionProvider; model: string } | { ok: false; why: string }
  notify: (message: string) => void
}

/**
 * Visual review. "Run checks" uses only the project's own records: free, local, instant. "Check with a vision model" is a separate opt-in that uses a model on this
 * computer. Every output starts as "Not checked", and a model that cannot tell says "Unable to assess": neither is shown as clean.
 */
export function VisualReviewPanel(p: Props) {
  const { analysis, shots, queue, setQueue, style, reviews, setReviews, ledgers, setLedgers, proportions, setProportions, fitRules, sceneStates, vision, notify } = p
  const outputs = useMemo(() => queue.jobs.filter((j) => j.outputPath && !['scale-fit', 'shape-candidate', 'redesign-candidate', 'Lighting test'].includes(j.sheetType)), [queue.jobs])
  const [openFinding, setOpenFinding] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nameOf = (id: string) => analysis.assets.find((a) => a.id === id)?.name ?? shots.find((s) => s.id === id)?.title ?? id
  const sceneFor = (job: ImageJob) => { const shot = shots.find((s) => s.id === job.assetId); return shot ? { state: sceneStates[shot.sceneId], order: shots.filter((s) => s.sceneId === shot.sceneId).map((s) => s.id) } : undefined }
  const assetStyleFp = (job: ImageJob) => styleFingerprint(analysis.assets.find((a) => a.id === job.assetId)?.style ?? style)

  const runChecks = () => {
    let next = reviews
    for (const job of outputs) {
      const profile = proportions[job.assetId]
      const sc = sceneFor(job)
      const r = deterministicChecks({ job, profile, fitRules: fitRules[job.assetId], scene: sc?.state, shotOrder: sc?.order, currentStyleFp: assetStyleFp(job) })
      next = recordReview(next, job.id, 'deterministic', applyExceptions(r.findings, profile), r.checked)
    }
    setReviews(() => next)
    notify(`Checked ${outputs.length} picture${outputs.length === 1 ? '' : 's'} against your records. Categories that need a vision model were not checked.`)
  }

  const runVision = async () => {
    if (!vision.ok) { notify(vision.why); return }
    setBusy(true)
    let next = reviews
    const asked: Category[] = ['A', 'B', 'C', 'G', 'H', 'J']
    for (const job of outputs.slice(0, 12)) {
      const profile = proportions[job.assetId]
      const rules = [
        profile ? `Target proportions are intentional: ${profile.exceptions.map((e) => e.control).join(', ') || 'none marked'}. Heights and ratios come from the approved profile.` : 'No target proportions are set for this character.',
        `The picture should match the approved references and the art style ${style.name}.`,
      ]
      const imagePaths = [job.outputPath!, ...job.references.slice(0, 2)]
      const r = await runVisionReview(vision.provider, { job, categories: asked, rules, imagePaths })
      next = recordReview(next, job.id, 'vision', applyExceptions(r.findings, profile), r.checked, r.unable)
    }
    setReviews(() => next)
    setBusy(false)
    notify(`Asked ${vision.model} (on this computer) about ${Math.min(12, outputs.length)} picture${outputs.length === 1 ? '' : 's'}. Its findings are suggestions: look at each one.`)
  }

  const correct = (f: Finding, job: ImageJob) => {
    const gate = canAttempt(ledgers, f.id, queue.perImageUsd)
    if (!gate.ok) { notify(gate.reason); return }
    const plan = planCorrection(f, job, noInpainting)
    const out = queueCorrection(queue, f, job, plan)
    if (!out.added) { notify('That view already has a correction waiting.'); return }
    setQueue(() => out.state)
    setLedgers((l) => recordAttempt(l, f.id, queue.perImageUsd))
    setReviews((r) => setFindingStatus(r, f.id, 'accepted', 'Correction requested'))
    notify(`${plan.note} The new picture is a new revision and waits for your approval.`)
  }

  const markIntentional = (f: Finding) => {
    if (f.control && proportions[f.targetId]) setProportions((m) => ({ ...m, [f.targetId]: addException(m[f.targetId], f.control!, 'Marked intentional from a review finding') }))
    setReviews((r) => setFindingStatus(r, f.id, 'intentional-exception', 'Marked intentional by you'))
  }

  const findingsFor = (jobId: string) => [...reviews.deterministic, ...reviews.vision].filter((f) => f.outputJobId === jobId)
  const open = outputs.filter((j) => outputStatus(reviews, j.id).status === 'needs-review').length

  return (
    <section className="panel vr" aria-label="Visual review">
      <h3>Visual review</h3>
      <p className="helper">Checks a picture against your own records (proportions, style, layout, fit) and, if you ask, a vision model on this computer. A picture that has not been checked says so; a pass names the categories that were checked. Nothing is approved for you.</p>
      <div className="vr-actions">
        <button type="button" className="primary" onClick={runChecks} disabled={!outputs.length}>Run checks on {outputs.length} picture{outputs.length === 1 ? '' : 's'}</button>
        <button type="button" className="secondary" onClick={() => void runVision()} disabled={!outputs.length || busy} title={vision.ok ? `Uses ${vision.model} on this computer` : vision.why}>{busy ? 'Asking…' : 'Check with a vision model (this computer)'}</button>
      </div>
      {!vision.ok && <small className="helper">{vision.why} Vision checking is optional; accuracy has not been measured against human-labelled examples.</small>}
      <small className="helper" role="status">{outputs.length ? `${open} picture${open === 1 ? '' : 's'} need${open === 1 ? 's' : ''} review.` : 'No pictures to check yet.'}</small>
      <ul className="vr-list" aria-label="Review results">
        {outputs.map((job) => {
          const st = outputStatus(reviews, job.id)
          const list = findingsFor(job.id)
          return (
            <li key={job.id} className="vr-item">
              <div><b>{nameOf(job.assetId)} · {job.label}</b> <small>revision {job.revision}</small> <span className={`vr-badge ${st.status}`}>{STATUS_LABEL[st.status]}</span>
                {st.checkedCategories.length > 0 && <small> checked: {st.checkedCategories.map((c) => categoryLabels[c]).join(', ')}</small>}
                {st.status === 'not-checked' && <small> (no check has been run: this is not a pass)</small>}</div>
              {list.map((f) => (
                <div key={f.id} className="vr-finding">
                  <AlertTriangle size={12} /> <b>{f.category} · {categoryLabels[f.category]}</b> ({f.severity}, {Math.round(f.confidence * 100)}% sure, {f.source}) · {f.status === 'open' ? f.observed : `${f.status}${f.reason ? `: ${f.reason}` : ''}`}
                  {openFinding === f.id && (
                    <div className="vr-evidence" role="group" aria-label="Evidence">
                      <RealImage path={job.outputPath} label={`Output ${job.label}`} empty="No picture" />
                      <p><b>Expected:</b> {f.expected}</p><p><b>Observed:</b> {f.observed}</p><p><b>Rule:</b> {f.sourceRule}</p><p><b>Suggested:</b> {f.suggestedAction}</p>
                      {f.region && <p><b>Where:</b> {Math.round(f.region.x * 100)}% across, {Math.round(f.region.y * 100)}% down, {Math.round(f.region.w * 100)}% by {Math.round(f.region.h * 100)}%</p>}
                    </div>
                  )}
                  <div className="vr-actions">
                    <button type="button" className="secondary" onClick={() => setOpenFinding(openFinding === f.id ? null : f.id)}>{openFinding === f.id ? 'Hide evidence' : 'View evidence'}</button>
                    {f.status === 'open' && <>
                      <button type="button" className="secondary" onClick={() => setReviews((r) => setFindingStatus(r, f.id, 'accepted', 'Accepted: you agree it is a problem'))}>Accept</button>
                      <button type="button" className="secondary" onClick={() => setReviews((r) => setFindingStatus(r, f.id, 'dismissed', 'Dismissed by you'))}>Dismiss</button>
                      <button type="button" className="secondary" onClick={() => markIntentional(f)}>Mark intentional</button>
                      <button type="button" className="secondary" onClick={() => correct(f, job)}>Regenerate this view with a fix</button>
                    </>}
                    {f.status !== 'open' && <button type="button" className="secondary" onClick={() => setReviews((r) => setFindingStatus(r, f.id, 'open'))}>Reopen</button>}
                  </div>
                  {(ledgers[f.id]?.attempts ?? 0) > 0 && <small>{ledgers[f.id].attempts} correction attempt{ledgers[f.id].attempts === 1 ? '' : 's'}, about ${ledgers[f.id].spentUsd.toFixed(2)} spent (limit 3 attempts, $1.00).</small>}
                </div>
              ))}
              {queue.jobs.filter((j) => j.provenance?.correctionOf?.sourceJobId === job.id).map((fix) => (
                <div key={fix.id} className="vr-compare"><small>Correction (revision {fix.revision}, {fix.approved ? 'approved' : 'waits for your approval'}):</small>
                  <div className="fit-compare"><figure><RealImage path={job.outputPath} label="Before" empty="No picture" /><figcaption>Before (revision {job.revision})</figcaption></figure><figure><RealImage path={fix.outputPath} label="After" empty="Not ready yet" /><figcaption>After (revision {fix.revision})</figcaption></figure></div>
                </div>
              ))}
            </li>
          )
        })}
      </ul>
      <small className="helper">Categories: {categories.map((c) => `${c} ${categoryLabels[c]}`).join(' · ')}. This app can check B, E, F and I from records; the rest need a vision model or your eyes.</small>
    </section>
  )
}
