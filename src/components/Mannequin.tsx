import { useMemo } from 'react'
import { createProfile, schematic, type ProportionProfile, type Schematic, type SchematicShape } from '../domain/proportions'

interface Props {
  profile: ProportionProfile
  /** Draws the figure with measurement brackets and a head-unit ruler. */
  annotate?: boolean
  /** Draws a faint outline of the Natural proportions behind the figure, standing on the same floor, so the difference shows. */
  compare?: boolean
}

const WIDTH = 340
const CX_SHIFT = 20

const find = (art: Schematic, id: string): SchematicShape | undefined => art.shapes.find((s) => s.id === id)

/** A limb that narrows from one end to the other: a flat-sided shape with a round cap at each end. */
function Limb({ id, x1, y1, x2, y2, w1, w2 }: { id?: string; x1: number; y1: number; x2: number; y2: number; w1: number; w2: number }) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  const pt = (x: number, y: number, w: number, side: number) => `${(x + nx * (w / 2) * side).toFixed(2)},${(y + ny * (w / 2) * side).toFixed(2)}`
  return (
    <g data-shape={id}>
      <polygon className="mq-skin" points={`${pt(x1, y1, w1, 1)} ${pt(x2, y2, w2, 1)} ${pt(x2, y2, w2, -1)} ${pt(x1, y1, w1, -1)}`} />
      <circle className="mq-skin" cx={x1} cy={y1} r={w1 / 2} />
      <circle className="mq-skin" cx={x2} cy={y2} r={w2 / 2} />
    </g>
  )
}

/**
 * The figure, built from the schematic's measurements: a shaded torso that narrows to the waist, limbs that taper, an egg-shaped head whose chin follows the jaw control,
 * mitten hands sized by the hand control, and shoes sized by the foot control. Rounded-to-angular softens or sharpens every corner.
 */
