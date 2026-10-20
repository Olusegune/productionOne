export interface ImageInspection { width:number; height:number; format:string; fileSize:number; valid:boolean; warnings:string[] }
export interface LabelRecord { assetName:string; assetId:string; storyVariant:string; state:string; sheetType:string; view:string; sceneReferences:string[]; revision:number; projectStyle:string }

export function labelLines(record:LabelRecord):string[]{
  return [
    `${record.assetId} | ${record.storyVariant} | ${record.state}`,
    `${record.sheetType} | ${record.view} | REV ${String(record.revision).padStart(2,'0')}`,
    `SCENES ${record.sceneReferences.join(', ') || 'NONE'}`,
    `STYLE ${record.projectStyle}`,
  ]
}

export function productionFilename(record:LabelRecord,extension='png'){
  const clean=(value:string)=>value.replace(/[^a-z0-9]+/gi,'_').replace(/(^_|_$)/g,'')
  return `${clean(record.assetId)}_${clean(record.assetName)}_${clean(record.storyVariant)}_${clean(record.sheetType)}_v${String(record.revision).padStart(2,'0')}.${extension}`
}

export function qaDecision(inspection:ImageInspection){
  const warnings=[...inspection.warnings]
  if(!['Png','Jpeg','WebP'].includes(inspection.format)) warnings.push(`Unsupported output format: ${inspection.format}`)
  if(inspection.width/inspection.height>4||inspection.height/inspection.width>4) warnings.push('Extreme aspect ratio requires manual review')
  return { passed:inspection.valid&&warnings.length===0,warnings,requiresManualReview:true }
}
