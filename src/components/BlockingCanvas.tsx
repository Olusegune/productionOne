import { useRef, useState } from 'react'
import type { ExtractedAsset, ShotRecord } from '../domain/productionStudio'
import { fieldOfView, sensorFor } from '../domain/camera'
import {
  addThing, assignOwner, moveBetweenShots, placeThing, screenPlacement, seat, setShotCamera, worldAtShot, worldIssues, type SceneState, type ThingKind,
} from '../domain/sceneState'

const W = 12, H = 9, PX = 40
const kindFor = (a: ExtractedAsset): ThingKind => (a.type === 'character' ? 'character' : a.type === 'prop' ? 'prop' : a.type === 'costume' ? 'prop' : 'landmark')

interface Props {
  scene: SceneState
  setScene: (next: SceneState) => void
  /** The assets that belong in this shot or scene, to put on the map. */
  assets: ExtractedAsset[]
  shot: ShotRecord
  /** Shot ids of this scene in order, for "from this shot on". */
  shotOrder: string[]
  notify: (message: string) => void
}

/**
 * A simple top-down blocking map for one scene. Positions are world space, in metres. The camera for each shot is separate: moving it never moves the people
 * or the furniture. Movement between shots is recorded as an explicit change with a reason. There is no 3D editor.
 */
