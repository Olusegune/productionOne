import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { KeyRound, Sparkles, X } from 'lucide-react'
import { enhanceWithTopaz, topazBalance, topazHasKey, type TopazBalance, type TopazResult } from '../data/topaz'
import { costSentence, topazModels, topazPlan } from '../domain/topazPlan'
import '../topaz.css'

interface Props {
  /** The picture to enhance (a file in the app's pictures folder) and its size when known. */
  path: string
  width?: number
  height?: number
  /** What the picture is called, for the heading. */
  name: string
  onClose: () => void
  /** Called with the new, larger file when Topaz has finished (even if this window was closed meanwhile). */
  onDone: (file: TopazResult) => void
  /** Opens Provider Settings on the Topaz key. */
  onKey: () => void
}

/**
 * Enhance with Topaz: choose a model and 2x or 4x, see the size and the likely cost, press the button. Nothing is sent, and no credit is used, until then. The result is a
 * new, larger picture beside the original, which is never changed.
 */
export function TopazEnhance({ path, width, height, name, onClose, onDone, onKey }: Props) {
  const [model, setModel] = useState(topazModels[0].id)
  const [scale, setScale] = useState(2)
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [balance, setBalance] = useState<TopazBalance | null>(null)
  const [state, setState] = useState<{ phase: 'idle' | 'running' | 'done' | 'error'; message: string }>({ phase: 'idle', message: '' })
  const plan = useMemo(() => topazPlan(width, height, scale), [width, height, scale])
  const chosen = topazModels.find((m) => m.id === model) ?? topazModels[0]

  useEffect(() => {
    let live = true
    void topazHasKey().then((ok) => { if (!live) return; setHasKey(ok); if (ok) void topazBalance().then((b) => { if (live) setBalance(b) }).catch(() => {}) })
    return () => { live = false }
  }, [])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const run = async () => {
    setState({ phase: 'running', message: 'Topaz is enhancing the picture. This usually takes under a minute, and can take a few. You can close this window; the new picture appears in Review when it is ready.' })
    try {
      const result = await enhanceWithTopaz(path, model, scale)
      setState({ phase: 'done', message: `Done: ${result.width} by ${result.height} pixels${result.credits === null ? '' : `, ${result.credits} credit${result.credits === 1 ? '' : 's'} used`}. The new picture is waiting for your decision; the original is untouched.` })
      onDone(result)
    } catch (e) { setState({ phase: 'error', message: String(e) }) }
  }

  return createPortal(
    <div className="tz-backdrop" role="presentation">
      <section className="tz-dialog" role="dialog" aria-modal="true" aria-labelledby="tz-title">
        <header>
          <div><span className="eyebrow">Topaz Labs</span><h3 id="tz-title">Enhance {name}</h3></div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>
        <p className="helper">Enlarges and sharpens the picture into a new, larger one. It does not redraw it: faces, costume and pose stay as they are. The original is kept.</p>

        {hasKey === false && (
          <div className="tz-key" role="status">
            <KeyRound size={16} aria-hidden="true" />
            <span>There is no Topaz key yet. Create one at topazlabs.com (My account, API keys), then add it in Provider Settings.</span>
            <button type="button" className="secondary" onClick={onKey}>Add the Topaz key</button>
          </div>
        )}

        <label className="tz-field"><span>What kind of picture is it?</span>
          <select aria-label="Topaz model" value={model} onChange={(e) => setModel(e.target.value)} disabled={state.phase === 'running'}>
            {topazModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <small className="helper">{chosen.note}</small>
        </label>
        <div className="tz-field" role="group" aria-label="How much bigger">
          <span>How much bigger?</span>
          <div className="seg">
            <button type="button" className={scale === 2 ? 'on' : ''} aria-pressed={scale === 2} onClick={() => setScale(2)} disabled={state.phase === 'running'}>2x</button>
            <button type="button" className={scale === 4 ? 'on' : ''} aria-pressed={scale === 4} onClick={() => setScale(4)} disabled={state.phase === 'running'}>4x</button>
          </div>
        </div>

        <p className={`tz-cost${plan.ok ? '' : ' bad'}`} data-testid="tz-cost">{plan.ok ? costSentence(plan) : plan.reason}</p>
        {balance && <p className="helper" data-testid="tz-balance">Your Topaz balance: {balance.available} credit{balance.available === 1 ? '' : 's'} available.</p>}

        {state.message && <p className={`tz-state ${state.phase}`} role={state.phase === 'error' ? 'alert' : 'status'}>{state.message}</p>}

        <footer>
          <button type="button" className="secondary" onClick={onClose}>{state.phase === 'running' ? 'Close (it keeps working)' : 'Close'}</button>
          <button type="button" className="primary" onClick={() => void run()} disabled={!plan.ok || hasKey === false || state.phase === 'running' || state.phase === 'done'}><Sparkles size={15} aria-hidden="true" /> Enhance (uses Topaz credits)</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
