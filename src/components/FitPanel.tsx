import { useMemo, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Check, Ruler, Sparkles, X } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import { decide, mergeProposals, proposeFitRules, scaleFitSheet, setIntent, type FitIntent, type FitRule } from '../domain/fit'
import { WARP_LABEL, compare, estimateLandmarks, redesignRequest, uncertain, warpBands, type RedesignRequest } from '../domain/redesign'
import { createProfile, type ProportionProfile } from '../domain/proportions'
import '../proportions.css'

export interface PictureCandidate { id: string; path?: string; status: string; approved: boolean }

interface Props {
  asset: ExtractedAsset
  profile: ProportionProfile
  rules: FitRule[]
  onRules: (rules: FitRule[]) => void
  /** Every character that has a profile, for the Scale and Fit sheet. */
  people: Array<{ name: string; profile: ProportionProfile }>
  /** Asks for one Scale and Fit reference picture. Only called when the person presses the button. */
  onGenerateScaleSheet: (prompt: string) => void
  /** The imported picture of this character, if there is one. Never changed or replaced. */
  originalPath?: string
  redesignCandidates: PictureCandidate[]
  onGenerateRedesign: (request: RedesignRequest) => void
  /** Approves a candidate as a new revision. Only called when the person presses Approve. */
  onApproveCandidate: (jobId: string) => void
  /** Approved views made with an earlier version of the proportions. They are left as they are. */
  staleViews: number
  notify: (message: string) => void
}

const groupLabel = { functional: 'Functional fit', visual: 'Visual language', spatial: 'Spatial layout' } as const

