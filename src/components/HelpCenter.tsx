import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, Search, ShieldAlert, Wallet, X } from 'lucide-react'
import { helpChapters, searchHelp, type HelpBlock, type Workspace } from '../domain/helpContent'
import '../help.css'

interface Props {
  onClose: () => void
  /** Opens a screen of the app and closes the guide. */
  onGo?: (workspace: Workspace) => void
  initialChapter?: string
  onDesktopShortcut?: () => void
  version?: string
}

/** Turns **bold** and `code` in a help sentence into elements. Nothing else is interpreted, so help text can never inject markup. */
export function richText(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    return part
  })
}

const noteIcon = { tip: Lightbulb, cost: Wallet, careful: ShieldAlert } as const
const noteLabel = { tip: 'Tip', cost: 'Costs money', careful: 'Be careful' } as const

function Block({ block }: { block: HelpBlock }) {
  const [missing, setMissing] = useState(false)
  const Icon = block.note ? noteIcon[block.note.kind] : null
  return (
    <section className="hc-block">
      <h3>{block.title}</h3>
      {block.text.map((t, i) => <p key={i}>{richText(t)}</p>)}
      {block.steps && <ol className="hc-steps">{block.steps.map((s, i) => <li key={i}>{richText(s)}</li>)}</ol>}
      {block.image && (
        <figure className="hc-figure">
          {missing ? <div className="hc-missing">Screenshot not available</div> : <img src={`/${block.image.file}`} alt={block.image.caption} loading="lazy" onError={() => setMissing(true)} />}
          <figcaption>{block.image.caption}</figcaption>
        </figure>
      )}
      {block.note && Icon && <aside className={`hc-note ${block.note.kind}`} role="note"><Icon size={16} aria-hidden="true" /><div><b>{noteLabel[block.note.kind]}</b><p>{richText(block.note.text)}</p></div></aside>}
    </section>
  )
}

/** The documentation: contents and search on the left, a chapter with a walkthrough and pictures from the app on the right. */
export function HelpCenter({ onClose, onGo, initialChapter = 'welcome', onDesktopShortcut, version }: Props) {
  const [query, setQuery] = useState('')
  const [chapterId, setChapterId] = useState(initialChapter)
  const closeRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const results = useMemo(() => searchHelp(query), [query])
  const chapter = helpChapters.find((c) => c.id === chapterId) ?? helpChapters[0]
  const index = helpChapters.findIndex((c) => c.id === chapter.id)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => { bodyRef.current?.scrollTo?.({ top: 0 }) }, [chapterId])
  const go = (id: string) => { setChapterId(id) }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="hc" role="dialog" aria-modal="true" aria-label="Documentation" onClick={(e) => e.stopPropagation()}>
        <header className="hc-head">
          <h2><BookOpen size={20} aria-hidden="true" /> Production One guide{version ? <small>{version}</small> : null}</h2>
          <button ref={closeRef} className="hc-close" onClick={onClose} aria-label="Close the guide"><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="hc-main">
          <nav className="hc-nav" aria-label="Guide contents">
            <label className="hc-search"><Search size={14} aria-hidden="true" /><input type="search" placeholder="Search the guide" aria-label="Search the guide" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <ol>
              {results.map((c) => (
                <li key={c.id}><button className={c.id === chapter.id ? 'on' : ''} aria-current={c.id === chapter.id ? 'page' : undefined} onClick={() => go(c.id)}><b>{c.title}</b><small>{c.summary}</small></button></li>
              ))}
              {!results.length && <li className="hc-none">Nothing matches "{query}".</li>}
            </ol>
          </nav>
          <div className="hc-body" ref={bodyRef} tabIndex={-1}>
            <h2 className="hc-title">{chapter.title}</h2>
            <p className="hc-summary">{chapter.summary}</p>
            {chapter.blocks.map((b) => <Block key={b.title} block={b} />)}
            <div className="hc-actions">
              {chapter.workspace && onGo && <button className="primary" onClick={() => { onGo(chapter.workspace!); onClose() }}>Open {chapter.workspace}</button>}
              {chapter.id === 'windows' && onDesktopShortcut && <button className="secondary" onClick={onDesktopShortcut}>Add Production One to the Desktop</button>}
            </div>
            <div className="hc-pager">
              {index > 0 ? <button className="secondary" onClick={() => go(helpChapters[index - 1].id)}><ArrowLeft size={14} aria-hidden="true" /> {helpChapters[index - 1].title}</button> : <span />}
              {index < helpChapters.length - 1 ? <button className="secondary" onClick={() => go(helpChapters[index + 1].id)}>{helpChapters[index + 1].title} <ArrowRight size={14} aria-hidden="true" /></button> : <span />}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
