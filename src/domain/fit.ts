import { specFor, type ProportionProfile } from './proportions'

/**
 * Character-aware set and prop rules. From a character's approved proportions this PROPOSES sizes for things they use (a chair, a doorway, a handle). Every
 * proposal waits for a person: nothing here applies itself, and a space that is meant to be cramped or oversized stays possible (mark the rule intentional).
 * All numbers are illustrative: they come from the profile and a height in metres you set, not from any measured geometry.
 */
export type FitCategory = 'functional' | 'visual' | 'spatial'
export type FitStatus = 'proposed' | 'approved' | 'rejected'
export type FitIntent = 'fit' | 'cramped' | 'oversized'

export interface FitRule {
  id: string
  assetId: string
  /** Stable name of the rule, so a later proposal can be matched to an earlier decision. */
  key: string
  category: FitCategory
  label: string
  /** Metres. Absent for rules that are only wording. */
  valueM?: number
  text: string
  status: FitStatus
  /** "fit" means the object should fit the character; the others record that a tight or huge space is deliberate. */
  intent: FitIntent
  /** Set when the profile has changed since an approved rule was made: the new value that would be proposed. The approved rule itself is never changed for you. */
  newerValueM?: number
}

export interface BodyMetres { headM: number; headWidthM: number; heightM: number; legM: number; upperLegM: number; lowerLegM: number; torsoM: number; neckM: number; armM: number; handM: number; footM: number; shoulderM: number; hipM: number; shoulderHeightM: number }

const cm = (m: number) => Math.round(m * 100) / 100

/** Head units turned into metres with the character's height. */
export function bodyMetres(p: ProportionProfile): BodyMetres {
  const v = (id: Parameters<typeof specFor>[0]) => p.controls[id].value
  const headM = p.heightM / v('heightInHeads')
  const headWidthM = headM / v('facialElongation')
  const legM = v('legLength') * headM
  const torsoM = v('torsoLength') * headM
  return {
    headM: cm(headM), headWidthM: cm(headWidthM), heightM: p.heightM, legM: cm(legM), upperLegM: cm(legM * (v('legBalance') / 100)), lowerLegM: cm(legM * (1 - v('legBalance') / 100)), torsoM: cm(torsoM),
    neckM: cm(v('neckLength') * headM), armM: cm(v('armLength') * headM), handM: cm(v('handSize') * headM), footM: cm(v('footSize') * headM),
    shoulderM: cm(v('shoulderWidth') * headWidthM), hipM: cm(v('hipWidth') * headWidthM), shoulderHeightM: cm(legM + torsoM),
  }
}

export function proposeFitRules(p: ProportionProfile, assetId = p.id): FitRule[] {
  const b = bodyMetres(p)
  const rule = (key: string, category: FitCategory, label: string, text: string, valueM?: number): FitRule => ({ id: `${assetId}:${key}`, assetId, key, category, label, text, valueM, status: 'proposed', intent: 'fit' })
  const shape = p.controls.shapeLanguage.value
  return [
    rule('seat-height', 'functional', 'Chair seat height', `A seat about ${cm(b.lowerLegM)} m high lets the feet rest flat with the knees bent.`, cm(b.lowerLegM)),
    rule('desk-height', 'functional', 'Desk or table height', `A work surface about ${cm(b.lowerLegM + b.torsoM * 0.28)} m high sits comfortably at the elbows when seated.`, cm(b.lowerLegM + b.torsoM * 0.28)),
    rule('doorway-clearance', 'functional', 'Doorway height', `A doorway at least ${cm(b.heightM + 0.15)} m high clears the head with a small margin.`, cm(b.heightM + 0.15)),
    rule('doorway-width', 'functional', 'Doorway width', `A doorway at least ${cm(b.shoulderM + 0.3)} m wide lets the shoulders through without turning.`, cm(b.shoulderM + 0.3)),
    rule('helmet-clearance', 'functional', 'Headroom with a helmet or hat', `About ${cm(b.heightM + b.headM * 0.5)} m of headroom clears a helmet or a tall hat.`, cm(b.heightM + b.headM * 0.5)),
    rule('reach-height', 'functional', 'Standing reach', `A hand reaches about ${cm(b.shoulderHeightM + b.armM)} m above the floor with the arm raised: shelves and switches that must be reached belong below this.`, cm(b.shoulderHeightM + b.armM)),
    rule('stair-riser', 'functional', 'Stair or step height', `A step about ${cm(b.lowerLegM * 0.45)} m high can be climbed without effort.`, cm(b.lowerLegM * 0.45)),
    rule('handle-diameter', 'functional', 'Handle thickness', `A handle about ${cm(b.handM * 0.22)} m across (${Math.round(b.handM * 22)} cm) fits a closed hand; a handle length near ${cm(b.handM * 0.55)} m fits a grip.`, cm(b.handM * 0.22)),
    rule('arm-swing', 'spatial', 'Clear space for arms', `Keep about ${cm(b.armM)} m clear to each side where this character gestures or works.`, cm(b.armM)),
    rule('shape-language', 'visual', 'Visual language of furniture and props', shape >= 40 ? 'Sharp-edged, angular furniture and props echo this character.' : shape <= -40 ? 'Soft, rounded furniture and props echo this character.' : 'No strong shape language: furniture and props can follow the style of the place.'),
  ]
}

