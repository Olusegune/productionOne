import { useState } from 'react'
import { Check, CircleDot, Film, Footprints, Hand, Headphones, Lock, Package, Sparkles } from 'lucide-react'
import type { AssetType, ExtractedAsset } from '../domain/productionStudio'

type LabMode = 'identity' | 'motion' | 'interaction' | 'sound' | 'continuity'
const modes: Array<{ id: LabMode; label: string; icon: typeof Film }> = [
  { id: 'identity', label: 'Identity', icon: CircleDot },
  { id: 'motion', label: 'Motion', icon: Film },
  { id: 'interaction', label: 'Interaction', icon: Hand },
  { id: 'sound', label: 'Sound', icon: Headphones },
  { id: 'continuity', label: 'Continuity', icon: Lock },
]
const motionByType: Record<AssetType, string[]> = {
  character: ['Turnaround', 'Acting performance', 'Pose study', 'Expression test'],
  costume: ['Drape test', 'Walk and sit', 'Wind response', 'Damage progression'],
  prop: ['Functional demo', 'Hand interaction', 'Open / close states', 'Damage progression'],
  set: ['Camera move', 'Lighting change', 'Weather response', 'Practical effects'],
  environment: ['Camera move', 'Lighting change', 'Weather response', 'Scale reveal'],
}

export function AssetLab({ asset, onChange, notify }: { asset?: ExtractedAsset; onChange: (asset: ExtractedAsset) => void; notify: (message: string) => void }) {
  const [mode, setMode] = useState<LabMode>('identity')
  if (!asset) return null
  const patch = (change: Partial<ExtractedAsset>) => onChange({ ...asset, ...change })
  const motion = asset.motionDirection ?? ''
  const sound = asset.soundDirection ?? ''
  return <section className="asset-lab" aria-label="Asset Lab">
    <div className="asset-lab-head"><div><span className="eyebrow">GOLDEN PATH · ASSET LAB</span><h3>{asset.name} <small>{asset.type}</small></h3></div><span className={`status ${asset.status}`}>{asset.status}</span></div>
    <nav className="asset-lab-tabs" aria-label="Asset Lab modes">{modes.map(({ id, label, icon: Icon }) => <button key={id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}><Icon size={14} /> {label}</button>)}</nav>
    {mode === 'identity' && <div className="asset-lab-content"><p className="asset-lab-lede">Lock the canonical identity before motion tests. These facts are carried into image prompts.</p><div className="asset-lab-grid"><label>Age<input placeholder="e.g. 45–55" value={asset.age ?? ''} onChange={e => patch({ age: e.target.value })} /></label><label>Gender<input placeholder="e.g. male" value={asset.gender ?? ''} onChange={e => patch({ gender: e.target.value })} /></label><label>Race<input placeholder="e.g. Black" value={asset.race ?? ''} onChange={e => patch({ race: e.target.value })} /></label><label>Ethnicity<input placeholder="e.g. Nigerian-American" value={asset.ethnicity ?? ''} onChange={e => patch({ ethnicity: e.target.value })} /></label><label className="wide">Role / department<input placeholder="e.g. preacher, bishop, prop master" value={asset.role ?? ''} onChange={e => patch({ role: e.target.value })} /></label><label className="wide">Never (what must not drift)<input placeholder="e.g. never pale porcelain skin, never a teeth-showing smile" value={asset.never ?? ''} onChange={e => patch({ never: e.target.value })} aria-label="Never: what must not drift" /></label></div></div>}
    {mode === 'motion' && <div className="asset-lab-content"><p className="asset-lab-lede">Choose the motion study to send to the selected video model.</p><div className="lab-chips">{motionByType[asset.type].map(item => <button key={item} className="secondary" onClick={() => { patch({ motionDirection: `${item}: preserve canonical identity, proportions, materials and approved references.` }); notify(`${item} motion study prepared for ${asset.name}.`) }}><Film size={13} /> {item}</button>)}</div><label>Motion direction<textarea rows={4} placeholder="Describe movement, timing, camera, performance and what must not change." value={motion} onChange={e => patch({ motionDirection: e.target.value })} /></label><div className="lab-next"><Footprints size={14} /> Next: choose a video model in Deliver and run a test clip.</div></div>}
    {mode === 'interaction' && <div className="asset-lab-content"><p className="asset-lab-lede">Define how this asset behaves when touched, worn, opened, driven, damaged or staged with another asset.</p><label>Interaction direction<textarea rows={5} placeholder="e.g. Beau opens the brass church door with his right hand; hinge resists, cloth sleeve folds naturally." value={asset.interactionDirection ?? ''} onChange={e => patch({ interactionDirection: e.target.value })} /></label><div className="lab-next"><Hand size={14} /> Interaction references should be approved before production shots.</div></div>}
    {mode === 'sound' && <div className="asset-lab-content"><p className="asset-lab-lede">Give the sound designer a physical behavior brief. This becomes a cue in the delivery package.</p><label>Sound direction<textarea rows={5} placeholder="e.g. low brass hinge creak, latch click, room tone, fabric rustle, engine whine." value={sound} onChange={e => patch({ soundDirection: e.target.value })} /></label><div className="lab-next"><Headphones size={14} /> Next: send the cue to the Sound department for recording or synthesis.</div></div>}
    {mode === 'continuity' && <div className="asset-lab-content"><div className="lab-checks"><p><Check size={14} /> Canonical asset ID: <b>{asset.id}</b></p><p><Check size={14} /> Appears in {asset.sceneIds.length} scene{asset.sceneIds.length === 1 ? '' : 's'}</p><p><Check size={14} /> Reference approval: <b>{asset.status}</b></p><p><Sparkles size={14} /> Motion direction: <b>{motion ? 'prepared' : 'not prepared'}</b></p><p><Package size={14} /> Sound cue: <b>{sound ? 'prepared' : 'not prepared'}</b></p></div><button className="primary" onClick={() => notify(`${asset.name} continuity checklist opened for review.`)}>Review continuity checklist</button></div>}
  </section>
}
