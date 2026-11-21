import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { convertFileSrc } from '@tauri-apps/api/core'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Crosshair, Redo2, RotateCcw, Sparkles, Trash2, Undo2 } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import {
  addException, applyCustomPreset, commit, controlSpecs, createProfile, describe as describeProfile, newHistory, overrideCount, presets, ratios, redo, removeException, resetControl, resetProfile,
  setControl, setHeightM, setLinked, setPreset, setStylization, tabOf, toCustomPreset, undo, warnings, HEIGHT_RANGE_M, type ControlSpec, type ControlTab, type History, type PresetId, type ProportionProfile,
} from '../domain/proportions'
import { deletePreset, readPresets, savePreset } from '../data/proportionPresets'
import type { WorldRules } from '../domain/worldRules'
import { Mannequin } from './Mannequin'
import { ProportionsIcon } from './ProportionsIcon'
import { RealImage } from './RealImage'
import '../proportions.css'
import '../workspace.css'

export { Mannequin }

export interface Candidate { id: string; path?: string; status: string }

interface Props {
  asset: ExtractedAsset
  /** The proportions applied to this character (the ones prompts and checks use). What is edited on screen is a draft until Apply proportions. */
  profile: ProportionProfile | undefined
  onChange: (profile: ProportionProfile | undefined) => void
  /** Asks an image model for ONE candidate picture of the target proportions. Only called when the person presses the button. */
  onGenerate: (asset: ExtractedAsset, prompt: string) => void
  candidates: Candidate[]
  approvedViews: number
  /** What one candidate is likely to cost, for the button (for example "about $0.04"). */
  cost?: string
  /** The profile a new character starts from (the world default, or Natural). */
  startFrom?: () => ProportionProfile
  world?: WorldRules
  onSetWorld?: (world: WorldRules) => void
  /** The approved picture of this character, shown for reference beside the figure. */
  referencePath?: string
  /** The other characters, so the same proportions can be given to them in one step. */
  others?: Array<{ id: string; name: string }>
  onApplyTo?: (ids: string[], profile: ProportionProfile) => void
  /** Opens this character's Sheets, where pictures are made (used by "Apply and make pictures"). */
  onOpenSheets?: () => void
  notify: (message: string) => void
}

/** Edits that have not been applied yet, kept per character so switching to another asset and back does not lose them. */
const drafts = new Map<string, History<ProportionProfile>>()

const sameProfile = (a: ProportionProfile | undefined, b: ProportionProfile | undefined) => JSON.stringify(a) === JSON.stringify(b)

/**
 * A number you can type into. A value inside the allowed range takes effect as you type or use the arrows (so the figure follows); a value outside it waits until you
 * leave the field or press Enter, and is then pulled back into range. Escape puts back what was there.
 */
function NumberField({ id, value, min, max, step, label, onCommit }: { id?: string; value: number; min: number; max: number; step: number; label: string; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  // Follow the value from outside, but never rewrite what is being typed ("1." is on its way to "1.2").
  useEffect(() => { setText((cur) => (cur.trim() !== '' && Number(cur) === value ? cur : String(value))) }, [value])
  const live = (raw: string) => {
    setText(raw)
    const n = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(n) && n >= min && n <= max && n !== value) onCommit(n)
  }
  const commitText = () => {
    const n = Number(text)
    if (text.trim() === '' || !Number.isFinite(n)) { setText(String(value)); return }
    const clamped = Math.min(max, Math.max(min, n))
    setText(String(clamped))
    if (clamped !== value) onCommit(clamped)
  }
  return <input id={id} className="prop-num" type="number" inputMode="decimal" aria-label={label} min={min} max={max} step={step} value={text} onChange={(e) => live(e.target.value)} onBlur={commitText} onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setText(String(value)) }} />
}

