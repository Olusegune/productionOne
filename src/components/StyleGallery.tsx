import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search, Star, X } from 'lucide-react'
import type { StyleBible } from '../domain/visualDevelopment'
import { Style2DPreview } from './Style2DPreview'
import { PROJECT_FAMILY, TWO_D, familyCounts, familyOf, filterStyles, hasOwnThumb, loadFavorites, saveFavorites, thumbFor } from '../domain/styleGallery'

/** A visual gallery for choosing the film's look: search, families, favourites, and a detail panel. Choosing a style never locks it. */
export function StyleGallery(props: { styles: StyleBible[]; current: string; onChoose: (style: StyleBible) => void; onClose: () => void }) {
  const { styles, current, onChoose, onClose } = props
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState('All')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites())
  const [picked, setPicked] = useState(current)
  const search = useRef<HTMLInputElement>(null)
  const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null)

  useEffect(() => { search.current?.focus(); const back = opener.current; return () => { if (back instanceof HTMLElement) back.focus() } }, [])
  const shown = useMemo(() => filterStyles(styles, { query, family, onlyFavorites, favorites }), [styles, query, family, onlyFavorites, favorites])
  const families = useMemo(() => familyCounts(styles), [styles])
  const count2D = useMemo(() => styles.filter((s) => s.spec2d).length, [styles])
  const detail = shown.find((s) => s.name === picked) ?? shown[0]
  const toggleFavorite = (name: string) => setFavorites((current) => { const next = new Set(current); if (next.has(name)) next.delete(name); else next.add(name); saveFavorites(next); return next })

  return createPortal(
    <div className="modal-backdrop sg-backdrop" role="presentation" onClick={onClose}>
      <section className="sg" role="dialog" aria-modal="true" aria-label="Choose a visual style" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <header className="sg-head">
          <div><h2>Choose a look</h2><p>{styles.length} styles. Every picture shows the same scene, so only the style changes.</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close the style gallery"><X size={18} /></button>
        </header>
        <div className="sg-tools">
          <label className="sg-search"><Search size={15} aria-hidden="true" /><input ref={search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search styles" aria-label="Search styles" /></label>
          <button className={`sg-fav-toggle${onlyFavorites ? ' on' : ''}`} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites((v) => !v)}><Star size={14} aria-hidden="true" /> Favourites ({favorites.size})</button>
        </div>
        <div className="sg-families" role="group" aria-label="Style families">
          <button className={family === 'All' ? 'on' : ''} aria-pressed={family === 'All'} onClick={() => setFamily('All')}>All ({styles.length})</button>
          {count2D > 0 && <button className={family === TWO_D ? 'on' : ''} aria-pressed={family === TWO_D} onClick={() => setFamily(TWO_D)}>2D ({count2D})</button>}
          {families.map((f) => <button key={f.family} className={family === f.family ? 'on' : ''} aria-pressed={family === f.family} onClick={() => setFamily(f.family)}>{f.family} ({f.count})</button>)}
        </div>
        <div className="sg-body">
          <ul className="sg-grid" aria-label="Styles">
            {shown.map((s) => {
              const thumb = thumbFor(s)
              return (
                <li key={s.name}>
                  <button className={`sg-card${s.name === picked ? ' on' : ''}`} aria-pressed={s.name === picked} aria-label={`${s.name}${s.name === current ? ', current style' : ''}`} onClick={() => setPicked(s.name)} onDoubleClick={() => onChoose(s)}>
                    {thumb ? <img src={thumb} alt="" loading="lazy" /> : s.spec2d ? <span className="sg-swatch s2d" aria-hidden="true"><Style2DPreview style={s} size={96} /></span> : <span className="sg-swatch" style={{ background: `linear-gradient(135deg, ${s.palette.join(', ')})` }} aria-hidden="true" />}
                    <span className="sg-name">{s.name}</span>
                    {s.name === current && <span className="sg-current" aria-hidden="true"><Check size={14} /></span>}
                  </button>
                  <button className={`sg-star${favorites.has(s.name) ? ' on' : ''}`} aria-pressed={favorites.has(s.name)} aria-label={`${favorites.has(s.name) ? 'Remove' : 'Add'} ${s.name} ${favorites.has(s.name) ? 'from' : 'to'} favourites`} onClick={() => toggleFavorite(s.name)}><Star size={14} aria-hidden="true" /></button>
                </li>
              )
            })}
          </ul>
          {shown.length === 0 && <p className="sg-none">No styles match. {onlyFavorites && favorites.size === 0 ? 'Star a style to keep it here.' : 'Try fewer words or another family.'}</p>}
          {detail && (
            <aside className="sg-detail" aria-label="Selected style">
              {!thumbFor(detail) && detail.spec2d ? <div className="s2d-detail"><Style2DPreview style={detail} size={160} /></div> : thumbFor(detail) ? <img src={thumbFor(detail)!} alt={`${detail.name}: the same scene in this style`} /> : <div className="sg-swatch big" style={{ background: `linear-gradient(135deg, ${detail.palette.join(', ')})` }} role="img" aria-label="Palette of this style" />}
              <h3>{detail.name}</h3>
              <p className="sg-fam">{familyOf(detail)}{!hasOwnThumb(detail) && thumbFor(detail) ? ' · picture shows the family look' : ''}</p>
              <p>{detail.description}</p>
              <div className="sg-palette" aria-label="Palette">{detail.palette.map((c, i) => <span key={`${c}-${i}`} style={{ background: c }} title={c} />)}</div>
              <dl>
                <div><dt>Materials</dt><dd>{detail.materials}</dd></div>
                <div><dt>Rendering</dt><dd>{detail.rendering}</dd></div>
                <div><dt>Lighting</dt><dd>{detail.lighting}</dd></div>
              </dl>
              {detail.spec2d && (
                <dl className="sg-2d" aria-label="2D settings">
                  <div><dt>Line</dt><dd>{detail.spec2d.line}</dd></div>
                  <div><dt>Shape language</dt><dd>{detail.spec2d.shape}</dd></div>
                  <div><dt>Proportions</dt><dd>{detail.spec2d.proportions}</dd></div>
                  <div><dt>Palette</dt><dd>{detail.spec2d.palette}</dd></div>
                  <div><dt>Shading</dt><dd>{detail.spec2d.shading}</dd></div>
                  <div><dt>Texture</dt><dd>{detail.spec2d.texture}</dd></div>
                  <div><dt>Edges and detail</dt><dd>{detail.spec2d.edges}. {detail.spec2d.detail}.</dd></div>
                  <div><dt>Suits this animation approach</dt><dd>{detail.spec2d.animation}</dd></div>
                  <div><dt>What the app makes</dt><dd>{detail.spec2d.output}</dd></div>
                  {detail.spec2d.liveNote && <div><dt>What a real test found</dt><dd>{detail.spec2d.liveNote}</dd></div>}
                  <div><dt>With image models</dt><dd>{detail.spec2d.providerNote} Visual quality: {detail.spec2d.visualStatus === 'live-tested' ? 'live-tested.' : 'not yet checked on any model.'}</dd></div>
                </dl>
              )}
              {detail.spec2d && <p className="sg-hint">{thumbFor(detail) ? 'The picture is an example made with an image model: the same scene in this style. It shows the look, not a guarantee of what every model will make.' : detail.spec2d.preview.provenance}</p>}
              <button className="primary" onClick={() => onChoose(detail)}>{detail.name === current ? 'Keep this style' : 'Use this style'}</button>
              <p className="sg-hint">Choosing a style does not lock it. Lock it on the Design screen when you are happy.</p>
            </aside>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
