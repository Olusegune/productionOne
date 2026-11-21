import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, FolderSearch, ImageOff } from 'lucide-react'
import { shortPath, type RelinkRow } from '../domain/relink'
import '../relink.css'

interface Props {
  folder: string
  rows: RelinkRow[]
  onConfirm: (jobIds: string[]) => void
  onCancel: () => void
  /** Choose a different folder and look again. */
  onAnother: () => void
}

const wasText = (w: RelinkRow['was']) => (w === 'approved' ? 'Was approved: comes back approved' : w === 'rejected' ? 'Was turned down: comes back turned down' : 'Comes back waiting for your decision')

/**
 * Review matches before relinking: every missing picture, the file found for it in the chosen folder (or that there is none), and a tick box for each. Nothing is changed
 * until "Relink N files" is pressed, and only the ticked pictures are linked (a copy goes into the project's pictures folder; the originals are untouched).
 */
export function RelinkDialog({ folder, rows, onConfirm, onCancel, onAnother }: Props) {
  const found = useMemo(() => rows.filter((r) => r.path), [rows])
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(found.map((r) => r.jobId)))
  useEffect(() => { setTicked(new Set(found.map((r) => r.jobId))) }, [found])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  const toggle = (id: string) => setTicked((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const allTicked = found.length > 0 && found.every((r) => ticked.has(r.jobId))
  const count = found.filter((r) => ticked.has(r.jobId)).length
  const missing = rows.length - found.length

  return createPortal(
    <div className="rl-backdrop" role="presentation">
      <section className="rl-dialog" role="dialog" aria-modal="true" aria-labelledby="rl-title">
        <header>
          <FolderSearch size={22} aria-hidden="true" />
          <div>
            <h3 id="rl-title">Review matches before relinking</h3>
            <p className="helper">Searched <b title={folder}>{shortPath(folder)}</b> and the folders inside it. Pictures are matched by the name they were saved under.</p>
          </div>
        </header>
        <div className="rl-summary" role="status">
          {found.length > 0
            ? <span className="rl-chip ok"><Check size={14} aria-hidden="true" /> {found.length} of {rows.length} found</span>
            : <span className="rl-chip warn"><AlertTriangle size={14} aria-hidden="true" /> None of the {rows.length} missing pictures are in this folder</span>}
          {missing > 0 && found.length > 0 && <span className="rl-chip">{missing} not in this folder</span>}
        </div>
        <div className="rl-table" role="table" aria-label="Matches">
          <div className="rl-row rl-head" role="row">
            <span role="columnheader"><input type="checkbox" aria-label="Select all found pictures" checked={allTicked} disabled={found.length === 0} onChange={() => setTicked(allTicked ? new Set() : new Set(found.map((r) => r.jobId)))} /></span>
            <span role="columnheader">Picture</span>
            <span role="columnheader">Match</span>
          </div>
          {rows.map((r) => (
            <div key={r.jobId} className={`rl-row${r.path ? '' : ' none'}`} role="row">
              <span role="cell">{r.path ? <input type="checkbox" aria-label={`Link ${r.name}`} checked={ticked.has(r.jobId)} onChange={() => toggle(r.jobId)} /> : <ImageOff size={15} aria-hidden="true" />}</span>
              <span role="cell"><b>{r.name}</b><small>{r.stem}</small></span>
              <span role="cell">{r.path ? <><span className="rl-found" title={r.path}>{shortPath(r.path)}</span><small>{wasText(r.was)}</small></> : <span className="rl-missing">Not in this folder</span>}</span>
            </div>
          ))}
        </div>
        <p className="helper">Ticked pictures are copied into the project's pictures folder, because that is the only place the app reads pictures from. The originals are not moved, changed or deleted, and nothing is generated. Pictures you leave unticked, or that were not found, stay missing.</p>
        <footer>
          <button type="button" className="secondary" onClick={onAnother}><FolderSearch size={15} aria-hidden="true" /> Choose another folder</button>
          <span className="rl-spacer" />
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary" disabled={count === 0} onClick={() => onConfirm(found.filter((r) => ticked.has(r.jobId)).map((r) => r.jobId))}>Relink {count} {count === 1 ? 'file' : 'files'}</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
