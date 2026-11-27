import { artifactGuidance } from './cleanGuidance'
import type { JobRequest } from './generationQueue'
import { backdropLine, outputName, type ViewSpec } from './sheetSpecs'
import { styleGuidance, type StyleBible } from './visualDevelopment'
import { garmentText, garmentViews } from './wardrobe'
import { addRevision, approvedPicture, createEntity, findEntity, findRevision, latestApproved, type CharacterSide, type ConditionRegion, type ConditionSpec, type GarmentSpec, type Ref, type VariationState } from './variations'

/**
 * Garment conditions: wear, damage, dirt, wetness and repair, derived from an approved garment.
 *
 * Left and right always mean the wearer's left and right, never the picture's. A mark made on one view is not assumed to be right on another:
 * regions are named by garment part and wearer's side (semantic), and only a region marked on a view is described to that view as marked there.
 * A condition can continue from an earlier condition, so histories branch (pristine, dusty, torn, wet; and separately pristine, repaired, faded),
 * and everything an earlier condition established stays a requirement for the ones that continue from it.
 */

export const conditionKinds: ReadonlyArray<{ key: string; label: string; hint: string }> = [
  { key: 'fade', label: 'Fading and discolouration', hint: 'sun-faded shoulders, uneven dye' },
  { key: 'thin', label: 'Thinning and threadbare areas', hint: 'worn through at the cuffs and elbows' },
  { key: 'fray', label: 'Fraying', hint: 'loose threads along the hem' },
  { key: 'tear', label: 'Tears, holes and missing sections', hint: 'torn at the elbow, a missing pocket' },
  { key: 'seam', label: 'Stretched seams and damaged closures', hint: 'a seam splitting, a missing button' },
  { key: 'scuff', label: 'Scuffs and cracked leather', hint: 'cracked across the knuckles of the glove' },
  { key: 'dirt', label: 'Dust, mud, soot and stains', hint: 'mud to the knee, soot on the chest' },
  { key: 'wet', label: 'Wetness', hint: 'soaked through, dark and clinging' },
  { key: 'repair', label: 'Patches, stitching and repairs', hint: 'a neat patch, rough darning' },
  { key: 'custom', label: 'Custom', hint: 'anything else, in your own words' },
]

export const garmentComponents = ['Collar', 'Shoulder', 'Sleeve', 'Cuff', 'Chest', 'Back', 'Waist or belt', 'Hem', 'Pocket', 'Closure (buttons, zip, ties)', 'Lining', 'Elbow or knee', 'Sole or heel', 'Whole garment'] as const

export const sideChoices: ReadonlyArray<{ value: CharacterSide; label: string }> = [
  { value: 'character-left', label: 'Wearer’s left' },
  { value: 'character-right', label: 'Wearer’s right' },
  { value: 'centre', label: 'Centre' },
  { value: 'both', label: 'Both sides' },
]

export const severityWords: Record<ConditionRegion['severity'], string> = { light: 'light', moderate: 'moderate', heavy: 'heavy' }

/** Which side of the picture the wearer's side is on, for views where that is certain. A front view shows the wearer's left on the right of the picture. */
export function pictureSide(side: CharacterSide, viewKey: string): 'left' | 'right' | null {
  const front = /front/.test(viewKey)
  const back = /back|rear/.test(viewKey)
  if (side !== 'character-left' && side !== 'character-right') return null
  if (!front && !back) return null
  const wearerLeft = side === 'character-left'
  return (wearerLeft === front) ? 'right' : 'left'
}

const sideWords = (side: CharacterSide): string => ({ 'character-left': 'the wearer’s left', 'character-right': 'the wearer’s right', centre: 'the centre', both: 'both sides' } as const)[side]

/** One region as a sentence for one view: its part and side first, then where that lands in this view when it is certain, then what changed. */
export function describeRegion(region: ConditionRegion, viewKey: string): string {
  const where = pictureSide(region.side, viewKey)
  const placed = where ? ` (on the ${where} of this picture)` : ''
  const marked = region.view && region.view !== viewKey ? ` Marked on the ${region.view} view: place it consistently with that view and do not copy its position.` : ''
  return `${region.component} on ${sideWords(region.side)}${placed}, ${severityWords[region.severity]}: ${region.description.trim()}.${marked}`
}

export interface Inherited { region: ConditionRegion; from: Ref; kind: string }

