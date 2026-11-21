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

function Figure({ art, ghost }: { art: Schematic; ghost?: boolean }) {
  const round = (id: string) => (id === 'torso' ? 14 : id === 'hips' ? 8 : id === 'neck' ? 4 : 3)
  return (
    <g className={ghost ? 'prop-ghost' : undefined}>
      {art.shapes.filter((s) => s.id !== 'floor').map((s) => {
        if (s.kind === 'ellipse') return <ellipse key={s.id} data-shape={ghost ? undefined : s.id} cx={s.x + (s.w ?? 0) / 2} cy={s.y + (s.h ?? 0) / 2} rx={(s.w ?? 0) / 2} ry={(s.h ?? 0) / 2} />
        if (s.kind === 'rect') return <rect key={s.id} data-shape={ghost ? undefined : s.id} x={s.x} y={s.y} width={s.w} height={s.h} rx={round(s.id)} />
        return <line key={s.id} data-shape={ghost ? undefined : s.id} x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} />
      })}
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
