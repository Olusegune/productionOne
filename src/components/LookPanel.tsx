import { useEffect, useMemo, useRef, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { RotateCcw } from 'lucide-react'
import {
  addLook, addLut, colourScript, dropUnusedLuts, effectiveLook, gradeBytes, isNeutral, lutLookup, neutralGrade, normalizeGrade, removeLook, updateLook, type Grade, type Look, type LookState, type LutLookup,
} from '../domain/grade'
import { parseCube } from '../domain/lut'

export interface FramePick { id: string; label: string; path: string }
interface Props {
  state: LookState
  setState: (next: LookState) => void
  scenes: Array<{ id: string; heading: string }>
  shots: Array<{ id: string; sceneId: string; title?: string }>
  /** Pictures that can be previewed under a look. The originals are only read, never written. */
  frames: FramePick[]
  notify: (message: string) => void
}

type SliderDef = { path: ['technical' | 'tone' | 'creative', string]; label: string; min: number; max: number; step: number }
const sliders: SliderDef[] = [
  { path: ['technical', 'exposureEv'], label: 'Exposure (stops)', min: -3, max: 3, step: 0.1 },
  { path: ['technical', 'temperature'], label: 'Temperature (cool to warm)', min: -100, max: 100, step: 1 },
  { path: ['technical', 'tint'], label: 'Tint (green to magenta)', min: -100, max: 100, step: 1 },
  { path: ['tone', 'contrast'], label: 'Contrast', min: -100, max: 100, step: 1 },
  { path: ['tone', 'saturation'], label: 'Saturation', min: -100, max: 100, step: 1 },
  { path: ['creative', 'tintAmount'], label: 'Creative tint amount', min: 0, max: 100, step: 1 },
]
const valueAt = (g: Grade, [section, key]: SliderDef['path']) => (g[section] as unknown as Record<string, number>)[key]
const withValue = (g: Grade, [section, key]: SliderDef['path'], v: number): Grade => normalizeGrade({ ...g, [section]: { ...(g[section] as object), [key]: v } })

function useGradedPreview(path: string | undefined, grade: Grade | undefined, strength: number, luts?: LutLookup) {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<'idle' | 'ready' | 'unavailable'>('idle')
  const source = useRef<ImageData | null>(null)
  useEffect(() => {
    source.current = null
    if (!path) { setState('idle'); return }
    const c = canvas.current
    const ctx = c?.getContext?.('2d')
    if (!c || !ctx) { setState('unavailable'); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const scale = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight))
        c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale))
        ctx.drawImage(img, 0, 0, c.width, c.height)
        source.current = ctx.getImageData(0, 0, c.width, c.height)
        setState('ready')
      } catch { setState('unavailable') }
    }
    img.onerror = () => setState('unavailable')
    img.src = convertFileSrc(path)
  }, [path])
  useEffect(() => {
    const c = canvas.current; const ctx = c?.getContext?.('2d'); const src = source.current
    if (state !== 'ready' || !c || !ctx || !src) return
    // Always from the original pixels held in `source`, never from what is on screen: re-grading cannot compound.
    const out = ctx.createImageData(src.width, src.height)
    out.data.set(gradeBytes(src.data, grade ?? neutralGrade(), strength, luts))
    ctx.putImageData(out, 0, 0)
  }, [state, grade, strength, luts])
  return { canvas, state }
}

