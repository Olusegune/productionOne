import { useState } from 'react'
import { Trash2, Undo2 } from 'lucide-react'
import { describeRemoval, removeAsset, type ProjectSlice } from '../domain/removeAsset'

interface Props {
  slice: ProjectSlice
  assetId: string | undefined
  apply: (next: ProjectSlice) => void
}

const noun = (type: string) => (type === 'character' ? 'character' : type === 'set' || type === 'environment' ? 'set' : type === 'costume' ? 'costume' : type === 'prop' ? 'prop' : 'item')

/** "Remove from project" for the selected character, costume, prop or set. It asks first, never deletes picture files, and can be undone straight away. */
export function RemoveAsset({ slice, assetId, apply }: Props) {
  const [asking, setAsking] = useState(false)
  const [undo, setUndo] = useState<{ name: string; before: ProjectSlice } | null>(null)
  const info = assetId ? describeRemoval(slice, assetId) : null
  const confirm = () => {
    if (!assetId || !info?.found) return
    setUndo({ name: info.name, before: slice })
    apply(removeAsset(slice, assetId))
    setAsking(false)
  }
  return (
    <>
      {info?.found && !asking && <button type="button" className="secondary" onClick={() => setAsking(true)}><Trash2 size={14} aria-hidden="true" /> Remove from project</button>}
      {undo && <div className="notice" role="status"><span>{undo.name} was removed.</span> <button type="button" className="secondary" onClick={() => { apply(undo.before); setUndo(null) }}><Undo2 size={14} aria-hidden="true" /> Undo</button> <button type="button" className="secondary" onClick={() => setUndo(null)}>Dismiss</button></div>}
      {asking && info?.found && (
        <div className="panel" role="alertdialog" aria-label={`Remove ${info.name}?`}>
          <p><b>Remove {info.name} from this project?</b></p>
          <p className="helper">
            This takes the {noun(info.type)} out of the project{info.shots ? `, and out of ${info.shots} shot${info.shots === 1 ? '' : 's'}` : ''}.
            {info.pictures ? ` Its ${info.pictures} picture${info.pictures === 1 ? '' : 's'}${info.approved ? ` (${info.approved} approved)` : ''} leave the project, but the picture files stay on your computer.` : ''}
            {info.fromScript ? ' It is named in the script, so it comes back if you analyze the script again.' : ''} You can undo it right after.
          </p>
          <div className="dr-tools">
            <button type="button" className="primary" onClick={confirm}>Remove {info.name}</button>
            <button type="button" className="secondary" onClick={() => setAsking(false)}>Keep it</button>
          </div>
        </div>
      )}
    </>
  )
}
