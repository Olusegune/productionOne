import { useRef, useState, type KeyboardEvent } from 'react'
import { Check, Clapperboard, Shirt, Smile, Sparkles, UserRound, Volume2 } from 'lucide-react'
import type { ExtractedAsset } from '../domain/productionStudio'
import type { SheetType } from '../domain/visualDevelopment'
import type { ImageJob } from '../domain/generationQueue'
import { characterBibleProgress, type SectionId, type SectionState } from '../domain/characterBible'

type BibleTab = { id: SectionId; label: string; sheet?: SheetType; icon: typeof UserRound }
const tabs: BibleTab[] = [
  { id: 'identity', label: 'Identity', sheet: 'Identity', icon: UserRound },
  { id: 'turnaround', label: 'Turnaround', sheet: 'Turnaround', icon: Sparkles },
  { id: 'poses', label: 'Poses', sheet: 'Poses', icon: Clapperboard },
  { id: 'expressions', label: 'Expressions', sheet: 'Expressions', icon: Smile },
  { id: 'wardrobe', label: 'Wardrobe', sheet: 'Wardrobe', icon: Shirt },
  { id: 'detail', label: 'Details', sheet: 'Detail', icon: Check },
  { id: 'motion', label: 'Motion video', icon: Clapperboard },
  { id: 'voice', label: 'Voice', icon: Volume2 },
]
const stateText: Record<SectionState, string> = { empty: 'not started', working: 'generating', review: 'needs review', approved: 'approved', blocked: 'locked', ready: 'ready' }

export function CharacterBible({ asset, onSheet, notify, jobs = [], dialogueLines = 0 }: { asset?: ExtractedAsset; onSheet: (sheet: SheetType) => void; notify: (message: string) => void; jobs?: ImageJob[]; dialogueLines?: number }) {
  const [active, setActive] = useState<SectionId>('identity')
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  if (!asset || asset.type !== 'character') return null
  const progress = characterBibleProgress(jobs, asset.id, dialogueLines)
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]
  const currentProgress = progress.find((p) => p.id === current.id)!
  const choose = (tab: BibleTab) => { setActive(tab.id); if (tab.sheet) onSheet(tab.sheet) }
  const onKey = (event: KeyboardEvent, index: number) => {
    const move = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
    if (move === null) return
    event.preventDefault()
    const target = (move + tabs.length) % tabs.length
    refs.current[target]?.focus()
    choose(tabs[target])
  }
  const approvedCount = progress.filter((p) => p.state === 'approved').length
  const sheetCount = progress.filter((p) => p.total > 0 || p.state === 'empty').length - 2
  return <section className="character-bible" aria-label="Character Bible">
    <div className="character-bible-head"><div><span className="eyebrow">CHARACTER BIBLE · CANONICAL PACKAGE</span><h3>{asset.name}</h3><p>One identity anchor shared across every sheet, costume, pose, expression, and motion test. {approvedCount} of {sheetCount} sheets approved.</p></div><span className={`status ${asset.status}`}>{asset.status}</span></div>
    <div className="character-bible-tabs" role="tablist" aria-label="Character Bible sections">{tabs.map((tab, index) => { const Icon = tab.icon; const p = progress.find((x) => x.id === tab.id)!; const on = active === tab.id
      return <button key={tab.id} ref={(el) => { refs.current[index] = el }} id={`bible-tab-${tab.id}`} role="tab" aria-selected={on} aria-controls="bible-panel" tabIndex={on ? 0 : -1} className={`${on ? 'on' : ''} state-${p.state}`} onClick={() => choose(tab)} onKeyDown={(e) => onKey(e, index)}><Icon size={13} aria-hidden="true" />{tab.label}<span className="bible-state">{stateText[p.state]}</span></button> })}</div>
    <div className="character-bible-next" id="bible-panel" role="tabpanel" aria-labelledby={`bible-tab-${current.id}`} aria-live="polite"><b>{current.label}</b><span>{currentProgress.next}</span>
      {current.id === 'motion' && currentProgress.state === 'ready' && <button className="secondary" onClick={() => notify(`Motion tests for ${asset.name} will use the approved Identity and Turnaround sheets as references. Choose a video model in the Direct workspace.`)}>How motion uses these references</button>}
    </div>
  </section>
}