/** Everything the condition's history established, oldest first, then the condition's own regions. The chain stops at a loop or a missing record. */
export function inheritedRegions(state: VariationState, ref: Ref): { earlier: Inherited[]; own: Inherited[] } {
  const chain: Ref[] = []
  const seen = new Set<string>()
  let cursor: Ref | undefined = ref
  while (cursor && !seen.has(`${cursor.id}@${cursor.revision}`)) {
    seen.add(`${cursor.id}@${cursor.revision}`)
    chain.unshift(cursor)
    cursor = (findRevision(state, cursor)?.spec as ConditionSpec | undefined)?.from
  }
  const all = chain.flatMap((c) => ((findRevision(state, c)?.spec as ConditionSpec | undefined)?.regions ?? []).map((region) => ({ region, from: c, kind: (findRevision(state, c)?.spec as ConditionSpec).kind })))
  const own = all.filter((x) => x.from.id === ref.id && x.from.revision === ref.revision)
  return { earlier: all.filter((x) => !(x.from.id === ref.id && x.from.revision === ref.revision)), own }
}

/** The history of a condition from the first one to this one. */
export function conditionLineage(state: VariationState, ref: Ref): Ref[] {
  const out: Ref[] = []
  const seen = new Set<string>()
  let cursor: Ref | undefined = ref
  while (cursor && !seen.has(`${cursor.id}@${cursor.revision}`)) { seen.add(`${cursor.id}@${cursor.revision}`); out.unshift(cursor); cursor = (findRevision(state, cursor)?.spec as ConditionSpec | undefined)?.from }
  return out
}

export interface BranchNode { entityId: string; name: string; kind: string; status: string; children: BranchNode[]; depth: number }

/** The conditions of a garment as a tree: conditions made straight from the garment are roots, and each continues into the ones that came from it. */
export function conditionTree(state: VariationState, garmentId: string): BranchNode[] {
  const mine = state.entities.filter((e) => e.kind === 'condition' && e.revisions.some((r) => (r.spec as ConditionSpec).garment.id === garmentId))
  const parentOf = (id: string) => {
    const e = findEntity(state, id)
    const from = e && (e.revisions[e.revisions.length - 1].spec as ConditionSpec).from
    return from?.id
  }
  const build = (id: string, depth: number): BranchNode => {
    const e = findEntity(state, id)!
    const last = e.revisions[e.revisions.length - 1]
    return { entityId: id, name: e.name, kind: (last.spec as ConditionSpec).kind, status: latestApproved(e) ? 'approved' : last.status, depth, children: mine.filter((c) => c.id !== id && parentOf(c.id) === id).map((c) => build(c.id, depth + 1)) }
  }
  return mine.filter((e) => { const p = parentOf(e.id); return !p || !mine.some((m) => m.id === p) }).map((e) => build(e.id, 0))
}

// ---------- making conditions ----------

export function newCondition(state: VariationState, input: { name: string; garment: Ref; kind: string; regions: ConditionRegion[]; from?: Ref; keep?: string[]; now: string }): { variations: VariationState; ref: Ref } {
  const g = findRevision(state, input.garment)
  if (!g || g.status !== 'approved') throw new Error('Approve the garment before changing its condition.')
  if (input.from) {
    const f = findRevision(state, input.from)
    if (!f || f.status !== 'approved') throw new Error('A condition can only continue from an approved condition.')
    const fromSpec = f.spec as ConditionSpec
    if (fromSpec.garment.id !== input.garment.id) throw new Error('A condition can only continue from a condition of the same garment.')
  }
  const spec: ConditionSpec = { garment: input.garment, kind: input.kind, regions: input.regions.map((r) => ({ ...r })), ...(input.from ? { from: input.from } : {}), ...(input.keep?.length ? { keep: [...input.keep] } : {}) }
  const made = createEntity(state, 'condition', { name: input.name, spec, now: input.now, ...(input.from ? { parent: input.from } : {}) })
  return { variations: made.state, ref: made.ref }
}

export function reviseCondition(state: VariationState, conditionId: string, spec: ConditionSpec, now: string): { variations: VariationState; ref: Ref } {
  const made = addRevision(state, conditionId, { spec, now })
  return { variations: made.state, ref: made.ref }
}

/** The approved picture of a condition's newest approved revision. */
export function conditionPicture(state: VariationState, conditionId: string): { ref: Ref; path: string } | undefined {
  const e = findEntity(state, conditionId)
  const rev = e && latestApproved(e)
  const media = rev && approvedPicture(rev)
  return rev && media ? { ref: { id: conditionId, revision: rev.n }, path: media.path } : undefined
}

// ---------- prompts ----------

