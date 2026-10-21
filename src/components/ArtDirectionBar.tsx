import { Lock, LockOpen, Palette } from 'lucide-react'
import type { StyleBible } from '../domain/visualDevelopment'

interface Props { style: StyleBible; onChange: (style: StyleBible) => void; sheetCount: number }

/** The film's look: one name, a few words on direction and materials, a palette. Locking it freezes the look every sheet and frame is made in. */
export function ArtDirectionBar({ style, onChange }: Props) {
  const patch = (change: Partial<StyleBible>) => onChange({ ...style, ...change, revision: style.revision + 1 })
  return (
    <section className="ad" aria-label="Visual style">
      <div className="ad-head">
        <Palette size={18} />
        <div className="ad-name">
          <span>Visual style · version {style.revision}</span>
          <input aria-label="Style name" value={style.name} disabled={style.locked} onChange={(e) => patch({ name: e.target.value })} />
        </div>
        <div className="ad-palette" aria-label="Palette">
          {style.palette.map((color, index) => (
            <input key={`${color}-${index}`} aria-label={`Palette color ${index + 1}`} type="color" value={color} disabled={style.locked} onChange={(e) => patch({ palette: style.palette.map((item, i) => (i === index ? e.target.value : item)) })} />
          ))}
        </div>
        <button className={style.locked ? "secondary ad-lock on" : "secondary ad-lock"} onClick={() => onChange({ ...style, locked: !style.locked })} title={style.locked ? "Unlock to change the look" : "Lock the look so every image uses it"}>
          {style.locked ? <Lock size={14} /> : <LockOpen size={14} />} {style.locked ? 'Locked' : 'Lock style'}
        </button>
      </div>
      <div className="ad-fields">
        <label><span>Creative direction</span><input value={style.description} disabled={style.locked} onChange={(e) => patch({ description: e.target.value })} /></label>
        <label><span>Materials</span><input value={style.materials} disabled={style.locked} onChange={(e) => patch({ materials: e.target.value })} /></label>
      </div>
    </section>
  )
}