/** Fit rules proposed from a character's proportions, the Scale and Fit sheet, and redesigning an imported character. Nothing here applies itself. */
export function FitPanel({ asset, profile, rules, onRules, people, onGenerateScaleSheet, originalPath, redesignCandidates, onGenerateRedesign, onApproveCandidate, staleViews, notify }: Props) {
  const proposals = useMemo(() => mergeProposals(rules, proposeFitRules(profile, asset.id)), [rules, profile, asset.id])
  const sheet = useMemo(() => scaleFitSheet(people.length ? people : [{ name: asset.name, profile }]), [people, asset.name, profile])
  const [warp, setWarp] = useState(false)
  const natural = useMemo(() => createProfile(asset.id), [asset.id])
  const bands = useMemo(() => warpBands(natural, profile), [natural, profile])
  const landmarks = useMemo(() => estimateLandmarks(natural), [natural])
  const latest = redesignCandidates[redesignCandidates.length - 1]
  const update = (rule: FitRule, next: FitRule) => onRules(proposals.map((r) => (r.key === rule.key ? next : r)))
  const sameAsSaved = rules.length === proposals.length && rules.every((r, i) => JSON.stringify(r) === JSON.stringify(proposals[i]))

  return (
    <section className="prop-panel panel" aria-label="Fit rules and scale">
      <h4>Fit, scale and redesign · {asset.name}</h4>
      {staleViews > 0 && <p className="helper" role="status">{staleViews} approved view{staleViews === 1 ? ' was' : 's were'} made with earlier proportions. They are left as they are; regenerate the ones you want to match.</p>}

      <h5>Proposed rules for sets and props <small>from the target proportions · illustrative, {profile.heightM} m tall</small></h5>
      <p className="helper">These are proposals. Nothing is applied until you approve it, and a tight or oversized space is allowed: mark it intentional.</p>
      {(['functional', 'spatial', 'visual'] as const).map((cat) => (
        <div key={cat}>
          <b className="prop-cat">{groupLabel[cat]}</b>
          <ul className="fit-list">
            {proposals.filter((r) => r.category === cat).map((r) => (
              <li key={r.key} className={`fit-${r.status}`}>
                <span><b>{r.label}</b>: {r.text} {r.newerValueM !== undefined && <i>(the proportions now suggest {r.newerValueM} m)</i>}</span>
                <span className="fit-actions">
                  <small>{r.status}{r.intent !== 'fit' ? `, intentionally ${r.intent}` : ''}</small>
                  {r.status !== 'approved' && <button type="button" className="secondary" aria-label={`Approve ${r.label}`} onClick={() => update(r, decide(r, 'approved'))}><Check size={12} /></button>}
                  {r.status !== 'rejected' && <button type="button" className="secondary" aria-label={`Reject ${r.label}`} onClick={() => update(r, decide(r, 'rejected'))}><X size={12} /></button>}
                  {r.valueM !== undefined && (['cramped', 'oversized'] as FitIntent[]).map((i) => <button key={i} type="button" className="secondary" aria-label={`Make ${r.label} intentionally ${i}`} onClick={() => update(r, setIntent(r, i))}>{i}</button>)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!sameAsSaved && <button type="button" className="secondary" onClick={() => onRules(proposals)}>Save these proposals</button>}

      <h5><Ruler size={13} /> Scale and Fit reference sheet</h5>
      <p className="helper">{sheet.convention}</p>
      <table className="fit-table" aria-label="Scale and Fit measurements">
        <tbody>{sheet.measures.map((m) => <tr key={m.item}><td>{m.label}</td><td>{m.valueM} m</td><td><i>{m.basis}</i></td></tr>)}</tbody>
      </table>
      <small className="helper">{sheet.basisNote}</small>
      <button type="button" className="primary" onClick={() => { onGenerateScaleSheet(sheet.prompt); notify('Asked for one Scale and Fit reference picture.') }}><Sparkles size={13} /> Generate Scale and Fit reference</button>

      {originalPath && (
        <>
          <h5>Redesign the imported picture</h5>
          <p className="helper">The original is never changed. Landmark positions below are estimates until you confirm them; a redesign is a newly generated candidate that you compare and approve as a new revision.</p>
          <ul className="fit-list" aria-label="Landmark estimates">{landmarks.map((l) => <li key={l.id}>{l.id}: {Math.round(l.y * 100)}% down <i>{l.certainty === 'estimated' ? 'estimated, uncertain' : 'confirmed'}</i></li>)}</ul>
          {uncertain(landmarks).length > 0 && <small className="helper">{uncertain(landmarks).length} landmark estimates are uncertain.</small>}
          <label className="dr-check"><input type="checkbox" checked={warp} onChange={(e) => setWarp(e.target.checked)} aria-label="Show warp preview" /> Show a stretched preview</label>
          <div className="fit-compare">
            <figure><img src={convertFileSrc(originalPath)} alt="Original" style={warp ? { transform: `scaleY(${(bands.reduce((s, b) => s + (b.to[1] - b.to[0]), 0) / Math.max(0.01, bands.reduce((s, b) => s + (b.from[1] - b.from[0]), 0))).toFixed(3)})`, transformOrigin: 'top' } : undefined} /><figcaption>{warp ? 'Original (stretched preview)' : 'Original'}</figcaption></figure>
            {latest?.path && <figure><img src={convertFileSrc(latest.path)} alt="Redesign candidate" /><figcaption>Redesign candidate</figcaption></figure>}
          </div>
          {warp && <small className="helper" role="note">{WARP_LABEL}</small>}
          <div className="dr-tools">
            <button type="button" className="primary" onClick={() => { onGenerateRedesign(redesignRequest(asset.id, asset.name, originalPath, profile)); notify('Asked for one redesign candidate.') }}><Sparkles size={13} /> Generate redesign candidate</button>
            {latest?.path && compare(originalPath, latest.path).ready && !latest.approved && <button type="button" className="secondary" onClick={() => onApproveCandidate(latest.id)}>Approve as a new revision</button>}
            {latest?.approved && <small className="helper">Approved as a new revision. The original is unchanged.</small>}
          </div>
        </>
      )}
    </section>
  )
}