export function BlockingCanvas({ scene, setScene, assets, shot, shotOrder, notify }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const svg = useRef<SVGSVGElement | null>(null)
  const world = worldAtShot(scene, shot.id, shotOrder)
  const camera = scene.cameras[shot.id]
  const sel = world.things.find((t) => t.id === selected)
  const issues = worldIssues(world)
  const onMap = new Set(scene.world.things.map((t) => t.id))
  const toWorld = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / (r.width || W * PX)) * W
    const y = ((e.clientY - r.top) / (r.height || H * PX)) * H
    return { x: Math.min(W, Math.max(0, x)), y: Math.min(H, Math.max(0, y)) }
  }
  const nudge = (id: string, dx: number, dy: number) => { const t = scene.world.things.find((x) => x.id === id); if (t) setScene(placeThing(scene, id, { x: Math.min(W, Math.max(0, t.x + dx)), y: Math.min(H, Math.max(0, t.y + dy)) })) }
  const cam = camera ?? { x: W / 2, y: H - 0.5, facing: 0, fov: fieldOfView(shot.lens ?? 40, sensorFor(shot.camera?.sensor)).horizontal }
  const hasCamera = !!camera
  const dragThing = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault(); setSelected(id)
    const move = (ev: PointerEvent) => { const p = toWorld(ev); setScene(placeThing(scene, id, p)) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const dragCamera = (e: React.PointerEvent) => {
    e.preventDefault()
    const move = (ev: PointerEvent) => { const p = toWorld(ev); setScene(setShotCamera(scene, shot.id, { ...cam, ...p })) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const shotIndex = shotOrder.indexOf(shot.id)

  return (
    <div className="blk">
      <p className="helper">Top-down map in metres. Where things are belongs to the scene; the camera belongs to this shot. Moving the camera never moves anyone.</p>
      <svg ref={svg} className="blk-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Top-down blocking map" style={{ width: '100%', maxHeight: 360 }}>
        <rect x={0} y={0} width={W} height={H} className="blk-floor" />
        {Array.from({ length: W - 1 }, (_, i) => <line key={`v${i}`} x1={i + 1} y1={0} x2={i + 1} y2={H} className="blk-grid" />)}
        {Array.from({ length: H - 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i + 1} x2={W} y2={i + 1} className="blk-grid" />)}
        {world.things.map((t) => (
          <g key={t.id} tabIndex={0} role="button" aria-label={`${t.name}, ${t.kind}, at ${t.x}, ${t.y}`} aria-pressed={selected === t.id} className={`blk-thing ${t.kind}${selected === t.id ? ' on' : ''}`} transform={`translate(${t.x} ${t.y})`}
            onPointerDown={dragThing(t.id)} onFocus={() => setSelected(t.id)} onClick={() => setSelected(t.id)}
            onKeyDown={(e) => { const s = e.shiftKey ? 1 : 0.25; if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(t.id, -s, 0) } if (e.key === 'ArrowRight') { e.preventDefault(); nudge(t.id, s, 0) } if (e.key === 'ArrowUp') { e.preventDefault(); nudge(t.id, 0, -s) } if (e.key === 'ArrowDown') { e.preventDefault(); nudge(t.id, 0, s) } }}>
            {t.kind === 'furniture' ? <rect x={-0.4} y={-0.4} width={0.8} height={0.8} /> : <circle r={t.kind === 'character' ? 0.35 : 0.22} />}
            <line x1={0} y1={0} x2={Math.sin((t.facing * Math.PI) / 180) * 0.6} y2={-Math.cos((t.facing * Math.PI) / 180) * 0.6} className="blk-facing" />
            <text y={-0.55} textAnchor="middle" fontSize={0.4}>{t.name}</text>
          </g>
        ))}
        <g className="blk-camera" transform={`translate(${cam.x} ${cam.y}) rotate(${cam.facing})`} onPointerDown={dragCamera} opacity={hasCamera ? 1 : 0.45} aria-label="Camera for this shot">
          <polygon points="0,0 -0.35,0.5 0.35,0.5" />
          <path d={`M0 0 L${-Math.tan((cam.fov / 2) * Math.PI / 180) * 4} -4 L${Math.tan((cam.fov / 2) * Math.PI / 180) * 4} -4 Z`} className="blk-fov" />
        </g>
      </svg>

      <div className="dr-two">
        <label><span>Camera direction ({cam.facing}°)</span><input aria-label="Camera direction" type="range" min={-180} max={180} step={5} value={cam.facing} onChange={(e) => setScene(setShotCamera(scene, shot.id, { ...cam, facing: Number(e.target.value) }))} /></label>
        <button type="button" className="secondary" onClick={() => setScene(setShotCamera(scene, shot.id, { ...cam, fov: fieldOfView(shot.lens ?? 40, sensorFor(shot.camera?.sensor)).horizontal }))}>{hasCamera ? 'Match camera to the lens' : 'Place the camera for this shot'}</button>
      </div>

      <div className="blk-add" role="group" aria-label="Add to the map">
        <b>Add to the map</b>
        {assets.filter((a) => !onMap.has(a.id)).map((a) => <button key={a.id} type="button" className="secondary" onClick={() => { setScene(addThing(scene, { id: a.id, kind: kindFor(a), name: a.name, x: W / 2, y: H / 2, facing: 0 })); setSelected(a.id) }}>{a.name}</button>)}
        <button type="button" className="secondary" onClick={() => { const n = scene.world.things.filter((t) => t.kind === 'furniture').length + 1; const id = `FURN-${String(n).padStart(3, '0')}`; setScene(addThing(scene, { id, kind: 'furniture', name: `Chair ${n}`, x: W / 2, y: H / 2, facing: 0, interactions: ['sit'] })); setSelected(id) }}>Add a chair</button>
      </div>

      {sel && (
        <div className="blk-sel" role="group" aria-label={`Settings for ${sel.name}`}>
          <b>{sel.name}</b> <small>({sel.kind}, {sel.x} m, {sel.y} m){sel.occupies ? `, sitting on ${world.things.find((t) => t.id === sel.occupies)?.name ?? sel.occupies}` : ''}{sel.ownedBy ? `, belongs to ${world.things.find((t) => t.id === sel.ownedBy)?.name ?? sel.ownedBy}` : ''}</small>
          <label><span>Facing ({sel.facing}°)</span><input aria-label="Facing" type="range" min={0} max={359} step={15} value={sel.facing} onChange={(e) => setScene(placeThing(scene, sel.id, { facing: Number(e.target.value) }))} /></label>
          {sel.kind === 'character' && (
            <label><span>Sits on</span>
              <select aria-label="Sits on" value={scene.world.things.find((t) => t.id === sel.id)?.occupies ?? ''} onChange={(e) => { if (!e.target.value) return; const r = seat(scene, sel.id, e.target.value); if (r.ok) setScene(r.state); else notify(r.error) }}>
                <option value="">Not seated</option>
                {scene.world.things.filter((t) => t.kind === 'furniture').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          {sel.kind === 'furniture' && (
            <label><span>Belongs to</span>
              <select aria-label="Belongs to" value={scene.world.things.find((t) => t.id === sel.id)?.ownedBy ?? ''} onChange={(e) => setScene(assignOwner(scene, sel.id, e.target.value || undefined))}>
                <option value="">Nobody in particular</option>
                {scene.world.things.filter((t) => t.kind === 'character').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          <div className="blk-change">
            <label><span>Why does it change here? (a deliberate move from this shot on)</span><input aria-label="Reason for the change" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Marcus gets up and crosses to the window" /></label>
            <button type="button" className="secondary" disabled={shotIndex < 0} onClick={() => { const r = moveBetweenShots(scene, { shotId: shot.id, thingId: sel.id, patch: { x: sel.x, y: sel.y, facing: sel.facing }, reason }); if (r.ok) { setScene(r.state); setReason(''); notify(`Recorded: ${sel.name} is different from ${shot.id} on.`) } else notify(r.error) }}>Record this position from this shot on</button>
          </div>
        </div>
      )}

      {issues.length > 0 && <ul className="blk-issues" aria-label="Layout problems">{issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul>}

      <div className="blk-screen" aria-label="What this camera sees">
        <b>What this camera sees</b>
        <ul>{world.things.map((t) => { const p = screenPlacement(world, cam, t.id); return p ? <li key={t.id}>{t.name}: {p.lateral}, {p.zone}{p.lateral === 'out-of-frame' || p.lateral === 'behind-camera' ? '' : `, ${p.depthM} m away`}, facing {p.facing.replace(/-/g, ' ')}</li> : null })}</ul>
      </div>
    </div>
  )
}