function ControlRow({ spec, profile, onSet, onReset, excused }: { spec: ControlSpec; profile: ProportionProfile; onSet: (v: number) => void; onReset: () => void; excused: boolean }) {
  const c = profile.controls[spec.id]
  return (
    <div className={`prop-row ${c.source}`}>
      <label htmlFor={`prop-${spec.id}`} title={spec.measure}>{spec.label}</label>
      <NumberField id={`prop-num-${spec.id}`} value={c.value} min={spec.min} max={spec.max} step={spec.step} label={`${spec.label} value`} onCommit={onSet} />
      <span className="prop-unit">{spec.shown ?? spec.unit}</span>
      <button type="button" className="prop-reset" onClick={onReset} disabled={c.source === 'default'} aria-label={`Reset ${spec.label}`} title="Back to the starting value"><RotateCcw size={13} /></button>
      <input id={`prop-${spec.id}`} type="range" min={spec.min} max={spec.max} step={spec.step} value={c.value} onChange={(e) => onSet(Number(e.target.value))} aria-label={spec.label} />
      {excused && <small className="prop-excused">intentional</small>}
    </div>
  )
}

const tabs: Array<{ id: ControlTab; label: string }> = [{ id: 'body', label: 'Body' }, { id: 'face', label: 'Face' }, { id: 'advanced', label: 'Advanced' }]

/**
 * Shape and proportions for one character. Three things are kept apart on screen and in what they do: moving a control only redraws the schematic (it never reaches a
 * provider), Apply proportions makes the draft the character's real target (prompts and checks use it), and Generate design preview asks a model for one picture.
 */