/** Folds a fresh set of proposals into the decisions already made. Decided rules are never replaced; a changed value is only noted on them. */
export function mergeProposals(existing: FitRule[], fresh: FitRule[]): FitRule[] {
  const out: FitRule[] = []
  for (const f of fresh) {
    const old = existing.find((e) => e.key === f.key)
    if (!old) { out.push(f); continue }
    if (old.status === 'proposed') { out.push({ ...f, intent: old.intent }); continue }
    out.push(old.valueM !== undefined && f.valueM !== undefined && old.valueM !== f.valueM ? { ...old, newerValueM: f.valueM } : { ...old, newerValueM: undefined })
  }
  return out
}

export const decide = (r: FitRule, status: FitStatus): FitRule => ({ ...r, status })
/** Records that a tight or oversized space is deliberate. Only an approved decision, made by a person, counts as intent. */
export const setIntent = (r: FitRule, intent: FitIntent): FitRule => ({ ...r, intent, status: 'approved' })

/** Approved "fit" rules in words, for a set or prop prompt. Proposed and rejected rules are left out; so are rules marked intentionally cramped or oversized. */
export function approvedRulesText(rules: FitRule[]): string {
  const used = rules.filter((r) => r.status === 'approved' && r.intent === 'fit')
  return used.length ? `Sized for the character (approved): ${used.map((r) => r.text).join(' ')}` : ''
}

export interface ScaleItem { id: 'lineup' | 'doorway' | 'chair' | 'desk' | 'stair' | 'prop'; label: string; description: string }
export interface ScaleMeasure { item: ScaleItem['id']; label: string; valueM: number; basis: 'illustrative' | 'verified' }
export interface ScaleSheet {
  convention: string
  items: ScaleItem[]
  measures: ScaleMeasure[]
  prompt: string
  /** Always says the sizes are illustrative unless every one has been given as verified geometry. */
  basisNote: string
}

/**
 * The Scale and Fit reference sheet: a lineup, a doorway, a chair, a desk, a step and a handheld prop, all in ONE convention (metres, drawn to one scale). Sizes
 * come from the profiles and are labelled "illustrative"; a size is "verified" only if you pass a measured value for it.
 */
