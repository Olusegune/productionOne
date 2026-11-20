import { useEffect, useMemo, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { AlertTriangle, Redo2, RotateCcw, Sparkles, Undo2 } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import {
  addException, commit, controlSpecs, createProfile, describe as describeProfile, newHistory, overrideCount, presets, ratios, redo, removeException, resetControl, resetProfile,
  schematic, setControl, setPreset, setStylization, undo, warnings, type ControlSpec, type History, type PresetId, type ProportionProfile,
} from '../domain/proportions'
import type { WorldRules } from '../domain/worldRules'
import '../proportions.css'

export interface Candidate { id: string; path?: string; status: string }

interface Props {
  asset: ExtractedAsset
  profile: ProportionProfile | undefined
  onChange: (profile: ProportionProfile | undefined) => void
  /** Asks an image model for ONE candidate picture of the target proportions. Only called when the person presses the button. */
  onGenerate: (asset: ExtractedAsset, prompt: string) => void
  candidates: Candidate[]
  approvedViews: number
  /** The profile a new character starts from (the world default, or Natural). */
  startFrom?: () => ProportionProfile
  world?: WorldRules
  onSetWorld?: (world: WorldRules) => void
  notify: (message: string) => void
}

export function Mannequin({ profile }: { profile: ProportionProfile }) {
  const art = useMemo(() => schematic(profile), [profile])
  return (
    <svg className="prop-svg" viewBox={`0 0 ${art.width} ${art.height}`} role="img" aria-label="Schematic preview of the target proportions" data-testid="schematic">
      {art.shapes.map((s) => {
        if (s.kind === 'ellipse') return <ellipse key={s.id} data-shape={s.id} cx={(s.x) + (s.w ?? 0) / 2} cy={s.y + (s.h ?? 0) / 2} rx={(s.w ?? 0) / 2} ry={(s.h ?? 0) / 2} />
        if (s.kind === 'rect') return <rect key={s.id} data-shape={s.id} x={s.x} y={s.y} width={s.w} height={s.h} rx={3} />
        return <line key={s.id} data-shape={s.id} x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} />
      })}
    </svg>
  )
}

function Slider({ spec, profile, onSet, onReset, excused }: { spec: ControlSpec; profile: ProportionProfile; onSet: (v: number) => void; onReset: () => void; excused: boolean }) {
  const c = profile.controls[spec.id]
  return (
    <div className={`prop-row ${c.source}`}>
      <label htmlFor={`prop-${spec.id}`} title={spec.measure}>{spec.label}</label>
      <input id={`prop-${spec.id}`} type="range" min={spec.min} max={spec.max} step={spec.step} value={c.value} onChange={(e) => onSet(Number(e.target.value))} aria-label={spec.label} />
      <output>{c.value} <small>{spec.unit}</small></output>
      <button type="button" className="secondary prop-reset" onClick={onReset} disabled={c.source === 'default'} aria-label={`Reset ${spec.label}`}><RotateCcw size={12} /></button>
      {excused && <small className="prop-excused">intentional</small>}
    </div>
  )
}

