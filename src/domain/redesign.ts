import { describe as describeProportions, type ProportionProfile } from './proportions'

/**
 * Redesigning an imported character. The original picture is never changed or replaced. Landmark positions are ESTIMATES until you confirm them. A warp is
 * only a labelled preview (the picture stretched); the real redesign is a newly generated candidate that you compare with the original and approve as a new
 * revision.
 */
export const WARP_LABEL = 'Preview only: the picture is stretched to show the change. It is not a redesign and is never saved as one.'

export type LandmarkId = 'top-of-head' | 'chin' | 'shoulder-line' | 'hip-line' | 'knee' | 'sole'
export interface Landmark { id: LandmarkId; /** 0..1 across the image */ x: number; /** 0..1 down the image */ y: number; certainty: 'estimated' | 'confirmed' }

/**
 * Where the landmarks probably are, assuming a single standing figure centred in the picture with a little margin. It cannot see the picture, so every one is
 * marked "estimated"; the person moves and confirms them.
 */
export function estimateLandmarks(from: ProportionProfile): Landmark[] {
  const margin = 0.04
  const h = 1 - 2 * margin
  const heads = from.controls.heightInHeads.value
  const unit = h / heads
  const top = margin
  const chin = top + unit
  const shoulder = chin + from.controls.neckLength.value * unit
  const hip = shoulder + from.controls.torsoLength.value * unit
  const sole = hip + from.controls.legLength.value * unit
  const knee = hip + (sole - hip) * (from.controls.legBalance.value / 100)
  const r = (n: number) => Math.round(n * 1000) / 1000
  return ([['top-of-head', top], ['chin', chin], ['shoulder-line', shoulder], ['hip-line', hip], ['knee', knee], ['sole', sole]] as Array<[LandmarkId, number]>).map(([id, y]) => ({ id, x: 0.5, y: r(y), certainty: 'estimated' as const }))
}

export const confirmLandmark = (l: Landmark, x: number, y: number): Landmark => ({ ...l, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), certainty: 'confirmed' })
export const uncertain = (ls: Landmark[]) => ls.filter((l) => l.certainty === 'estimated')

export interface WarpBand { from: [number, number]; to: [number, number]; scaleX: number }

/** For the labelled preview only: how each vertical band of the figure would stretch to reach the target proportions. */
export function warpBands(source: ProportionProfile, target: ProportionProfile): WarpBand[] {
  const s = estimateLandmarks(source)
  const t = estimateLandmarks(target)
  const bands: WarpBand[] = []
  for (let i = 0; i < s.length - 1; i++) {
    const widthRatio = s[i].id === 'shoulder-line' ? target.controls.shoulderWidth.value / source.controls.shoulderWidth.value : s[i].id === 'hip-line' ? target.controls.hipWidth.value / source.controls.hipWidth.value : 1
    bands.push({ from: [s[i].y, s[i + 1].y], to: [t[i].y, t[i + 1].y], scaleX: Math.round(widthRatio * 1000) / 1000 })
  }
  return bands
}

export interface RedesignRequest { sheetType: 'redesign-candidate'; viewKey: 'candidate'; label: string; prompt: string; references: string[]; outputName: (revision: number) => string }

/** One request for a new candidate. The original is attached as the reference and is never the output file. */
export function redesignRequest(assetId: string, assetName: string, originalPath: string, target: ProportionProfile): RedesignRequest {
  const words = describeProportions(target)
  return {
    sheetType: 'redesign-candidate', viewKey: 'candidate', label: `Redesign candidate for ${assetName}`,
    prompt: [
      `Redraw the character in the attached picture as a new image. Keep the same face, hair, costume, colours and art style exactly.`,
      `Change only the body and face proportions.${words ? ` ${words}` : ' Use ordinary natural adult proportions.'}`,
      `Redraw the figure; do not stretch, squash or warp the original picture. The entire figure from head to feet is visible, front view, plain background, no text.`,
    ].join(' '),
    references: [originalPath],
    outputName: (revision: number) => `${assetId}_redesign-candidate_v${String(revision).padStart(2, '0')}`,
  }
}

export interface Comparison { before: string; after: string | undefined; ready: boolean }
export const compare = (originalPath: string, candidatePath: string | undefined): Comparison => ({ before: originalPath, after: candidatePath, ready: !!candidatePath })
