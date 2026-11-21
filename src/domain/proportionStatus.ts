import { presets, ratios, type ProportionProfile } from './proportions'

/** The one line a character's Sheets tab shows about its proportions, so it is always clear whether pictures are made from them. */
export interface ProportionStatus { kind: 'none' | 'applied' | 'stale'; text: string }

export function proportionStatus(profile: ProportionProfile | undefined, madeWithEarlier: number): ProportionStatus {
  if (!profile) return { kind: 'none', text: 'No target proportions are set, so pictures are made without them.' }
  const label = presets.find((p) => p.id === profile.preset)?.label ?? 'Custom'
  const base = `Proportions applied: ${label}, ${ratios(profile).stackedHeight} head units tall.`
  if (madeWithEarlier > 0) return { kind: 'stale', text: `${base} ${madeWithEarlier} approved ${madeWithEarlier === 1 ? 'picture was' : 'pictures were'} made with earlier proportions. A picture that is attached makes the model copy its body, so use "Apply and make a new front view" in the proportions.` }
  return { kind: 'applied', text: base }
}