/** Target proportions for one character. Four things are kept apart on screen: the target, the schematic drawn from it, a generated interpretation, and the approved design. */
export function ProportionPanel({ asset, profile, onChange, onGenerate, candidates, approvedViews, startFrom, world, onSetWorld, notify }: Props) {
  const [history, setHistory] = useState<History<ProportionProfile> | null>(profile ? newHistory(profile) : null)
  useEffect(() => { setHistory(profile ? newHistory(profile) : null) }, [asset.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = history?.present
  const apply = (next: ProportionProfile) => { setHistory((h) => (h ? commit(h, next) : newHistory(next))); onChange(next) }
  const step = (dir: 'undo' | 'redo') => setHistory((h) => { if (!h) return h; const n = dir === 'undo' ? undo(h) : redo(h); if (n !== h) onChange(n.present); return n })
  const warns = useMemo(() => (current ? warnings(current) : []), [current])
  const rs = useMemo(() => (current ? ratios(current) : null), [current])
  const excused = new Set(current?.exceptions.map((e) => e.control))
  const [more, setMore] = useState(false)

  if (!current) {
    return (
      <section className="prop-panel panel" aria-label="Target proportions">
        <h4>Shape and proportions</h4>
        <p className="helper">Optional. Set the target body and face proportions for {asset.name}: tall or compact, long limbs, large eyes, angular or rounded. Nothing changes for this character until you set them, and style changes never reset them.</p>
        <button type="button" className="primary" onClick={() => apply(startFrom ? startFrom() : createProfile(asset.id))}>Set target proportions{world?.profile ? ` (from the world default: ${presets.find((p) => p.id === world.profile!.preset)?.label})` : ''}</button>
      </section>
    )
  }
  const main = controlSpecs.filter((c) => c.main)
  const rest = controlSpecs.filter((c) => !c.main)
  const words = describeProfile(current)
  return (
    <section className="prop-panel panel" aria-label="Target proportions">
      <div className="prop-head">
        <h4>Shape and proportions · {asset.name}</h4>
        <div className="prop-tools">
          <button type="button" className="secondary" onClick={() => step('undo')} disabled={!history?.past.length} aria-label="Undo"><Undo2 size={13} /></button>
          <button type="button" className="secondary" onClick={() => step('redo')} disabled={!history?.future.length} aria-label="Redo"><Redo2 size={13} /></button>
          <button type="button" className="secondary" onClick={() => apply(resetProfile(current))} disabled={!overrideCount(current) && !current.exceptions.length && current.stylization === presets.find((p) => p.id === current.preset)!.stylization}>Reset profile</button>
          {onSetWorld && <button type="button" className="secondary" onClick={() => { onSetWorld({ ...(world ?? { scaleConvention: 'metres' as const }), profile: { preset: current.preset, stylization: current.stylization } }); notify(`New characters will start from ${presets.find((p) => p.id === current.preset)?.label} at stylization ${current.stylization}.`) }}>Use as the world default</button>}
          <button type="button" className="secondary" onClick={() => { onChange(undefined); setHistory(null); notify(`Target proportions cleared for ${asset.name}.`) }}>Remove</button>
        </div>
      </div>
      <div className="prop-grid">
        <div className="prop-layer" aria-label="Target proportions controls">
          <h5>1 · Target proportions <small>what you want</small></h5>
          <label className="prop-line">Starting point
            <select value={current.preset} onChange={(e) => apply(setPreset(current, e.target.value as PresetId))} aria-label="Starting profile">
              {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <small className="helper">{presets.find((p) => p.id === current.preset)?.note} These are starting points, not rules.</small>
          <div className="prop-row"><label htmlFor="prop-stylization">Stylization</label><input id="prop-stylization" type="range" min={0} max={100} step={1} value={current.stylization} onChange={(e) => apply(setStylization(current, Number(e.target.value)))} aria-label="Stylization" /><output>{current.stylization}</output><span /></div>
          {main.map((spec) => <Slider key={spec.id} spec={spec} profile={current} excused={excused.has(spec.id)} onSet={(v) => apply(setControl(current, spec.id, v))} onReset={() => apply(resetControl(current, spec.id))} />)}
          <button type="button" className="secondary" onClick={() => setMore((m) => !m)} aria-expanded={more}>{more ? 'Fewer controls' : `More controls (${rest.length})`}</button>
          {more && rest.map((spec) => <Slider key={spec.id} spec={spec} profile={current} excused={excused.has(spec.id)} onSet={(v) => apply(setControl(current, spec.id, v))} onReset={() => apply(resetControl(current, spec.id))} />)}
        </div>
        <div className="prop-layer">
          <h5>2 · Schematic preview <small>a diagram, not a picture of {asset.name}</small></h5>
          <Mannequin profile={current} />
          {rs && <small className="helper">Stacked height {rs.stackedHeight} heads · legs to torso {rs.legToTorso} · shoulders to hips {rs.shoulderToHip}</small>}
          {warns.length > 0 && (
            <ul className="prop-warnings" aria-label="Proportion warnings">
              {warns.map((w) => (
                <li key={w.id}><AlertTriangle size={13} /> {w.message} {w.controls.length === 1 && <button type="button" className="linklike" onClick={() => apply(addException(current, w.controls[0], 'Intentional'))}>This is intentional</button>}</li>
              ))}
            </ul>
          )}
          {current.exceptions.length > 0 && <p className="helper">Intentional: {current.exceptions.map((e) => <span key={e.control} className="prop-chip">{controlSpecs.find((c) => c.id === e.control)?.label} <button type="button" className="linklike" aria-label={`Stop treating ${e.control} as intentional`} onClick={() => apply(removeException(current, e.control))}>×</button></span>)}</p>}
        </div>
        <div className="prop-layer">
          <h5>3 · Generated interpretation <small>an AI candidate, not approved</small></h5>
          <p className="helper">Moving a slider never contacts an image model. Press the button to ask for one candidate; it uses one image request.</p>
          <button type="button" className="primary" onClick={() => { onGenerate(asset, [asset.description ?? asset.name, words, 'Full-body neutral standing pose, front view, plain background.'].filter(Boolean).join(' ')); notify(`Asked for one candidate of ${asset.name}.`) }}><Sparkles size={13} /> Generate preview</button>
          <div className="prop-candidates">
            {candidates.length === 0 && <small className="helper">No candidate yet.</small>}
            {candidates.map((c) => c.path ? <img key={c.id} src={convertFileSrc(c.path)} alt={`Candidate for ${asset.name}`} /> : <small key={c.id}>{c.status}…</small>)}
          </div>
        </div>
        <div className="prop-layer">
          <h5>4 · Approved design <small>what you have signed off</small></h5>
          <p className="helper">{approvedViews > 0 ? `${approvedViews} approved view${approvedViews === 1 ? '' : 's'} for ${asset.name}.` : `Nothing approved yet for ${asset.name}.`} Changing the target does not change approved work; make new views from the Sheets tab and approve them there.</p>
        </div>
      </div>
    </section>
  )
}