/** Looks: named, editable grades applied over the original pictures. The pictures themselves are never changed; a look is metadata. */
export function LookPanel({ state, setState, scenes, shots, frames, notify }: Props) {
  const [selectedId, setSelectedId] = useState<string | undefined>(state.looks[0]?.id)
  const [strength, setStrength] = useState(100)
  const [framePath, setFramePath] = useState<string | undefined>(frames[0]?.path)
  const [showOriginal, setShowOriginal] = useState(false)
  const look: Look | undefined = state.looks.find((l) => l.id === selectedId) ?? state.looks[0]
  const lookup = useMemo(() => lutLookup(state), [state.luts])
  const preview = useGradedPreview(framePath ?? frames[0]?.path, look?.grade, strength, lookup)
  const [lutMessage, setLutMessage] = useState('')
  const lutId = look?.grade.lut?.id
  const lutInfo = lutId ? state.luts?.[lutId] : undefined
  const script = useMemo(() => colourScript(state, scenes, shots), [state, scenes, shots])
  const set = (grade: Grade) => look && setState(dropUnusedLuts(updateLook(state, look.id, { grade })))
  const importLut = async (file: File | undefined) => {
    if (!file || !look) return
    if (!/\.cube$/i.test(file.name)) { setLutMessage('Choose a .cube file. Other LUT formats (.3dl, .lut, .csp) are not supported.'); return }
    if (file.size > 12 * 1024 * 1024) { setLutMessage('That file is larger than 12 MB, which is more than a LUT should be.'); return }
    const parsed = parseCube(await file.text(), file.name)
    if (!parsed.ok) { setLutMessage(`Could not use ${file.name}: ${parsed.error}`); return }
    const added = addLut(state, parsed.lut)
    if (!added.ok) { setLutMessage(added.error); return }
    setState(updateLook(added.state, look.id, { grade: { ...look.grade, lut: { id: added.id, strength: 100 } } }))
    setLutMessage(`Added ${parsed.lut.title} (${parsed.lut.kind === '3d' ? '3D' : '1D'}, size ${parsed.lut.size}) to ${look.name}.${parsed.lut.warnings.length ? ' Read the notes below.' : ''}`)
  }

  return (
    <section className="panel look-panel" aria-label="Looks">
      <h3>Looks and grade</h3>
      <p className="helper">A look is a grade applied over your original pictures. The originals are never changed and a grade is never baked into them; changing a look again always starts from the original. A grade changes colour only: it does not move lights or rebuild shadows.</p>
      <div className="vr-actions">
        <button type="button" className="primary" onClick={() => { const r = addLook(state, 'New look'); setState(r.state); setSelectedId(r.look.id) }}>Add a look</button>
        {look && <button type="button" className="secondary" onClick={() => { setState(removeLook(state, look.id)); setSelectedId(undefined); notify(`Removed ${look.name}. No picture was changed.`) }}>Remove this look</button>}
      </div>
      {state.looks.length > 0 && (
        <label><span>Look</span><select aria-label="Look" value={look?.id ?? ''} onChange={(e) => setSelectedId(e.target.value)}>{state.looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      )}
      {look && (
        <>
          <label><span>Name</span><input aria-label="Look name" value={look.name} onChange={(e) => setState(updateLook(state, look.id, { name: e.target.value }))} /></label>
          {sliders.map((def) => (
            <div key={def.path.join('.')} className="prop-row">
              <label htmlFor={`g-${def.path.join('-')}`}>{def.label}</label>
              <input id={`g-${def.path.join('-')}`} aria-label={def.label} type="range" min={def.min} max={def.max} step={def.step} value={valueAt(look.grade, def.path)} onChange={(e) => set(withValue(look.grade, def.path, Number(e.target.value)))} />
              <output>{valueAt(look.grade, def.path)}</output><span />
            </div>
          ))}
          <div className="dr-two">
            <label><span>Shadow tint</span><input aria-label="Shadow tint" type="color" value={look.grade.creative.shadowTint || '#000000'} onChange={(e) => set(normalizeGrade({ ...look.grade, creative: { ...look.grade.creative, shadowTint: e.target.value } }))} /></label>
            <label><span>Highlight tint</span><input aria-label="Highlight tint" type="color" value={look.grade.creative.highlightTint || '#ffffff'} onChange={(e) => set(normalizeGrade({ ...look.grade, creative: { ...look.grade.creative, highlightTint: e.target.value } }))} /></label>
          </div>
          <h5>LUT (optional)</h5>
          <p className="helper">A LUT is a table of colour changes in a .cube file (from a colourist or a film-look pack). It is applied after the grade above and changes colour only: it does not move lights or rebuild shadows. This app expects an ordinary picture in and an ordinary picture out (sRGB); a LUT made for a log or HDR camera format gives wrong colours here.</p>
          <label><span>Import a LUT (.cube)</span><input aria-label="Import a LUT (.cube)" type="file" accept=".cube" onChange={(e) => { void importLut(e.target.files?.[0]); e.target.value = '' }} /></label>
          {lutMessage && <small className="helper" role="status">{lutMessage}</small>}
          {lutInfo && look.grade.lut && (
            <div role="group" aria-label="LUT in this look">
              <small className="helper"><b>{lutInfo.title}</b> ({lutInfo.kind === '3d' ? '3D' : '1D'}, size {lutInfo.size})</small>
              <div className="prop-row">
                <label htmlFor="lut-strength">LUT strength</label>
                <input id="lut-strength" aria-label="LUT strength" type="range" min={0} max={100} step={1} value={look.grade.lut.strength} onChange={(e) => set({ ...look.grade, lut: { ...look.grade.lut!, strength: Number(e.target.value) } })} />
                <output>{look.grade.lut.strength}</output><span />
              </div>
              {lutInfo.warnings.length > 0 && <ul className="prop-warnings" aria-label="LUT notes">{lutInfo.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              {lutInfo.suspectedLog && (
                <label className="dr-check"><input type="checkbox" aria-label="This LUT is meant for ordinary pictures" checked={!!look.grade.lut.acknowledgeLog} onChange={(e) => set({ ...look.grade, lut: { ...look.grade.lut!, acknowledgeLog: e.target.checked } })} /> I know this LUT is meant for ordinary pictures like these (it is not applied until you tick this)</label>
              )}
              <button type="button" className="secondary" onClick={() => { const { lut: _drop, ...rest } = look.grade; set(rest as Grade); setLutMessage('') }}>Remove the LUT from this look</button>
            </div>
          )}
          <div className="vr-actions">
            <button type="button" className="secondary" onClick={() => set(neutralGrade())} disabled={isNeutral(look.grade)}><RotateCcw size={12} /> Reset this look</button>
          </div>

          <h5>Preview</h5>
          {frames.length === 0 ? <small className="helper">Make a storyboard frame to preview a look on it.</small> : (
            <>
              <label><span>Picture</span><select aria-label="Preview picture" value={framePath ?? frames[0].path} onChange={(e) => setFramePath(e.target.value)}>{frames.map((f) => <option key={f.id} value={f.path}>{f.label}</option>)}</select></label>
              <label><span>Strength ({strength}%)</span><input aria-label="Grade strength" type="range" min={0} max={100} step={1} value={strength} onChange={(e) => setStrength(Number(e.target.value))} /></label>
              <label className="dr-check"><input type="checkbox" aria-label="Show the original" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} /> Show the original</label>
              <div className="fit-compare">
                <figure><img src={convertFileSrc(framePath ?? frames[0].path)} alt="Original" style={{ display: showOriginal ? 'block' : 'none' }} /><figcaption style={{ display: showOriginal ? 'block' : 'none' }}>Original (unchanged)</figcaption></figure>
                <figure style={{ display: showOriginal ? 'none' : 'block' }}><canvas ref={preview.canvas} aria-label="Graded preview" style={{ maxWidth: '100%', maxHeight: 260 }} /><figcaption>{preview.state === 'unavailable' ? 'Preview unavailable here. The original is unchanged.' : `Graded with ${look.name} (a preview, not saved over the original)`}</figcaption></figure>
              </div>
            </>
          )}
        </>
      )}

      <h5>Where looks apply</h5>
      <label><span>Whole project</span><select aria-label="Project look" value={state.projectLook ?? ''} onChange={(e) => setState({ ...state, projectLook: e.target.value || undefined })}><option value="">No look (original colours)</option>{state.looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      {scenes.length > 0 && (
        <table className="fit-table" aria-label="Colour script">
          <thead><tr><th>Scene</th><th>Look for the scene</th><th>Colours</th><th>Shots</th></tr></thead>
          <tbody>{script.map((row, i) => (
            <tr key={row.sceneId}>
              <td>{row.heading}</td>
              <td><select aria-label={`Look for ${row.heading}`} value={state.sceneLooks[row.sceneId] ?? ''} onChange={(e) => { const next = { ...state.sceneLooks }; if (e.target.value) next[row.sceneId] = e.target.value; else delete next[row.sceneId]; setState({ ...state, sceneLooks: next }) }}><option value="">{state.projectLook ? 'Project look' : 'No look'}</option>{state.looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select> <small>{row.look} ({row.source})</small></td>
              <td><span className="swatches" aria-label={`Colours of ${row.look}`}>{row.swatches.map((c, n) => <i key={n} style={{ display: 'inline-block', width: 14, height: 14, background: c, marginRight: 2, borderRadius: 2 }} title={c} />)}</span></td>
              <td>{row.shots}{row.overrides ? ` (${row.overrides} with their own look)` : ''}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {shots.length > 0 && (
        <details>
          <summary>Look for a single shot (optional)</summary>
          {scenes.map((s) => shots.filter((x) => x.sceneId === s.id).map((x) => {
            const eff = effectiveLook(state, s.id, x.id)
            return <label key={x.id}><span>{x.title ?? x.id}</span><select aria-label={`Look for shot ${x.title ?? x.id}`} value={state.shotLooks[x.id] ?? ''} onChange={(e) => { const next = { ...state.shotLooks }; if (e.target.value) next[x.id] = e.target.value; else delete next[x.id]; setState({ ...state, shotLooks: next }) }}><option value="">Same as the scene{eff.look && eff.source !== 'shot' ? ` (${eff.look.name})` : ''}</option>{state.looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          }))}
        </details>
      )}
    </section>
  )
}
