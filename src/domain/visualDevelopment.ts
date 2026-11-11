import type { ParsedStory } from '../engine/story'
import type { ExtractedAsset, ScriptScene } from './productionStudio'
import { styleLibrary } from './styleLibrary'

export interface StyleBible {
  name: string
  description: string
  palette: string[]
  materials: string
  rendering: string
  lighting: string
  locked: boolean
  revision: number
  family?: string
  animationApproach?: string
  worldTreatment?: string
  shapeLanguage?: string
  surfaceTreatment?: string
  lineTreatment?: string
  cameraBehavior?: string
  detailLevel?: string
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

export const stylePresets: StyleBible[] = [
  defaultStyleBible,
  { name: 'Watercolor Storybook', description: 'Hand-painted storybook shapes, soft edges, visible pigment variation, and expressive simplified forms.', palette: ['#203447', '#d9b77b', '#91a9a3', '#efe1bd'], materials: 'Paper grain, watercolor wash, dry-brush edges', rendering: 'Hand-painted 2D watercolor illustration', lighting: 'Soft neutral reference light; preserve paper texture', locked: false, revision: 1 },
  { name: 'Stylized 3D Feature', description: 'Appealing stylized proportions, clear silhouettes, polished shapes, and controlled cinematic staging.', palette: ['#17202b', '#e2a75e', '#5d8791', '#e6d4b2'], materials: 'Painted resin, cloth, brushed metal, soft matte surfaces', rendering: 'Stylized 3D feature animation visual development', lighting: 'Neutral reference light with motivated story accents', locked: false, revision: 1 },
  { name: 'Graphic Novel Noir', description: 'Strong silhouette design, graphic shadow shapes, selective color, and expressive ink linework.', palette: ['#101318', '#e1c27a', '#7a3030', '#c8c9c2'], materials: 'Ink, paper, halftone grain, dry brush', rendering: 'Graphic novel ink and selective color', lighting: 'High-contrast neutral reference lighting; hard motivated shadows', locked: false, revision: 1 },
  { name: 'Documentary Naturalism', description: 'Observed human detail, authentic locations, restrained composition, and natural imperfections.', palette: ['#252a29', '#c8a66a', '#7b887d', '#ddd6c7'], materials: 'Worn wood, natural fiber, practical metal, weathered paint', rendering: 'Naturalistic documentary visual development', lighting: 'Available light and neutral technical references', locked: false, revision: 1 },
  { name: 'Family 3D Feature', description: 'Warm, readable silhouettes, expressive faces, appealing shapes, and cinematic family adventure staging.', palette: ['#17324a', '#f0b45f', '#83b8a1', '#f5e5c5'], materials: 'Soft cloth, painted wood, satin metal, friendly matte surfaces', rendering: 'Polished stylized 3D feature animation', lighting: 'Soft key light with colorful motivated accents and gentle rim light', locked: false, revision: 1 },
  { name: 'Hand-Painted Fantasy Anime', description: 'Quiet wonder, organic environments, expressive hand-drawn acting, delicate backgrounds, and human-scale detail.', palette: ['#35545b', '#d9b77e', '#9bbd9a', '#f2e5c7'], materials: 'Gouache paper, pencil texture, watercolor foliage, natural wood', rendering: 'Hand-drawn 2D animation with painted background plates', lighting: 'Atmospheric daylight, soft cloud diffusion, luminous practicals', locked: false, revision: 1 },
  { name: 'Cel-Shaded Action', description: 'Crisp graphic planes, decisive silhouettes, dynamic poses, controlled line weight, and readable action staging.', palette: ['#111827', '#ef6c58', '#3b82a8', '#f2d18b'], materials: 'Ink line, flat cel paint, graphic metal and hard-surface forms', rendering: '2D cel-shaded animation with selective linework', lighting: 'Graphic hard light, rim accents, and strong value separation', locked: false, revision: 1 },
  { name: 'Stop-Motion Handmade', description: 'Tactile handcrafted forms, visible construction, charming imperfections, miniature scale, and practical whimsy.', palette: ['#49362d', '#c98b52', '#718b83', '#e7d1a1'], materials: 'Felt, clay, painted foam, paper, wood, thread, practical miniatures', rendering: 'Handmade stop-motion puppet and miniature visual development', lighting: 'Tabletop studio light with warm practical pools and soft shadows', locked: false, revision: 1 },
  { name: 'Graphic Ink and Gouache', description: 'Bold editorial shapes, expressive brushwork, limited palette, and strong visual storytelling in every frame.', palette: ['#202124', '#d9674e', '#e5c27a', '#6c8790'], materials: 'India ink, gouache, rough paper, dry brush and collage texture', rendering: 'Graphic 2D illustration with ink and gouache', lighting: 'Designed shadow shapes with selective highlights', locked: false, revision: 1 },
  { name: 'Retro Futurist', description: 'Optimistic mid-century futurism, elegant geometry, graphic color blocking, and practical speculative technology.', palette: ['#17324d', '#e06f52', '#e7c66e', '#d8e0d6'], materials: 'Brushed aluminum, bakelite, molded plastic, glass and enamel', rendering: 'Retro-futurist production illustration with clean geometry', lighting: 'Studio key light, colored practicals, crisp reflective highlights', locked: false, revision: 1 },
  { name: 'Techno Industrial', description: 'Dense functional machinery, engineered wear, hard surfaces, and grounded industrial scale.', palette: ['#101416', '#b67542', '#5f7271', '#d4c6a1'], materials: 'Oxidized steel, rubber, cables, riveted panels, oil and concrete', rendering: 'Industrial cinematic concept art with technical realism', lighting: 'Hard overheads, sodium practicals, volumetric haze and controlled reflections', locked: false, revision: 1 },
  { name: 'Mythic Epic', description: 'Monumental silhouettes, ceremonial materials, heroic composition, and mythic atmosphere.', palette: ['#24202e', '#c28b57', '#7e9ba1', '#e8d8af'], materials: 'Stone, hammered bronze, leather, wool, carved timber and ash', rendering: 'Painterly epic visual development with monumental scale', lighting: 'Directional sunset, torchlight, atmospheric shafts and deep negative space', locked: false, revision: 1 },
  { name: 'Neon Graphic Future', description: 'High-contrast urban color, luminous surfaces, graphic silhouettes, and kinetic night composition.', palette: ['#0b1020', '#e4479a', '#36c7c2', '#f2c35f'], materials: 'Wet asphalt, acrylic, chrome, translucent plastics and LED surfaces', rendering: 'Stylized neon cinematic illustration', lighting: 'Colored edge light, signage glow, wet-surface reflections and deep blue shadows', locked: false, revision: 1 },
  { name: 'Dark Fairy Tale', description: 'Elegant menace, storybook silhouettes, strange beauty, and restrained surreal detail.', palette: ['#171820', '#725368', '#b4875d', '#d8c49a'], materials: 'Aged velvet, bark, tarnished brass, fog, wax and rough paper', rendering: 'Atmospheric dark-fantasy illustration with storybook texture', lighting: 'Moonlight, candlelight, mist and selective pools of illumination', locked: false, revision: 1 },
  { name: 'Architectural Visualization', description: 'Precise spatial design, believable materials, clear circulation, and disciplined camera language.', palette: ['#27313a', '#c9ad78', '#82959a', '#e2ded2'], materials: 'Concrete, glass, timber, stone, steel and fabric', rendering: 'High-fidelity architectural production visualization', lighting: 'Neutral daylight, practical interior sources and physically coherent bounce', locked: false, revision: 1 },
  { name: 'Photographic Editorial', description: 'Refined composition, authentic texture, controlled styling, and premium editorial restraint.', palette: ['#1c2024', '#b99b72', '#8e9a94', '#eee5d5'], materials: 'Natural skin, tailored cloth, paper, brushed metal and polished wood', rendering: 'Editorial photographic visual development', lighting: 'Large soft source, controlled contrast, neutral color and elegant highlights', locked: false, revision: 1 },
  ...styleLibrary,
]

export { animationApproaches, worldTreatments } from './styleLibrary'

export function styleGuidance(style: StyleBible): string {
  return [style.name, style.description, style.rendering, style.materials, style.lighting, style.animationApproach && `Animation: ${style.animationApproach}`, style.worldTreatment && `World: ${style.worldTreatment}`, style.shapeLanguage && `Shape language: ${style.shapeLanguage}`, style.surfaceTreatment && `Surface: ${style.surfaceTreatment}`, style.lineTreatment && `Line: ${style.lineTreatment}`, style.cameraBehavior && `Camera: ${style.cameraBehavior}`, style.detailLevel && `Detail: ${style.detailLevel}`].filter(Boolean).join('. ')
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
