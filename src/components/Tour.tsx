import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import '../tour.css'

export interface TourStep {
  id: string
  title: string
  body: string
  /** Finds the thing on screen to point at. When it is not there, the card is centred. */
  find: () => Element | null
}

const nav = () => document.querySelector('nav[aria-label="Workspaces"]')
const navButton = (label: string) => [...(nav()?.querySelectorAll('button') ?? [])].find((b) => (b.textContent ?? '').trim().startsWith(label)) ?? null

export const tourSteps: TourStep[] = [
  { id: 'screens', title: 'Seven screens, one path', body: 'Projects, Script, Design, Review, Storyboards, Deliver and Assistant. They follow the Golden Path: create, analyze, design, generate, review, deliver. Direct (storyboards) is optional.', find: nav },
  { id: 'next', title: 'It always tells you what is next', body: 'This button names the next step for your project and takes you there. If you are ever lost, press it.', find: () => document.querySelector('.po-next') },
  { id: 'keys', title: 'Connect an image model', body: 'Pictures are made by an image model. Add a key here (it stays on this computer) or use a model on your own computer with Local AI. Nothing costs money until you press a Generate button, and every Generate button shows an estimate first.', find: () => document.querySelector('button[aria-label="Providers and keys"]') },
  { id: 'assistant', title: 'Or hand it to the Assistant', body: 'Give the Assistant your script and your own pictures, or type your story one line per beat. It plans the production, shows the cost, and only starts when you press Start.', find: () => navButton('Assistant') },
  { id: 'find', title: 'Find anything', body: 'Ctrl+K opens the command list: type what you want and press Enter. F1 opens the full guide with screenshots of every screen.', find: () => document.querySelector('button[aria-label="Open command palette"]') },
  { id: 'first', title: 'Make one picture', body: 'The quick start makes a single picture so you can see what Production One does before you plan a whole film. The model and the cost are shown first, and you decide.', find: () => document.querySelector('.qs') },
]

const KEY = 'po.tour.done'
export const tourDone = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const markDone = () => { try { localStorage.setItem(KEY, '1') } catch { /* private window */ } }

interface Props {
  onClose: () => void
  /** Called when the last step's button is pressed: take the person to the quick start. */
  onFinish?: () => void
  steps?: TourStep[]
}

interface Box { top: number; left: number; width: number; height: number }

/** A short tour that points at the real controls. Skippable at any step (Esc or the x); never changes anything in the project. */
export function Tour({ onClose, onFinish, steps = tourSteps }: Props) {
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1
  const finish = (andGo: boolean) => { markDone(); onClose(); if (andGo) onFinish?.() }

  useLayoutEffect(() => {
    const measure = () => {
      const el = step.find()
      if (!el) { setBox(null); return }
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      const r = el.getBoundingClientRect()
      setBox(r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [step])

  useEffect(() => {
    card.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false)
      if (e.key === 'ArrowRight' && !last) setIndex((i) => i + 1)
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last]) // eslint-disable-line react-hooks/exhaustive-deps

  const pad = 6
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const W = 340
  let top = Math.max(16, vh / 2 - 110), left = Math.max(16, vw / 2 - W / 2)
  if (box) {
    const rightRoom = vw - (box.left + box.width)
    if (rightRoom > W + 24) { left = box.left + box.width + 16; top = Math.min(Math.max(16, box.top), vh - 260) }
    else if (box.top + box.height + 220 < vh) { left = Math.min(Math.max(16, box.left + box.width / 2 - W / 2), vw - W - 16); top = box.top + box.height + 14 }
    else { left = Math.min(Math.max(16, box.left + box.width / 2 - W / 2), vw - W - 16); top = Math.max(16, box.top - 230) }
  }

  return (
    <div className="tour" role="presentation">
      {box ? <div className="tour-spot" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} aria-hidden="true" /> : <div className="tour-dim" aria-hidden="true" />}
      <div className="tour-card" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Quick tour" style={{ top, left, width: W }}>
        <button className="tour-x" onClick={() => finish(false)} aria-label="Skip the tour"><X size={15} aria-hidden="true" /></button>
        <small className="tour-count">{index + 1} of {steps.length}</small>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button className="secondary" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={14} aria-hidden="true" /> Back</button>
          {last
            ? <><button className="secondary" onClick={() => finish(false)}>Done</button>{onFinish && <button className="primary" onClick={() => finish(true)}>Take me there</button>}</>
            : <><button className="tertiary" onClick={() => finish(false)}>Skip</button><button className="primary" onClick={() => setIndex((i) => i + 1)}>Next <ArrowRight size={14} aria-hidden="true" /></button></>}
        </div>
      </div>
    </div>
  )
}