export interface ConditionPromptInput {
  style: StyleBible
  garmentName: string
  garment: GarmentSpec
  conditionName: string
  condition: ConditionSpec
  earlier: Inherited[]
  view: ViewSpec
  /** The attached picture is the garment (when there is no earlier condition) or the earlier condition. */
  source: 'garment' | 'earlier-condition' | 'none'
  model?: string
  notes?: string
}

export function conditionPrompt({ style, garmentName, garment, conditionName, condition, earlier, view, source, model, notes }: ConditionPromptInput): string {
  const kind = conditionKinds.find((k) => k.key === condition.kind)?.label ?? condition.kind
  const changes = condition.regions.map((r) => `- ${describeRegion(r, view.key)}`)
  const established = earlier.map((e) => `- ${describeRegion(e.region, view.key)}`)
  return [
    `Production reference image: ${view.label} of the garment "${garmentName}" in the condition "${conditionName}" (condition sheet).`,
    view.instruction,
    `Garment design: ${garmentText(garment)}`,
    source === 'none' ? '' : `The attached picture is the approved ${source === 'garment' ? 'garment' : 'earlier condition of this garment'}. Keep its cut, pattern, colours, closures, trim and every part not listed below exactly as it is.`,
    `Condition to show: ${kind}.`,
    changes.length ? `Changes in this condition:\n${changes.join('\n')}` : 'Apply the condition evenly across the garment.',
    established.length ? `Already established by the earlier condition and must stay exactly as in the attached picture:\n${established.join('\n')}` : '',
    'Left and right here always mean the wearer’s left and right, not the left and right of the picture.',
    condition.keep?.length ? `Must remain unchanged: ${condition.keep.join('; ')}.` : '',
    'Show the garment only: no person, no mannequin head, no hands, no feet and no body parts.',
    notes ? `Production notes: ${notes}` : '',
    `Visual style bible: ${styleGuidance(style, 'technical')}.`,
    backdropLine('gray', false, ''),
    'Neutral, even reference lighting with no dramatic shadows.',
    'Exactly ONE single image of ONE garment in ONE view. Do not make a grid, contact sheet, collage or several views side by side.',
    artifactGuidance(style, model ?? '', notes ?? ''),
  ].filter(Boolean).join('\n')
}

export interface ConditionRequestInput {
  style: StyleBible; provider: string; model: string; styleFp?: string; notes?: string
  assetId: string; assetName: string
  condition: Ref; conditionName: string; spec: ConditionSpec
  garmentName: string; garment: GarmentSpec
  earlier: Inherited[]
  /** The approved picture to start from, and what it is. Sent as a reference when the model takes references. */
  source?: { path: string; of: 'garment' | 'earlier-condition'; ref: Ref }
  views?: ViewSpec[]
}

export function conditionRequests(input: ConditionRequestInput): JobRequest[] {
  const variant = `${input.condition.id} r${input.condition.revision}`
  return (input.views ?? garmentViews).map((v) => ({
    assetId: input.assetId, variant, sheetType: 'Wardrobe', viewKey: v.key, label: v.label,
    prompt: conditionPrompt({ style: input.style, garmentName: input.garmentName, garment: input.garment, conditionName: input.conditionName, condition: input.spec, earlier: input.earlier, view: v, source: input.source?.of ?? 'none', model: input.model, notes: input.notes }),
    aspect: v.aspect, fullBody: false, provider: input.provider, model: input.model,
    references: input.source ? [input.source.path] : [], useAnchor: false, styleName: input.style.name, ...(input.styleFp ? { styleFp: input.styleFp } : {}),
    variation: { id: input.condition.id, revision: input.condition.revision, role: 'condition-preview', uses: [
      { id: input.spec.garment.id, revision: input.spec.garment.revision, role: 'garment' },
      ...(input.source ? [{ id: input.source.ref.id, revision: input.source.ref.revision, role: input.source.of === 'garment' ? 'source-garment-picture' : 'source-condition-picture', path: input.source.path }] : []),
    ] },
    outputName: (revision: number) => outputName({ id: input.assetId, name: input.assetName }, variant, 'Wardrobe', v, revision),
  }))
}

/** The requirements a condition puts on every later picture of the garment, in words, for the fit prompt and for the continuity record. */
export function conditionRequirementsText(state: VariationState, ref: Ref, viewKey: string): string {
  const { earlier, own } = inheritedRegions(state, ref)
  const lines = [...earlier, ...own].map((x) => describeRegion(x.region, viewKey))
  return lines.join(' ')
}