function Figure({ art, ghost }: { art: Schematic; ghost?: boolean }) {
  const g = (id: string): SchematicShape => find(art, id) as SchematicShape
  const head = g('head'), torso = g('torso'), hips = g('hips'), neck = g('neck')
  const cx = head.x + (head.w ?? 0) / 2
  const hw = (head.w ?? 0) / 2, hh = head.h ?? 0
  const jaw = g('jaw'), jawW = Math.abs((jaw.x2 ?? jaw.x) - jaw.x)
  const tw = torso.w ?? 0, th = torso.h ?? 0
  const hipBottom = hips.y + (hips.h ?? 0), hipW = hips.w ?? 0
  const soft = Math.min(1, Math.max(0, ((torso.corner ?? 14) - 2) / 24))
  const waistW = Math.min(tw, hipW) * 0.8
  const body = [
    [cx - (neck.w ?? 0) / 2, torso.y - 1], [cx - tw / 2 + 5, torso.y + 1], [cx - tw / 2, torso.y + 7],
    [cx - waistW / 2, torso.y + th * 0.55], [cx - hipW / 2, hipBottom], [cx + hipW / 2, hipBottom],
    [cx + waistW / 2, torso.y + th * 0.55], [cx + tw / 2, torso.y + 7], [cx + tw / 2 - 5, torso.y + 1], [cx + (neck.w ?? 0) / 2, torso.y - 1],
  ].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const chin = Math.max(2, jawW / 2)
  const headPath = `M ${cx} ${head.y} C ${cx + hw * 0.98} ${head.y} ${cx + hw} ${head.y + hh * 0.46} ${cx + hw * 0.86} ${head.y + hh * 0.72} C ${cx + hw * 0.72} ${head.y + hh * 0.93} ${cx + chin * 1.15} ${head.y + hh} ${cx} ${head.y + hh} C ${cx - chin * 1.15} ${head.y + hh} ${cx - hw * 0.72} ${head.y + hh * 0.93} ${cx - hw * 0.86} ${head.y + hh * 0.72} C ${cx - hw} ${head.y + hh * 0.46} ${cx - hw * 0.98} ${head.y} ${cx} ${head.y} Z`
  const side = (k: 'l' | 'r') => {
    const up = g(`arm-${k}-upper`), fo = g(`arm-${k}-fore`), hd = g(`hand-${k}`)
    const lu = g(`leg-${k}-upper`), ll = g(`leg-${k}-lower`), ft = g(`foot-${k}`)
    const handW = (hd.weight ?? 6) * 1.1
    const handY1 = hd.y, handY2 = hd.y2 ?? hd.y
    const footL = Math.abs((ft.x2 ?? ft.x) - ft.x)
    const dir = k === 'r' ? 1 : -1
    return (
      <g key={k}>
        <Limb id={`arm-${k}-upper`} x1={up.x} y1={up.y} x2={up.x2 ?? up.x} y2={up.y2 ?? up.y} w1={10} w2={8} />
        <Limb id={`arm-${k}-fore`} x1={fo.x} y1={fo.y} x2={fo.x2 ?? fo.x} y2={fo.y2 ?? fo.y} w1={8} w2={6.2} />
        <ellipse className="mq-skin" data-shape={`hand-${k}`} cx={hd.x} cy={(handY1 + handY2) / 2} rx={handW / 2} ry={Math.max(3, (handY2 - handY1) / 2)} />
        <Limb id={`leg-${k}-upper`} x1={lu.x} y1={lu.y} x2={lu.x2 ?? lu.x} y2={lu.y2 ?? lu.y} w1={14} w2={10.5} />
        <Limb id={`leg-${k}-lower`} x1={ll.x} y1={ll.y} x2={ll.x2 ?? ll.x} y2={ll.y2 ?? ll.y} w1={10.5} w2={6.5} />
        <rect className="mq-shoe" data-shape={`foot-${k}`} x={dir === 1 ? ft.x - 3 : ft.x - footL} y={ft.y - 5.5} width={footL + 3} height={5.5} rx={2.75} />
      </g>
    )
  }
  return (
    <g className={ghost ? 'prop-ghost' : undefined}>
      {side('l')}
      {side('r')}
      <rect className="mq-skin" data-shape="neck" x={neck.x} y={neck.y - 1} width={neck.w} height={(neck.h ?? 0) + 3} rx={3} />
      <polygon className="mq-body" data-shape="torso" points={body} style={{ strokeWidth: 1 + soft * 14, strokeLinejoin: soft > 0.2 ? 'round' : 'miter' }} />
      <path className="mq-skin" data-shape="head" d={headPath} />
      {!ghost && (
        <>
          {(['eye-l', 'eye-r'] as const).map((id) => { const e = g(id); return <ellipse key={id} className="mq-eye" data-shape={id} cx={e.x + (e.w ?? 0) / 2} cy={e.y + (e.h ?? 0) / 2} rx={(e.w ?? 0) / 2} ry={(e.h ?? 0) / 2} /> })}
          {(() => { const n = g('nose'); return <line className="mq-mark" data-shape="nose" x1={n.x} y1={n.y} x2={n.x2} y2={n.y2} /> })()}
          {(['elbow-l', 'elbow-r', 'knee-l', 'knee-r'] as const).map((id) => { const j = g(id); return <ellipse key={id} className="mq-joint" data-shape={id} cx={j.x + (j.w ?? 0) / 2} cy={j.y + (j.h ?? 0) / 2} rx={(j.w ?? 0) / 2} ry={(j.h ?? 0) / 2} /> })}
        </>
      )}
    </g>
  )
}

/** A bracket with end ticks. Vertical when x1 === x2, otherwise horizontal. */
function Bracket({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const vertical = x1 === x2
  return (
    <g className="prop-bracket" aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? <><line x1={x1 - 4} x2={x1 + 4} y1={y1} y2={y1} /><line x1={x1 - 4} x2={x1 + 4} y1={y2} y2={y2} /></> : <><line x1={x1} x2={x1} y1={y1 - 4} y2={y1 + 4} /><line x1={x2} x2={x2} y1={y2 - 4} y2={y2 + 4} /></>}
    </g>
  )
}

/**
 * The target proportions drawn as a soft, solid front-view figure. It is a diagram made only from the numbers (same profile, same drawing), not a picture of the
 * character. With `annotate` it adds a ruler in head units and brackets for the total height, the arm, the leg and the shoulder width.
 */
