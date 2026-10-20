import {Lock,LockOpen,Palette} from 'lucide-react'
import type {StyleBible} from '../domain/visualDevelopment'

interface Props { style:StyleBible; onChange:(style:StyleBible)=>void; sheetCount:number }

export function ArtDirectionBar({style,onChange,sheetCount}:Props){
  const patch=(change:Partial<StyleBible>)=>onChange({...style,...change,revision:style.revision+1})
  return <section className="art-direction-bar">
    <div className="style-title"><Palette size={17}/><div><span className="eyebrow">ART DIRECTION · STYLE BIBLE V{style.revision}</span><input aria-label="Style name" value={style.name} disabled={style.locked} onChange={event=>patch({name:event.target.value})}/></div></div>
    <label><span>Creative direction</span><input value={style.description} disabled={style.locked} onChange={event=>patch({description:event.target.value})}/></label>
    <label><span>Materials</span><input value={style.materials} disabled={style.locked} onChange={event=>patch({materials:event.target.value})}/></label>
    <div className="palette-row">{style.palette.map((color,index)=><input key={`${color}-${index}`} aria-label={`Palette color ${index+1}`} type="color" value={color} disabled={style.locked} onChange={event=>patch({palette:style.palette.map((item,itemIndex)=>itemIndex===index?event.target.value:item)})}/>)}</div>
    <div className="style-actions"><b>{sheetCount}</b><span>planned sheets</span><button className="secondary" onClick={()=>onChange({...style,locked:!style.locked})}>{style.locked?<Lock size={13}/>:<LockOpen size={13}/>} {style.locked?'Locked':'Lock style'}</button></div>
  </section>
}
