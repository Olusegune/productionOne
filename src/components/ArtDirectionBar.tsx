import { useMemo, useState } from 'react'
import { Lock, LockOpen, Palette, Search, ChevronDown } from 'lucide-react'
import { animationApproaches, stylePresets, worldTreatments, type StyleBible } from '../domain/visualDevelopment'

interface Props { style: StyleBible; onChange: (style: StyleBible) => void; sheetCount: number }

/** The film's look: one name, a few words on direction and materials, a palette. Locking it freezes the look every sheet and frame is made in. */
export function ArtDirectionBar({ style, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState('All')
  const patch = (change: Partial<StyleBible>) => onChange({ ...style, ...change, revision: style.revision + 1 })
  const families = ['All', ...new Set(stylePresets.map((preset) => preset.family).filter(Boolean) as string[])]
  const filtered = useMemo(() => stylePresets.filter((preset) => (!query.trim() || `${preset.name} ${preset.description} ${preset.family ?? ''}`.toLowerCase().includes(query.toLowerCase())) && (family === 'All' || preset.family === family)).slice(0, 80), [query, family])
  const choose = (preset: StyleBible) => { onChange({ ...preset, locked: false, revision: style.revision + 1 }); setOpen(false); setQuery('') }
  return (
    <section className="ad" aria-label="Visual style">
      <div className="ad-head">
        <Palette size={18} />
        <div className="ad-name">
          <span>Visual style · {stylePresets.length} presets · version {style.revision}</span>
          <div className="style-browser"><button className="style-browser-trigger" disabled={style.locked} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Choose a visual style"><span>{style.name}</span><ChevronDown size={15} /></button>{open && <div className="style-browser-popover"><div className="style-browser-search"><Search size={14} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search 117 styles…" aria-label="Search visual styles" /></div><div className="style-browser-families">{families.map(item => <button key={item} className={family === item ? 'on' : ''} onClick={() => setFamily(item)}>{item}</button>)}</div><div className="style-browser-list">{filtered.map(preset => <button key={preset.name} className={preset.name === style.name ? 'selected' : ''} onClick={() => choose(preset)}><b>{preset.name}</b><small>{preset.family ?? 'Project preset'} · {preset.description}</small></button>)}{!filtered.length && <p className="helper">No styles match that search.</p>}</div></div>}</div>
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
      <p className="ad-coherence">Project-wide visual bible: the selected style flows into characters, costumes, props, sets, storyboards, motion prompts, and delivery packages.</p>
      <div className="ad-fields">
        <label><span>Creative direction</span><input value={style.description} disabled={style.locked} onChange={(e) => patch({ description: e.target.value })} /></label>
        <label><span>Materials</span><input value={style.materials} disabled={style.locked} onChange={(e) => patch({ materials: e.target.value })} /></label>
        <label><span>Animation approach</span><select value={style.animationApproach ?? ''} disabled={style.locked} onChange={(e) => patch({ animationApproach: e.target.value })}><option value="">Choose movement language</option>{animationApproaches.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>World treatment</span><select value={style.worldTreatment ?? ''} disabled={style.locked} onChange={(e) => patch({ worldTreatment: e.target.value })}><option value="">Choose world treatment</option>{worldTreatments.map(item => <option key={item}>{item}</option>)}</select></label>
      </div>
    </section>
  )
}