export function ProportionPanel({ asset, profile, onChange, onGenerate, candidates, approvedViews, cost, startFrom, world, onSetWorld, referencePath, others = [], onApplyTo, onOpenSheets, notify }: Props) {
  const start = (): History<ProportionProfile> | null => drafts.get(asset.id) ?? (profile ? newHistory(profile) : null)
  const [history, setHistory] = useState<History<ProportionProfile> | null>(start)
  useEffect(() => { setHistory(start()) }, [asset.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Applied proportions changed from elsewhere (another screen, undo): follow them unless there is an unapplied draft.
  useEffect(() => { if (!drafts.has(asset.id)) setHistory(profile ? newHistory(profile) : null) }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = history?.present
  const dirty = !!current && !sameProfile(current, profile)
  const [tab, setTab] = useState<ControlTab>('body')
  const [view, setView] = useState<'front' | 'compare'>('front')
  const [linked, setLinked_] = useState(true)
  const [scope, setScope] = useState<'character' | 'others' | 'world'>('character')
  const [shareWith, setShareWith] = useState<Set<string>>(new Set())
  const [leaving, setLeaving] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const goBackRef = useRef<() => void>(() => setOpen(false))
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) goBackRef.current() }; window.addEventListener('keydown', onKey); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev } }, [open])
  const [mine, setMine] = useState(readPresets)

  const keep = (h: History<ProportionProfile> | null) => { if (h && !sameProfile(h.present, profile)) drafts.set(asset.id, h); else drafts.delete(asset.id); setHistory(h) }
  const edit = (next: ProportionProfile) => keep(history ? commit(history, next) : newHistory(next))
  const step = (dir: 'undo' | 'redo') => { if (!history) return; keep(dir === 'undo' ? undo(history) : redo(history)) }
  const setValue = (id: ControlSpec['id'], v: number) => { if (current) edit(linked ? setLinked(current, id, v) : setControl(current, id, v)) }
  const applyNow = (): boolean => {
    if (!current) return false
    onChange(current)
    drafts.delete(asset.id)
    setHistory(newHistory(current))
    if (scope === 'others' && onApplyTo && shareWith.size > 0) {
      const names = others.filter((o) => shareWith.has(o.id)).map((o) => o.name)
      onApplyTo([...shareWith], current)
      notify(`Proportions applied to ${asset.name} and ${names.join(', ')}. New pictures of each use them; approved pictures are not changed.`)
      return true
    }
    if (scope === 'world' && onSetWorld) {
      onSetWorld({ ...(world ?? { scaleConvention: 'metres' as const }), profile: { preset: current.preset, stylization: current.stylization } })
      notify(`Applied to ${asset.name}. New characters will start from ${presets.find((p) => p.id === current.preset)?.label ?? 'this profile'} at stylization ${current.stylization}; characters that already have proportions are not changed.`)
    } else notify(`Proportions applied to ${asset.name}. New pictures use them; approved pictures are not changed.`)
    return true
  }
  /** Leaving with edits that are not applied asks first, so a set of changes is never quietly lost (or quietly ignored). */
  const goBack = () => { if (dirty) setLeaving(true); else setOpen(false) }
  goBackRef.current = goBack
  const discard = () => { drafts.delete(asset.id); setHistory(profile ? newHistory(profile) : null) }

  const warns = useMemo(() => (current ? warnings(current) : []), [current])
  const conflicts = warns.filter((w) => w.level === 'conflict')
  const considerations = warns.filter((w) => w.level !== 'conflict')
  const rs = useMemo(() => (current ? ratios(current) : null), [current])
  const excused = new Set(current?.exceptions.map((e) => e.control))
  const presetLabel = (p: PresetId) => presets.find((x) => x.id === p)?.label ?? p

  const state = !current ? 'Not set · uses existing design' : dirty ? `Draft not applied · ${presetLabel(current.preset)}, ${current.controls.heightInHeads.value} head units tall` : `Applied · ${presetLabel(current.preset)}, ${current.controls.heightInHeads.value} head units tall`
  const summary = (
    <section className="prop-panel prop-start panel" aria-label="Target proportions">
      <div className="prop-start-icon" aria-hidden="true"><ProportionsIcon size={72} /></div>
      <div className="prop-start-body">
        <h4>Shape &amp; proportions</h4>
        <p className="helper">Define body and facial proportions for {asset.name}: tall or compact, long limbs, large eyes, angular or rounded. Nothing changes for this character until you apply them, and style changes never reset them.</p>
        <p className={`prop-start-state${dirty ? ' draft' : ''}`}><span>Profile</span> {state}</p>
        {dirty && <p className="prop-start-warn" role="status">These changes are not applied yet, so new pictures will not use them. <button type="button" className="linklike" onClick={() => { applyNow() }}>Apply now</button></p>}
        <button type="button" className="primary" onClick={() => { if (!current) keep(newHistory(startFrom ? startFrom() : createProfile(asset.id))); setOpen(true) }}><ProportionsIcon size={18} /> {current ? 'Edit proportions' : 'Set proportions'}{!current && world?.profile ? ` (from the world default: ${presetLabel(world.profile.preset)})` : ''} <ChevronRight size={16} aria-hidden="true" /></button>
      </div>
    </section>
  )
  if (!current) return summary

  const words = describeProfile(current)
  const inTab = controlSpecs.filter((c) => tabOf(c) === tab)
  const choosePreset = (value: string) => {
    if (value.startsWith('mine:')) { const found = mine.find((m) => m.name === value.slice(5)); if (found) edit(applyCustomPreset(current, found)); return }
    edit(setPreset(current, value as PresetId))
  }

  const workspace = (
    <section className="prop-panel prop-ws" aria-label="Shape and proportions workspace">
      <header className="prop-ws-head">
        <div className="prop-ws-title">
          <button type="button" className="secondary prop-back" onClick={goBack} aria-label={`Back to ${asset.name}`}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
          <ProportionsIcon size={26} />
          <div><h4>Shape &amp; proportions <span className="prop-ws-name">{asset.name}</span></h4>
            <small className={dirty ? 'prop-state draft' : 'prop-state applied'} data-testid="prop-state">{dirty ? 'Draft · not applied yet' : 'Applied'}</small></div>
        </div>
        <div className="prop-tools">
          <button type="button" className="secondary" onClick={() => step('undo')} disabled={!history?.past.length} aria-label="Undo"><Undo2 size={14} /></button>
          <button type="button" className="secondary" onClick={() => step('redo')} disabled={!history?.future.length} aria-label="Redo"><Redo2 size={14} /></button>
          <button type="button" className="secondary" onClick={() => { onGenerate(asset, [asset.description ?? asset.name, words, 'Full-body neutral standing pose, front view, plain background.'].filter(Boolean).join(' ')); notify(`Asked for one candidate of ${asset.name}.`) }} title="Asks an image model for one picture of what you see here. It uses one image request."><Sparkles size={14} /> Generate design preview{cost ? ` · ${cost}` : ''}</button>
        </div>
      </header>

      {leaving && (
        <div className="prop-leave" role="alertdialog" aria-label="Unapplied changes">
          <p><b>You changed {asset.name}'s proportions but have not applied them.</b> Pictures are made from the applied proportions only.</p>
          <div className="prop-leave-actions">
            <button type="button" className="primary" onClick={() => { if (applyNow()) { setLeaving(false); setOpen(false) } }}>Apply and go back</button>
            <button type="button" className="secondary" onClick={() => { discard(); setLeaving(false); setOpen(false) }}>Discard changes</button>
            <button type="button" className="tertiary" onClick={() => setLeaving(false)}>Keep editing</button>
          </div>
        </div>
      )}
      <div className="prop-ws-grid">
        <div className="prop-card prop-controls" aria-label="Target proportions controls">
          <h5>Design controls</h5>
          <label className="prop-line"><span>Preset</span>
            <select value={current.preset} onChange={(e) => choosePreset(e.target.value)} aria-label="Starting profile">
              {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {mine.length > 0 && <optgroup label="Your presets">{mine.map((m) => <option key={m.name} value={`mine:${m.name}`}>{m.name}</option>)}</optgroup>}
            </select>
          </label>
          <small className="helper">{presets.find((p) => p.id === current.preset)?.note} These are starting points, not rules.</small>
          <div className="prop-tabs" role="tablist" aria-label="Control groups">
            {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </div>
          <div className="prop-row prop-stylization"><label htmlFor="prop-stylization">Stylization</label><output className="prop-pct">{current.stylization}%</output><span /><span /><input id="prop-stylization" type="range" min={0} max={100} step={1} value={current.stylization} onChange={(e) => edit(setStylization(current, Number(e.target.value)))} aria-label="Stylization" /></div>
          <div className="prop-list">
            {inTab.map((spec) => <ControlRow key={spec.id} spec={spec} profile={current} excused={excused.has(spec.id)} onSet={(v) => setValue(spec.id, v)} onReset={() => edit(resetControl(current, spec.id))} />)}
            {tab === 'advanced' && (
              <>
                <div className="prop-row prop-metres"><label htmlFor="prop-heightM" title="How tall the character is in the story. It turns head units into metres for fit rules and the Scale and Fit sheet.">Story height</label>
                  <NumberField id="prop-heightM" value={current.heightM} min={HEIGHT_RANGE_M[0]} max={HEIGHT_RANGE_M[1]} step={0.01} label="Story height in metres" onCommit={(v) => edit(setHeightM(current, v))} /><span className="prop-unit">metres</span><span />
                  <small className="helper">An assumption you set, not something measured.</small></div>
                {current.exceptions.length > 0 && <p className="helper">Intentional: {current.exceptions.map((e) => <span key={e.control} className="prop-chip">{controlSpecs.find((c) => c.id === e.control)?.label} <button type="button" className="linklike" aria-label={`Stop treating ${e.control} as intentional`} onClick={() => edit(removeException(current, e.control))}>×</button></span>)}</p>}
              </>
            )}
          </div>
          <div className="prop-foot">
            <label className="prop-switch"><input type="checkbox" role="switch" checked={linked} onChange={(e) => setLinked_(e.target.checked)} aria-label="Linked proportions" /><span>Linked proportions</span></label>
            <small className="helper">{linked ? 'Changing legs, torso or neck moves the total height with them, and the other way round.' : 'Each control moves on its own; the warnings tell you if the parts stop adding up.'}</small>
            <button type="button" className="linklike" onClick={() => edit(resetProfile(current))} disabled={!overrideCount(current) && !current.exceptions.length}><RotateCcw size={13} /> Reset controls</button>
          </div>
        </div>

        <div className="prop-card prop-canvas">
          <div className="prop-canvas-bar">
            <div className="prop-tabs" role="tablist" aria-label="Figure view">
              <button type="button" role="tab" aria-selected={view === 'front'} className={view === 'front' ? 'on' : ''} onClick={() => setView('front')}>Front</button>
              <button type="button" role="tab" aria-selected={view === 'compare'} className={view === 'compare' ? 'on' : ''} onClick={() => setView('compare')} title="Draws the Natural proportions behind the figure, standing on the same floor">Compare</button>
            </div>
            <span className="prop-live"><i aria-hidden="true" /> Schematic · updates instantly</span>
          </div>
          <Mannequin profile={current} annotate compare={view === 'compare'} />
          {view === 'compare' && <small className="helper prop-legend"><i className="ghost" aria-hidden="true" /> Natural proportions, for comparison</small>}
          {rs && <small className="helper">A diagram made only from the numbers, not a picture of {asset.name}. Stacked height {rs.stackedHeight} head units · legs to torso {rs.legToTorso} · shoulders to hips {rs.shoulderToHip}</small>}
          <div className="prop-candidates-wrap">
            <h5>Design preview <small>an AI candidate, not approved</small></h5>
            <div className="prop-candidates">
              {candidates.length === 0 && <small className="helper">No candidate yet. Moving a control never contacts an image model; the button above asks for one.</small>}
              {candidates.map((c) => c.path ? <img key={c.id} src={convertFileSrc(c.path)} alt={`Candidate for ${asset.name}`} /> : <small key={c.id}>{c.status}…</small>)}
            </div>
          </div>
        </div>

        <aside className="prop-side">
          <div className="prop-card prop-check">
            <h5>Proportion check</h5>
            {conflicts.length === 0
              ? <p className="prop-status ok"><CheckCircle2 size={16} aria-hidden="true" /> Structure balanced</p>
              : <ul className="prop-warnings" aria-label="Proportion conflicts">{conflicts.map((w) => <li key={w.id} className="conflict"><AlertTriangle size={14} aria-hidden="true" /> {w.message}</li>)}</ul>}
            {considerations.length > 0 && (
              <>
                <small className="helper">{considerations.length} {considerations.length === 1 ? 'consideration' : 'considerations'} for posing</small>
                <ul className="prop-warnings" aria-label="Proportion warnings">
                  {considerations.map((w) => (
                    <li key={w.id}><AlertTriangle size={14} aria-hidden="true" /> <span>{w.message} {w.controls.length === 1 && <button type="button" className="linklike" onClick={() => edit(addException(current, w.controls[0], 'Intentional'))}>This is intentional</button>}</span></li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="prop-card prop-ref">
            <h5>Reference</h5>
            <div className="prop-ref-body">
              <div className="prop-ref-img"><RealImage path={referencePath} label={`Approved picture of ${asset.name}`} empty="No approved picture yet" /></div>
              <p className="helper">{approvedViews > 0 ? `${approvedViews} approved view${approvedViews === 1 ? '' : 's'} for ${asset.name}.` : `Nothing approved yet for ${asset.name}.`} Changing the target does not change approved work; make new views from the Sheets tab and approve them there.</p>
            </div>
          </div>
          <fieldset className="prop-card prop-scope">
            <legend>Apply to</legend>
            <label><input type="radio" name={`scope-${asset.id}`} checked={scope === 'character'} onChange={() => setScope('character')} /> {asset.name} only</label>
            {others.length > 0 && onApplyTo && <label><input type="radio" name={`scope-${asset.id}`} checked={scope === 'others'} onChange={() => setScope('others')} /> {asset.name} and other characters</label>}
            {scope === 'others' && (
              <div className="prop-share" role="group" aria-label="Give these proportions to">
                {others.map((o) => <label key={o.id}><input type="checkbox" checked={shareWith.has(o.id)} onChange={(e) => setShareWith((cur) => { const next = new Set(cur); if (e.target.checked) next.add(o.id); else next.delete(o.id); return next })} /> {o.name}</label>)}
                <button type="button" className="linklike" onClick={() => setShareWith(shareWith.size === others.length ? new Set() : new Set(others.map((o) => o.id)))}>{shareWith.size === others.length ? 'Clear all' : 'Select all'}</button>
              </div>
            )}
            <label><input type="radio" name={`scope-${asset.id}`} checked={scope === 'world'} onChange={() => setScope('world')} disabled={!onSetWorld} /> Project world profile</label>
            <small className="helper">{scope === 'world' ? 'Also makes this the starting point for new characters. Characters that already have proportions are not changed.' : scope === 'others' ? 'Each ticked character gets a copy of these proportions as its own target. They keep their own faces, costumes and pictures.' : 'Only this character uses these proportions.'}</small>
          </fieldset>
        </aside>
      </div>

      <footer className="prop-ws-foot">
        <span className="prop-target"><Crosshair size={16} aria-hidden="true" /> Target profile · not generated artwork</span>
        <div className="prop-actions">
          {saving === null
            ? <button type="button" className="secondary" onClick={() => setSaving('')}>Save preset</button>
            : (
              <form className="prop-save" onSubmit={(e) => { e.preventDefault(); const n = saving.trim(); if (!n) return; setMine(savePreset(toCustomPreset(current, n))); notify(`Saved the preset "${n}". It is on this computer and shows under Your presets.`); setSaving(null) }}>
                <input autoFocus aria-label="Preset name" placeholder="Preset name" maxLength={40} value={saving} onChange={(e) => setSaving(e.target.value)} />
                <button type="submit" className="secondary" disabled={!saving.trim()}>Save</button>
                <button type="button" className="linklike" onClick={() => setSaving(null)}>Cancel</button>
              </form>
            )}
          {mine.length > 0 && saving === null && <button type="button" className="linklike" onClick={() => { const last = mine[mine.length - 1]; setMine(deletePreset(last.name)); notify(`Removed the preset "${last.name}".`) }} title="Removes the most recently saved preset"><Trash2 size={13} /> Remove last preset</button>}
          <button type="button" className="linklike" onClick={() => { onChange(undefined); drafts.delete(asset.id); setHistory(null); notify(`Target proportions cleared for ${asset.name}.`) }}>Clear proportions</button>
          {dirty && <button type="button" className="secondary" onClick={discard}>Discard changes</button>}
          <button type="button" className="secondary" onClick={() => { if (applyNow()) { setOpen(false); onOpenSheets?.() } }} disabled={!dirty && scope === 'character'} title="Applies the proportions and opens the sheets, where you press Generate to make pictures with them">Apply and make pictures</button>
          <button type="button" className="primary" onClick={() => { applyNow() }} disabled={(!dirty && scope === 'character') || (scope === 'others' && shareWith.size === 0)}>Apply proportions</button>
        </div>
      </footer>
    </section>
  )
  return (
    <>
      {summary}
      {open && createPortal(<div className="prop-overlay" role="dialog" aria-modal="true" aria-label={`Shape and proportions for ${asset.name}`}><div className="prop-overlay-inner">{workspace}</div></div>, document.body)}
    </>
  )
}
