import { useState } from 'react'
import { Lock, LockOpen, Palette, Grid2x2 } from 'lucide-react'
import { StyleGallery } from './StyleGallery'
import { animationApproaches, stylePresets, worldTreatments, type StyleBible } from '../domain/visualDevelopment'

interface Props { style: StyleBible; onChange: (style: StyleBible) => void; sheetCount: number }

/** The film's look: one name, a few words on direction and materials, a palette. Locking it freezes the look every sheet and frame is made in. */
export function ArtDirectionBar({ style, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const patch = (change: Partial<StyleBible>) => onChange({ ...style, ...change, revision: style.revision + 1 })
  const choose = (preset: StyleBible) => { onChange({ ...preset, locked: false, revision: style.revision + 1 }); setOpen(false) }
  return (
    <section className="ad ad-compact" aria-label="Visual style">
      <div className="ad-head">
        <Palette size={18} />
        <div className="ad-name">
          <span>Visual style · version {style.revision}</span>
          <button className="style-browser-trigger" disabled={style.locked} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Choose a visual style"><span>{style.name}</span><Grid2x2 size={15} /> <span className="style-browse-text">Browse styles</span></button>
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
      <details className="ad-details">
        <summary>Look settings <small>name, creative direction, materials, animation, world</small></summary>
        <label className="ad-name-field"><span>Style name</span><input aria-label="Style name" value={style.name} disabled={style.locked} onChange={(e) => patch({ name: e.target.value })} /></label>
      <p className="ad-coherence">Project-wide visual bible: the selected style flows into characters, costumes, props, sets, storyboards, motion prompts, and delivery packages.</p>
      <div className="ad-fields">
        <label><span>Creative direction</span><input value={style.description} disabled={style.locked} onChange={(e) => patch({ description: e.target.value })} /></label>
        <label><span>Materials</span><input value={style.materials} disabled={style.locked} onChange={(e) => patch({ materials: e.target.value })} /></label>
        <label><span>Animation approach</span><select value={style.animationApproach ?? ''} disabled={style.locked} onChange={(e) => patch({ animationApproach: e.target.value })}><option value="">Choose movement language</option>{animationApproaches.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>World treatment</span><select value={style.worldTreatment ?? ''} disabled={style.locked} onChange={(e) => patch({ worldTreatment: e.target.value })}><option value="">Choose world treatment</option>{worldTreatments.map(item => <option key={item}>{item}</option>)}</select></label>
      </div>
      </details>
      {open && <StyleGallery styles={stylePresets} current={style.name} onChoose={choose} onClose={() => setOpen(false)} />}
    </section>
  )
}
