import {Plus,Trash2} from 'lucide-react'
import type {AnalysisResult,AssetType,ExtractedAsset} from '../domain/productionStudio'

interface Props { analysis:AnalysisResult; onChange:(analysis:AnalysisResult)=>void; onAdd:()=>void }
const types:AssetType[]=['character','costume','prop','set','environment']

export function EditableInventory({analysis,onChange,onAdd}:Props){
  const patch=(id:string,change:Partial<ExtractedAsset>)=>onChange({...analysis,assets:analysis.assets.map(asset=>asset.id===id?{...asset,...change}:asset)})
  const remove=(id:string)=>onChange({...analysis,assets:analysis.assets.filter(asset=>asset.id!==id)})
  return <div className="editable-inventory">
    <div className="inventory-header"><span>{analysis.assets.length} canonical assets</span><button className="secondary" onClick={onAdd}><Plus size={12}/> Add asset</button></div>
    {analysis.assets.map(asset=><div className="inventory-row" key={asset.id}><span>{asset.id}</span><input aria-label={`${asset.id} name`} value={asset.name} onChange={event=>patch(asset.id,{name:event.target.value})}/><select aria-label={`${asset.id} type`} value={asset.type} onChange={event=>patch(asset.id,{type:event.target.value as AssetType})}>{types.map(type=><option key={type}>{type}</option>)}</select>{asset.type==='character'&&<div className="character-facts"><input aria-label={`${asset.id} age`} placeholder="Age" value={asset.age??''} onChange={event=>patch(asset.id,{age:event.target.value})}/><input aria-label={`${asset.id} gender`} placeholder="Gender" value={asset.gender??''} onChange={event=>patch(asset.id,{gender:event.target.value})}/><input aria-label={`${asset.id} race`} placeholder="Race" value={asset.race??''} onChange={event=>patch(asset.id,{race:event.target.value})}/><input aria-label={`${asset.id} ethnicity`} placeholder="Ethnicity" value={asset.ethnicity??''} onChange={event=>patch(asset.id,{ethnicity:event.target.value})}/><input aria-label={`${asset.id} role`} placeholder="Role" value={asset.role??''} onChange={event=>patch(asset.id,{role:event.target.value})}/></div>}<small>{asset.sceneIds.join(', ')}</small><button title={`Remove ${asset.name}`} onClick={()=>remove(asset.id)}><Trash2 size={12}/></button></div>)}
  </div>
}
