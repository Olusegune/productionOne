import type { ParsedStory } from '../engine/story'
import type { ExtractedAsset, ScriptScene } from './productionStudio'

export interface StyleBible {
  name: string
  description: string
  palette: string[]
  materials: string
  rendering: string
  lighting: string
  locked: boolean
  revision: number
}

export const defaultStyleBible: StyleBible = {
  name: 'Restrained Cinematic Realism',
  description: 'Grounded production design, tactile materials, natural skin and disciplined composition.',
  palette: ['#171b1f','#d1b47b','#78624a','#6e7a78'],
  materials: 'Weathered natural fibers, practical metals, stone and timber',
  rendering: 'Photorealistic visual development with neutral technical references',
  lighting: 'Neutral 5500K sheets; motivated cinematic light for story frames',
  locked: false,
  revision: 1,
}

export type SheetType = 'Identity'|'Turnaround'|'Expressions'|'Poses'|'Wardrobe'|'Detail'|'Multi-view'|'Functional'|'Establishing'|'Interior'|'Exterior'|'Layout'|'Lighting'
export interface SheetPlan { id:string; assetId:string; type:SheetType; variant:string; required:boolean; status:'planned'|'approved'|'waived' }

const sheetTypes:Record<ExtractedAsset['type'],SheetType[]>={
  character:['Identity','Turnaround','Expressions','Poses','Wardrobe','Detail'],
  costume:['Wardrobe','Turnaround','Detail'],
  prop:['Multi-view','Functional','Detail'],
  set:['Establishing','Interior','Exterior','Layout','Lighting'],
  environment:['Establishing','Layout','Lighting'],
}

export function detectStoryVariants(asset:ExtractedAsset,scenes:ScriptScene[],story?:ParsedStory):string[]{
  if(asset.type!=='character')return ['Canonical']
  if(story){const found=story.variants.filter(variant=>variant.character.toUpperCase()===asset.name.toUpperCase()).map(variant=>variant.value);return ['Canonical',...new Set(found)]}
  const text=scenes.filter(scene=>asset.sceneIds.includes(scene.id)).map(scene=>scene.body).join(' ')
  const escaped=asset.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const variants=new Set<string>(['Canonical'])
  const age=new RegExp(`(?:young|teenage|child|elderly|older|adult)\\s+${escaped}|${escaped}\\s*\\((young|teenage|child|elderly|older|adult)\\)`,'ig')
  for(const match of text.matchAll(age)){const value=(match[1]??match[0].replace(new RegExp(escaped,'ig'),'')).replace(/[()]/g,'').trim();if(value)variants.add(value.replace(/^./,letter=>letter.toUpperCase()))}
  const wardrobe=new RegExp(`${escaped}[^.\\n]{0,45}?(?:wears|wearing|dressed in)\\s+(?:an? |the )?([a-z][a-z -]{2,32}?)(?=[,.]|\\s+and\\s+|$)`,'ig')
  for(const match of text.matchAll(wardrobe)){const value=match[1].trim();if(value)variants.add(value.replace(/^./,letter=>letter.toUpperCase()))}
  return [...variants]
}

export function planAssetSheets(assets:ExtractedAsset[],scenes:ScriptScene[],story?:ParsedStory):SheetPlan[]{
  return assets.flatMap(asset=>detectStoryVariants(asset,scenes,story).flatMap(variant=>sheetTypes[asset.type].map((type,index)=>({id:`SHEET-${asset.id}-${variant.toUpperCase().replace(/[^A-Z0-9]+/g,'-')}-${String(index+1).padStart(2,'0')}`,assetId:asset.id,type,variant,required:true,status:'planned' as const}))))
}

export type ModelTask='identity'|'turnaround'|'editing'|'environment'|'graphic'
export interface ImageModelRecord { provider:string; id:string; name:string; tasks:ModelTask[]; references:'none'|'single'|'multi'|'unknown'; editing:boolean|'unknown'; pricing:string; verifiedAt:string; confidence:number; note:string }

export const imageModelRegistry:ImageModelRecord[]=[
  {provider:'OpenAI',id:'gpt-image-1.5',name:'GPT Image 1.5',tasks:['identity','editing','graphic'],references:'multi',editing:true,pricing:'Provider-priced by image quality and size',verifiedAt:'2026-10-20',confidence:.88,note:'Strong instruction following and image editing through the official Images API.'},
  {provider:'Google',id:'gemini-3-pro-image-preview',name:'Gemini 3 Pro Image Preview',tasks:['identity','turnaround','editing','environment'],references:'multi',editing:true,pricing:'Provider token pricing; confirm before generation',verifiedAt:'2026-10-20',confidence:.86,note:'Multi-reference image generation and conversational editing.'},
  {provider:'fal.ai',id:'catalog-discovery',name:'fal.ai Catalog Selection',tasks:['turnaround','environment','graphic'],references:'unknown',editing:'unknown',pricing:'Model-specific; discover before queueing',verifiedAt:'2026-10-20',confidence:.62,note:'Use live catalog metadata; capability remains unknown until an exact model is selected.'},
  {provider:'KIE.ai',id:'provider-catalog',name:'KIE Image Catalog',tasks:['identity','editing','environment'],references:'unknown',editing:'unknown',pricing:'Model-specific; verify exact endpoint',verifiedAt:'2026-10-20',confidence:.6,note:'Adapter architecture is ready; do not infer image parameters from video endpoints.'},
]

export function recommendModels(asset:ExtractedAsset,sheetType:SheetType):Array<ImageModelRecord&{score:number;reason:string}>{
  const task:ModelTask=asset.type==='environment'||asset.type==='set'?'environment':sheetType==='Turnaround'?'turnaround':sheetType==='Detail'?'editing':'identity'
  return imageModelRegistry.map(model=>{const taskFit=model.tasks.includes(task)?45:10;const referenceFit=model.references==='multi'?25:model.references==='single'?15:0;const editFit=model.editing===true?15:0;const score=Math.round((taskFit+referenceFit+editFit+model.confidence*15)*10)/10;return{...model,score,reason:`${taskFit===45?'Verified task fit':'General fallback'}; ${model.references} reference support; ${model.editing===true?'editing supported':'editing unverified'}.`}}).sort((a,b)=>b.score-a.score)
}
