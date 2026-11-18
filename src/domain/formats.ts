import { aspectRatios } from './sheetSpecs'

/** The shape of the finished picture and video. One choice for the whole project, made at the start. */
export interface ProjectFormat { id: string; label: string; aspect: string; use: string }

export const DEFAULT_FORMAT = '16:9'

/** Named for what people make, not for the ratio. The full list of ratios stays available under "More shapes". */
export const projectFormats: ProjectFormat[] = [
  { id: 'wide', label: 'Widescreen', aspect: '16:9', use: 'YouTube, TV, most films and trailers' },
  { id: 'cinema', label: 'Cinema', aspect: '21:9', use: 'Wide cinematic look (2.39:1 is close)' },
  { id: 'vertical', label: 'TikTok / Reels / Shorts', aspect: '9:16', use: 'Full-screen phone video' },
  { id: 'portrait', label: 'Instagram portrait', aspect: '4:5', use: 'Instagram feed posts' },
  { id: 'square', label: 'Square', aspect: '1:1', use: 'Instagram and Facebook feed, thumbnails' },
]

export const moreShapes: readonly string[] = aspectRatios

export const isAspect = (value: unknown): value is string => typeof value === 'string' && /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(value) && ratioOf(value) > 0

export function ratioOf(aspect: string): number {
  const [w, h] = aspect.split(':').map(Number)
  return w > 0 && h > 0 ? w / h : 0
}

/** A saved value that is not a usable shape (an older project, a hand edit) falls back to widescreen. */
export function cleanFormat(value: unknown): string {
  return isAspect(value) ? value : DEFAULT_FORMAT
}

export function formatName(aspect: string): string {
  return projectFormats.find((f) => f.aspect === aspect)?.label ?? aspect
}

export const isPortrait = (aspect: string) => ratioOf(aspect) < 0.95
export const isSquareish = (aspect: string) => Math.abs(ratioOf(aspect) - 1) <= 0.05

/** Whether a picture made at one shape counts as the other (within 5%). */
export function sameShape(a: string, b: string): boolean {
  const x = ratioOf(a); const y = ratioOf(b)
  return x > 0 && y > 0 && Math.abs(x / y - 1) <= 0.05
}

/** The project's shape if the video model takes it, otherwise the closest one it does take. */
export function videoAspectFor(format: string, supported: readonly string[]): string {
  const list = supported.filter(isAspect)
  if (!list.length) return format
  if (list.some((s) => sameShape(s, format))) return list.find((s) => sameShape(s, format))!
  const want = ratioOf(format)
  return [...list].sort((a, b) => Math.abs(Math.log(ratioOf(a) / want)) - Math.abs(Math.log(ratioOf(b) / want)))[0]
}
