import { FileText, ImagePlus, Sparkles } from 'lucide-react'
import '../start.css'

interface Props {
  onAssistant: () => void
  onScript: () => void
  onPictures: () => void
}

/**
 * The first thing a new project shows: three clear ways to begin, with the easiest first. It disappears as soon as the project has a script or any assets, and the
 * Golden Path takes over from there.
 */
export function StartChoices({ onAssistant, onScript, onPictures }: Props) {
  return (
    <section className="start-choices" aria-label="How do you want to start?">
      <header>
        <span className="eyebrow">Start here</span>
        <h3>How do you want to start?</h3>
        <p className="helper">Pick one. Nothing is made, and nothing costs anything, until you press a button that says so.</p>
      </header>
      <div className="sc-grid">
        <button type="button" className="sc-card best" onClick={onAssistant}>
          <span className="sc-icon" aria-hidden="true"><Sparkles size={22} /></span>
          <b>Ask the Assistant</b>
          <span>Describe your film or attach a script. It plans the characters, props and places, shows the cost, and makes them when you press Start.</span>
          <em>Easiest way to begin</em>
        </button>
        <button type="button" className="sc-card" onClick={onScript}>
          <span className="sc-icon" aria-hidden="true"><FileText size={22} /></span>
          <b>Add a script</b>
          <span>Paste one or import a Word, PDF, text, Fountain or Final Draft file. Production One finds the cast and shows how it read them.</span>
        </button>
        <button type="button" className="sc-card" onClick={onPictures}>
          <span className="sc-icon" aria-hidden="true"><ImagePlus size={22} /></span>
          <b>Start from my pictures</b>
          <span>Already have pictures of your characters or places? Add them as the approved look and build everything else around them.</span>
        </button>
      </div>
    </section>
  )
}