export function Mannequin({ profile, annotate = false, compare = false }: Props) {
  const art = useMemo(() => schematic(profile), [profile])
  const base = useMemo(() => (compare ? schematic(createProfile(profile.id, 'natural', 0)) : null), [compare, profile.id])
  const head = find(art, 'head')
  const floor = find(art, 'floor')
  const torso = find(art, 'torso')
  const hand = find(art, 'hand-r')
  const unit = head?.h ?? 36
  const top = head?.y ?? 14
  const floorY = floor?.y ?? art.height
  const baseFloor = base ? find(base, 'floor')?.y ?? floorY : floorY
  const baseShift = floorY - baseFloor
  const marks = unit > 0 ? Math.max(0, Math.floor((floorY - top) / unit + 0.001)) : 0
  const v = (id: keyof ProportionProfile['controls']) => profile.controls[id].value
  const above = Math.min(top, top + baseShift)
  const pad = above < 10 ? 10 - above : 0
  const viewH = Math.max(art.height, base ? base.height + baseShift : 0) + pad

  const right = torso ? CX_SHIFT + torso.x + (torso.w ?? 0) + 46 : 0
  const hipY = torso ? torso.y + (torso.h ?? 0) : 0

  return (
    <svg className="prop-svg" viewBox={`0 0 ${WIDTH} ${viewH}`} role="img" aria-label="Schematic preview of the target proportions" data-testid="schematic">
      <defs>
        <linearGradient id="mq-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8fb0ff" /><stop offset="1" stopColor="#5b6fd6" /></linearGradient>
        <linearGradient id="mq-limb" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={viewH}><stop offset="0" stopColor="#9db8ff" /><stop offset="1" stopColor="#6f86e6" /></linearGradient>
        <radialGradient id="mq-ground" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#7d97d4" stopOpacity=".38" /><stop offset="1" stopColor="#7d97d4" stopOpacity="0" /></radialGradient>
      </defs>
      <g transform={`translate(0 ${pad})`}>
        {annotate && (
          <g className="prop-ruler" aria-hidden="true">
            {Array.from({ length: marks + 1 }, (_, i) => <g key={i}><line x1={22} x2={WIDTH - 20} y1={top + i * unit} y2={top + i * unit} /><text x={8} y={top + i * unit + 3}>{i}</text></g>)}
            <text className="prop-ruler-title" x={8} y={top - 6}>Head units</text>
          </g>
        )}
        {floor && <ellipse className="prop-ground" cx={CX_SHIFT + 150} cy={floorY + 1} rx={96} ry={7} fill="url(#mq-ground)" />}
        {base && <g transform={`translate(${CX_SHIFT} ${baseShift})`}><Figure art={base} ghost /></g>}
        <g transform={`translate(${CX_SHIFT} 0)`}><Figure art={art} /></g>
        {annotate && torso && (
          <g className="prop-notes">
            {Math.abs(floorY - v('heightInHeads') * unit - top) > 1 && (
              <g className="prop-target-line" aria-label="Target total height">
                <line x1={44} x2={WIDTH - 20} y1={floorY - v('heightInHeads') * unit} y2={floorY - v('heightInHeads') * unit} />
                <text x={WIDTH - 20} y={floorY - v('heightInHeads') * unit - 3} textAnchor="end">Target {v('heightInHeads')} heads: the parts do not add up to it</text>
              </g>
            )}
            <Bracket x1={44} y1={top} x2={44} y2={floorY} />
            <text x={50} y={(top + floorY) / 2 - 4}>Total</text>
            <text x={50} y={(top + floorY) / 2 + 8}>{v('heightInHeads')} heads</text>
            {hand && <><Bracket x1={right} y1={torso.y} x2={right} y2={hand.y2 ?? torso.y} /><text x={right + 7} y={(torso.y + (hand.y2 ?? torso.y)) / 2 - 2}>Arm</text><text x={right + 7} y={(torso.y + (hand.y2 ?? torso.y)) / 2 + 10}>{v('armLength')} heads</text></>}
            <Bracket x1={right} y1={hipY} x2={right} y2={floorY} />
            <text x={right + 7} y={(hipY + floorY) / 2 - 2}>Leg</text>
            <text x={right + 7} y={(hipY + floorY) / 2 + 10}>{v('legLength')} heads</text>
            <Bracket x1={CX_SHIFT + torso.x} y1={torso.y - 9} x2={CX_SHIFT + torso.x + (torso.w ?? 0)} y2={torso.y - 9} />
            <text className="prop-note-top" x={CX_SHIFT + torso.x + (torso.w ?? 0) + 6} y={torso.y - 5}>{v('shoulderWidth')} head widths</text>
          </g>
        )}
        {floor && <line className="prop-floor" x1={22} x2={WIDTH - 20} y1={floorY} y2={floorY} />}
      </g>
    </svg>
  )
}
