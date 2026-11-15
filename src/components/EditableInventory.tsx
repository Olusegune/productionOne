import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Plus, Trash2 } from 'lucide-react'
import type { AnalysisResult, AssetType, ExtractedAsset } from '../domain/productionStudio'
import { RealImage } from './RealImage'

interface Props {
  analysis: AnalysisResult
  onChange: (analysis: AnalysisResult) => void
  onAdd: () => void
  /** Jumps the script to a line, for the Evidence button. */
  onJump?: (line: number) => void
  /** Approved picture per asset id, shown as a thumbnail when there is one. */
  outputs?: Record<string, string>
}
const types: AssetType[] = ['character', 'costume', 'prop', 'set', 'environment']
const typeLabel: Record<AssetType, string> = { character: 'Character', costume: 'Costume', prop: 'Prop', set: 'Set', environment: 'Environment' }

/** Every asset the script needs: type, name, picture, status and where in the script it comes from. Everything stays editable. */
export function EditableInventory({ analysis, onChange, onAdd, onJump, outputs = {} }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const patch = (id: string, change: Partial<ExtractedAsset>) => onChange({ ...analysis, assets: analysis.assets.map((asset) => (asset.id === id ? { ...asset, ...change } : asset)) })
  const remove = (id: string) => onChange({ ...analysis, assets: analysis.assets.filter((asset) => asset.id !== id) })
  const firstLine = (asset: ExtractedAsset) => analysis.story?.scenes.find((s) => asset.sceneIds.includes(s.id))?.startLine
  const sceneNumbers = (asset: ExtractedAsset) => asset.sceneIds.map((id) => analysis.story?.scenes.find((s) => s.id === id)?.number ?? analysis.scenes.find((s) => s.id === id)?.number).filter((n) => n !== undefined).join(', ')
  return (
    <div className="editable-inventory ei">
      <div className="inventory-header"><span>{analysis.assets.length} {analysis.assets.length === 1 ? 'asset' : 'assets'}</span><button className="secondary" onClick={onAdd}><Plus size={14} /> Add asset</button></div>
      <ul className="ei-list">
        {analysis.assets.map((asset) => {
          const line = firstLine(asset)
          const isOpen = open === asset.id
          return (
            <li className="ei-row" key={asset.id}>
              <div className="ei-main">
                <span className="ei-thumb"><RealImage path={outputs[asset.id]} label={`Approved picture of ${asset.name}`} empty="No picture yet" /></span>
                <div className="ei-fields">
                  <div className="ei-line">
                    <select aria-label={`${asset.id} type`} value={asset.type} onChange={(event) => patch(asset.id, { type: event.target.value as AssetType })}>{types.map((type) => <option key={type} value={type}>{typeLabel[type]}</option>)}</select>
                    <input aria-label={`${asset.id} name`} value={asset.name} onChange={(event) => patch(asset.id, { name: event.target.value })} />
                  </div>
                  <div className="ei-sub">
                    <span className={`status ${asset.status}`}>{asset.status === 'approved' ? 'Approved' : 'Planned'}</span>
                    {asset.type === 'character' && [asset.age, asset.gender, asset.role].filter(Boolean).length > 0 && <small className="ei-summary">{[asset.age, asset.gender, asset.role].filter(Boolean).join(' · ')}</small>}
                    <small title={asset.id}>{asset.sceneIds.length ? `Scene${asset.sceneIds.length === 1 ? '' : 's'} ${sceneNumbers(asset) || asset.sceneIds.join(', ')}` : 'Added by you'}</small>
                    <div className="ei-actions">
                      {onJump && line !== undefined && <button className="tertiary" onClick={() => onJump(line)} title="Show where this comes from in the script"><FileText size={14} aria-hidden="true" /> Evidence</button>}
                      {asset.type === 'character' && <button className="tertiary" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : asset.id)} title="Age, gender, race, ethnicity and role go into image prompts">{isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />} Facts</button>}
                      <button className="icon-button" title={`Remove ${asset.name}`} aria-label={`Remove ${asset.name}`} onClick={() => remove(asset.id)}><Trash2 size={14} /></button>
                </div>
                  </div>
                </div>
              </div>
              {asset.type === 'character' && isOpen && (
                <div className="character-facts ei-facts">
                  <input aria-label={`${asset.id} age`} placeholder="Age" value={asset.age ?? ''} onChange={(event) => patch(asset.id, { age: event.target.value })} />
                  <input aria-label={`${asset.id} gender`} placeholder="Gender" value={asset.gender ?? ''} onChange={(event) => patch(asset.id, { gender: event.target.value })} />
                  <input aria-label={`${asset.id} race`} placeholder="Race" value={asset.race ?? ''} onChange={(event) => patch(asset.id, { race: event.target.value })} />
                  <input aria-label={`${asset.id} ethnicity`} placeholder="Ethnicity" value={asset.ethnicity ?? ''} onChange={(event) => patch(asset.id, { ethnicity: event.target.value })} />
                  <input aria-label={`${asset.id} role`} placeholder="Role" value={asset.role ?? ''} onChange={(event) => patch(asset.id, { role: event.target.value })} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
