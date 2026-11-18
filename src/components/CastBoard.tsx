import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { FileText, LayoutGrid, List, Palette, Plus, Trash2 } from 'lucide-react'
import type { AnalysisResult, AssetType, ExtractedAsset } from '../domain/productionStudio'
import { evidenceFor, keepSelection, looksOf, scenesOf, typeName, typeTint } from '../domain/castBoard'
import { EditableInventory } from './EditableInventory'
import { RealImage } from './RealImage'

type View = 'cast' | 'list'
const VIEW_KEY = 'po.cast.view'
const types: AssetType[] = ['character', 'costume', 'prop', 'set', 'environment']
const readView = (): View => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cast' } catch { return 'cast' } }

/**
 * The cast and the places, as pictures: a card for every asset, and for the one you select a large picture beside what the script says about it.
 * Everything stays editable here, and the compact list is one switch away for projects with many assets.
 */
export function CastBoard(props: {
  analysis: AnalysisResult
  onChange: (analysis: AnalysisResult) => void
  onAdd: () => void
  onJump?: (line: number) => void
  /** Approved picture per asset id. */
  outputs?: Record<string, string>
  /** Opens the asset where its sheets are made. */
  onOpenAsset?: (assetId: string) => void
  /** Folds one set into another (the dropped set's scenes and shots then use the kept one). */
  onMergeSets?: (keepId: string, dropId: string) => void
}) {
  const { analysis, onChange, onAdd, onJump, outputs = {}, onOpenAsset, onMergeSets } = props
  const [view, setView] = useState<View>(readView)
  const [selectedId, setSelectedId] = useState<string | null>(() => analysis.assets[0]?.id ?? null)
  const cards = useRef<Array<HTMLButtonElement | null>>([])
  const selectedKey = keepSelection(analysis.assets, selectedId)
  useEffect(() => { if (selectedKey !== selectedId) setSelectedId(selectedKey) }, [selectedKey, selectedId])
  useEffect(() => { const i = analysis.assets.findIndex((a) => a.id === selectedKey); cards.current[i]?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' }) }, [selectedKey])
  const choose = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* the view is a convenience */ } }
  const selected = analysis.assets.find((a) => a.id === selectedKey)
  const patch = (id: string, change: Partial<ExtractedAsset>) => onChange({ ...analysis, assets: analysis.assets.map((a) => (a.id === id ? { ...a, ...change } : a)) })
  const remove = (id: string) => onChange({ ...analysis, assets: analysis.assets.filter((a) => a.id !== id) })
  const story = analysis.story
  const evidence = useMemo(() => (selected ? evidenceFor(selected, story) : null), [selected, story])
  const scenes = useMemo(() => (selected ? scenesOf(selected, story) : []), [selected, story])
  const looks = useMemo(() => (selected ? looksOf(selected, story) : []), [selected, story])

  const move = (event: KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? analysis.assets.length - 1 : null
    if (next === null) return
    event.preventDefault()
    const target = Math.max(0, Math.min(analysis.assets.length - 1, next))
    setSelectedId(analysis.assets[target].id)
    cards.current[target]?.focus()
  }

  return (
    <div className="cb">
      <div className="cb-bar">
        <span className="cb-count">{analysis.assets.length} {analysis.assets.length === 1 ? 'asset' : 'assets'}</span>
        <div className="seg" role="group" aria-label="View">
          <button className={view === 'cast' ? 'on' : ''} aria-pressed={view === 'cast'} onClick={() => choose('cast')} title="Cast board"><LayoutGrid size={14} aria-hidden="true" /> Cast</button>
          <button className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => choose('list')} title="Compact list"><List size={14} aria-hidden="true" /> List</button>
        </div>
        <button className="secondary" onClick={onAdd}><Plus size={14} aria-hidden="true" /> Add asset</button>
      </div>

      {view === 'list' ? (
        <EditableInventory analysis={analysis} onChange={onChange} onAdd={onAdd} onJump={onJump} outputs={outputs} />
      ) : analysis.assets.length === 0 ? (
        <p className="helper">No assets yet. Analyze the script, or add one.</p>
      ) : (
        <>

          <ul className="cb-grid" aria-label="Cast board">
            {analysis.assets.map((a, i) => (
              <li key={a.id}>
                <button
                  ref={(el) => { cards.current[i] = el }}
                  className={`cb-card${a.id === selectedKey ? ' on' : ''}`}
                  style={{ ['--tint' as string]: typeTint[a.type] }}
                  aria-pressed={a.id === selectedKey}
                  aria-label={`${a.name}, ${typeName[a.type]}, ${a.status === 'approved' ? 'approved' : 'planned'}`}
                  tabIndex={a.id === selectedKey ? 0 : -1}
                  onClick={() => setSelectedId(a.id)}
                  onKeyDown={(e) => move(e, i)}
                >
                  <span className="cb-img"><RealImage path={outputs[a.id]} label="" empty="No picture yet" /></span>
                  <span className="cb-name">{a.name}</span>
                  <span className="cb-meta"><i className={`cb-dot ${a.status}`} aria-hidden="true" />{typeName[a.type]}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <article className="cb-detail" aria-label={`${selected.name}, selected`} style={{ ['--tint' as string]: typeTint[selected.type] }}>
              <div className="cb-hero">
                <RealImage path={outputs[selected.id]} label={`Approved picture of ${selected.name}`} empty="No approved picture yet" />
                {onOpenAsset && <button className="secondary" onClick={() => onOpenAsset(selected.id)}><Palette size={14} aria-hidden="true" /> {outputs[selected.id] ? 'Open in Design' : 'Make its sheets'}</button>}
              </div>
              <div className="cb-info">
                <div className="cb-line">
                  <select aria-label={`${selected.id} type`} value={selected.type} onChange={(e) => patch(selected.id, { type: e.target.value as AssetType })}>{types.map((t) => <option key={t} value={t}>{typeName[t]}</option>)}</select>
                  <input aria-label={`${selected.id} name`} value={selected.name} onChange={(e) => patch(selected.id, { name: e.target.value })} />
                </div>
                <p className="cb-status"><span className={`status ${selected.status}`}>{selected.status === 'approved' ? 'Approved' : 'Planned'}</span> <small title={selected.id}>{scenes.length ? `${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'}` : 'Added by you'}</small></p>

                {evidence && evidence.kind !== 'none' && (
                  <blockquote className="cb-evidence">
                    <p>{evidence.kind === 'scene' ? <b>{evidence.text}</b> : <>“{evidence.text}”</>}</p>
                    {onJump && evidence.line !== undefined && <button className="tertiary" onClick={() => onJump(evidence.line!)}><FileText size={14} aria-hidden="true" /> Show in the script (line {evidence.line})</button>}
                  </blockquote>
                )}

                {scenes.length > 0 && (
                  <div className="cb-scenes" aria-label="Scenes">
                    {scenes.map((s) => <button key={s.id} className="cb-chip" onClick={() => onJump?.(s.startLine)} title={s.heading}>Scene {s.number}<small>{s.setting || s.heading}</small></button>)}
                  </div>
                )}

                <details className="cb-more">
                  <summary>{selected.type === 'character' ? 'Looks and facts for image prompts' : 'Details'}{looks.length > 0 && <small>{looks.length} found in the script</small>}</summary>
                {looks.length > 0 && (
                    <ul className="cb-looks" aria-label="Looks found in the script">
                      {looks.map((v, i) => <li key={`${v.kind}-${v.value}-${i}`}><b>{v.value}</b> <small>{v.kind}</small>{onJump && <button className="tertiary" onClick={() => onJump(v.evidence.line)}>line {v.evidence.line}</button>}</li>)}
                    </ul>
                  )}

                  {selected.type === 'character' && (
                    <div className="cb-facts" aria-label="Facts that go into image prompts">
                      <input aria-label={`${selected.id} age`} placeholder="Age" value={selected.age ?? ''} onChange={(e) => patch(selected.id, { age: e.target.value })} />
                      <input aria-label={`${selected.id} gender`} placeholder="Gender" value={selected.gender ?? ''} onChange={(e) => patch(selected.id, { gender: e.target.value })} />
                      <input aria-label={`${selected.id} race`} placeholder="Race" value={selected.race ?? ''} onChange={(e) => patch(selected.id, { race: e.target.value })} />
                      <input aria-label={`${selected.id} ethnicity`} placeholder="Ethnicity" value={selected.ethnicity ?? ''} onChange={(e) => patch(selected.id, { ethnicity: e.target.value })} />
                      <input aria-label={`${selected.id} role`} placeholder="Role" value={selected.role ?? ''} onChange={(e) => patch(selected.id, { role: e.target.value })} />
                    </div>
                  )}

                </details>

                <div className="cb-actions">
                  {onMergeSets && (selected.type === 'set' || selected.type === 'environment') && analysis.assets.some((a) => a.id !== selected.id && (a.type === 'set' || a.type === 'environment')) && (
                    <label className="cb-merge"><span>Same place as another set?</span>
                      <select aria-label={`Merge ${selected.name} into`} value="" onChange={(e) => { if (e.target.value) onMergeSets(e.target.value, selected.id) }}>
                        <option value="">Merge {selected.name} into...</option>
                        {analysis.assets.filter((a) => a.id !== selected.id && (a.type === 'set' || a.type === 'environment')).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>
                  )}
                  <button className="tertiary" onClick={() => remove(selected.id)} title={`Remove ${selected.name}`}><Trash2 size={14} aria-hidden="true" /> Remove {selected.name}</button></div>
              </div>
            </article>
          )}

        </>
      )}
    </div>
  )
}
