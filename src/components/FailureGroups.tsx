import { AlertTriangle, KeyRound, RefreshCw, RotateCcw, Shuffle } from 'lucide-react'
import { reassignModel, retry, type QueueState } from '../domain/generationQueue'
import { groupFailures } from '../domain/failureGroups'
import { useModelChoice } from '../data/modelChoice'

/**
 * Failed views, grouped by the cause they share, so ten views that all failed for one reason read as one problem with one fix.
 * Each group says what happened and offers only fixes that can help; the per-view messages are under Details.
 * Nothing is sent until a button is pressed, and a retry never replaces a view that already has a picture.
 */
export function FailureGroups(props: {
  queue: QueueState
  setQueue: (update: (q: QueueState) => QueueState) => void
  desktop: boolean
  assetName: (id: string) => string
  openProviders: () => void
  openDesign: () => void
  notify: (message: string) => void
}) {
  const { queue, setQueue, desktop, assetName, openProviders, openDesign, notify } = props
  const choice = useModelChoice(desktop, 0)
  const groups = groupFailures(queue)
  if (groups.length === 0) return null
  const total = groups.reduce((n, g) => n + g.jobs.length, 0)
  const current = choice.catalog.find((m) => m.provider === choice.provider && m.id === choice.modelId)?.name ?? choice.modelId

  return (
    <div className="fg" aria-label="Failed views by cause">
      <h4 className="fg-title"><AlertTriangle size={15} aria-hidden="true" /> Failed views <small>{total} in {groups.length} {groups.length === 1 ? 'group' : 'groups'}</small></h4>
      {groups.map((g) => {
        const ids = g.jobs.map((j) => j.id)
        const differs = !g.models.includes(choice.modelId)
        return (
          <section className="fg-group" key={g.cause} aria-label={`${g.label}: ${g.jobs.length} views`}>
            <div className="fg-head">
              <span className="fg-count" aria-hidden="true">{g.jobs.length}</span>
              <div>
                <b>{g.label}</b>
                <small>{g.jobs.length} {g.jobs.length === 1 ? 'view' : 'views'}{g.models.length ? ` · ${g.models.join(', ')}` : ''}</small>
              </div>
            </div>
            <p className="fg-advice">{g.advice}</p>
            <div className="fg-actions">
              {g.fixes.includes('open-design') && <button className="secondary" onClick={openDesign}>Open Design</button>}
              {g.fixes.includes('refresh-models') && <button className="secondary" disabled={!desktop} onClick={async () => notify(await choice.refresh())}><RefreshCw size={14} aria-hidden="true" /> Refresh models</button>}
              {g.fixes.includes('choose-model') && differs && desktop && <button className="secondary" onClick={() => { setQueue((q) => reassignModel(q, ids, choice.provider, choice.modelId)); notify(`${g.jobs.length} ${g.jobs.length === 1 ? 'view' : 'views'} moved to ${current}. They will run when the queue is next started.`) }}><Shuffle size={14} aria-hidden="true" /> Use {current} for these {g.jobs.length}</button>}
              {g.fixes.includes('choose-model') && <button className="tertiary" onClick={openDesign}>Choose a model</button>}
              {g.fixes.includes('open-providers') && <button className="secondary" onClick={openProviders}><KeyRound size={14} aria-hidden="true" /> Provider Settings</button>}
              {g.fixes.includes('retry') && <button className="secondary" onClick={() => { setQueue((q) => ids.reduce((s, id) => retry(s, id), q)); notify(`Retrying ${g.jobs.length} ${g.jobs.length === 1 ? 'view' : 'views'}. Each attempt may use provider credits.`) }}><RotateCcw size={14} aria-hidden="true" /> Retry {g.jobs.length === 1 ? 'this view' : `all ${g.jobs.length}`}</button>}
            </div>
            <details className="fg-details">
              <summary>Details ({g.jobs.length})</summary>
              <ul>
                {g.jobs.map((j) => (
                  <li key={j.id}>
                    <span><b>{assetName(j.assetId)} · {j.label}</b><small>{j.error ?? 'The provider returned an error.'}</small></span>
                    {g.cause !== 'gone' && <button className="tertiary" onClick={() => setQueue((q) => retry(q, j.id))}>Retry</button>}
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )
      })}
    </div>
  )
}