export function scaleFitSheet(people: Array<{ name: string; profile: ProportionProfile }>, verified: Partial<Record<ScaleMeasure['item'], number>> = {}): ScaleSheet {
  const first = people[0] ? bodyMetres(people[0].profile) : undefined
  const tallest = Math.max(0, ...people.map((p) => p.profile.heightM))
  const widest = Math.max(0, ...people.map((p) => bodyMetres(p.profile).shoulderM))
  const lowestSeat = people.length ? Math.max(...people.map((p) => bodyMetres(p.profile).lowerLegM)) : 0
  const handM = first?.handM ?? 0
  const m = (item: ScaleMeasure['item'], label: string, valueM: number): ScaleMeasure => ({ item, label, valueM: verified[item] ?? cm(valueM), basis: verified[item] === undefined ? 'illustrative' : 'verified' })
  const measures: ScaleMeasure[] = [
    m('doorway', 'Doorway height', tallest + 0.15),
    m('chair', 'Chair seat height', lowestSeat),
    m('desk', 'Desk height', lowestSeat + (first?.torsoM ?? 0) * 0.28),
    m('stair', 'Step height', lowestSeat * 0.45),
    m('prop', 'Handheld prop length', handM * 1.6),
  ]
  const items: ScaleItem[] = [
    { id: 'lineup', label: 'Lineup', description: `${people.map((p) => `${p.name} (${p.profile.heightM} m)`).join(', ')} standing side by side on one ground line, to one scale.` },
    { id: 'doorway', label: 'Doorway', description: `A doorway ${measures[0].valueM} m high, with the tallest character standing in it.` },
    { id: 'chair', label: 'Chair', description: `A chair with a seat ${measures[1].valueM} m high, with a character seated.` },
    { id: 'desk', label: 'Desk', description: `A desk ${measures[2].valueM} m high, with a character seated at it.` },
    { id: 'stair', label: 'Stair or step', description: `A step ${measures[3].valueM} m high beside a character's foot.` },
    { id: 'prop', label: 'Handheld prop', description: `A handheld prop about ${measures[4].valueM} m long held by a character.` },
  ]
  const convention = 'Metres. One ground line, one scale for every item on the sheet. Heights come from each character\'s target height and proportions.'
  const allVerified = measures.every((x) => x.basis === 'verified')
  return {
    convention, items, measures,
    basisNote: allVerified ? 'Every size is from verified geometry.' : `Sizes marked illustrative come from the proportion profiles${widest ? ` (the widest shoulders are ${cm(widest)} m)` : ''}, not from measured geometry. Check them against the real set before building anything.`,
    prompt: `Scale and fit reference sheet, drawn to one scale in metres, clean orthographic layout. ${items.map((i) => `${i.label}: ${i.description}`).join(' ')} Keep every character's proportions exactly as in their approved reference. Label each object with its height in metres. No text other than those labels.`,
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const CATS: FitCategory[] = ['functional', 'visual', 'spatial']
const STATUSES: FitStatus[] = ['proposed', 'approved', 'rejected']
const INTENTS: FitIntent[] = ['fit', 'cramped', 'oversized']

/** Reads saved fit rules. Anything damaged is dropped; a rule with an unknown status becomes "proposed" so it is never treated as approved by accident. Never throws. */
export function readFitRules(raw: unknown): Record<string, FitRule[]> {
  if (!isObject(raw)) return {}
  const out: Record<string, FitRule[]> = {}
  for (const [assetId, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue
    const rules: FitRule[] = []
    for (const r of list) {
      if (!isObject(r) || typeof r.key !== 'string' || typeof r.label !== 'string' || typeof r.text !== 'string') continue
      rules.push({
        id: `${assetId}:${r.key}`, assetId, key: r.key, label: r.label.slice(0, 120), text: r.text.slice(0, 400),
        category: CATS.includes(r.category as FitCategory) ? (r.category as FitCategory) : 'functional',
        status: STATUSES.includes(r.status as FitStatus) ? (r.status as FitStatus) : 'proposed',
        intent: INTENTS.includes(r.intent as FitIntent) ? (r.intent as FitIntent) : 'fit',
        ...(typeof r.valueM === 'number' && Number.isFinite(r.valueM) ? { valueM: r.valueM } : {}),
        ...(typeof r.newerValueM === 'number' && Number.isFinite(r.newerValueM) ? { newerValueM: r.newerValueM } : {}),
      })
    }
    if (rules.length) out[assetId] = rules
  }
  return out
}
