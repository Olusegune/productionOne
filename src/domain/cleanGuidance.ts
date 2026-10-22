import type { StyleBible } from './visualDevelopment'

/** CleanRender layer A: prompt guidance that heads off common artifacts, matched to the project's look. It never pushes a photographic texture onto a stylised project or removes a warm look the style asks for. */

const stylised = /\b(anime|manga|cartoon|cel[- ]?shad|animated|animation|illustrat|painterly|painted|watercolou?r|comic|graphic novel|stylis|stylize|pixar|claymation|stop[- ]motion|low[- ]poly|pixel|vector|concept art|sketch)\w*/i
const warmLook = /\b(warm|golden|amber|sepia|sunset|sunrise|dusk|candlew*|fire-?light|orange|honey|tungsten|vintage)\b/i

export function isStylised(style: Pick<StyleBible, 'name' | 'description' | 'rendering' | 'materials'>): boolean {
  return stylised.test([style.name, style.description, style.rendering, style.materials].join(' '))
}

export function wantsWarmLook(style: Pick<StyleBible, 'name' | 'description' | 'lighting' | 'palette'>, extra = ''): boolean {
  return warmLook.test([style.name, style.description, style.lighting, extra].join(' '))
}

const yellowProne = (model: string) => /gpt-image|dall-e|openai/i.test(model)

/** One or two short sentences to add to an image prompt. Empty when nothing useful can be said. */
export function artifactGuidance(style: StyleBible, model = '', extraLighting = ''): string {
  const parts: string[] = []
  if (isStylised(style)) {
    parts.push('Keep the chosen illustrated style consistently across the whole image; do not add photographic skin pores, film grain or lens bloom.')
  } else {
    parts.push('Natural skin with visible fine texture and pores, not smoothed or waxy; natural lens sharpness without halos or over-sharpening; no beauty-filter look.')
  }
  if (!wantsWarmLook(style, extraLighting)) {
    parts.push(yellowProne(model) ? 'Neutral white balance with true-to-life colours, no yellow, sepia or golden tint.' : 'Neutral white balance with true-to-life colours.')
  }
  parts.push('Clean detail without visible noise, and no glow or haze around bright areas.')
  return parts.join(' ')
}
