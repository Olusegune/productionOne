import type { ImageJob } from './generationQueue'
import type { ExtractedAsset } from './productionStudio'
import type { StoryVariant } from '../engine/story'
import { readRelationshipSpec } from './relationships'
import { readPropSpec } from './propFit'
import { readCreatureSpec } from './creatureLab'
import { readMachineSpec } from './machineLab'
import { readProfileSpec } from './profiles'
import { readContinuity } from './sceneContinuity'
import { readAbilitySpec } from './abilityLab'
import { emptyVariations, type AnyEntity, type MediaRef, type Revision, type VariationState, type GarmentSpec, type LookSpec } from './variations'

/**
 * Reading a project that was saved before variations existed.
 *
 * Older projects keep their characters, costume assets, approvals and pictures exactly where they were. Nothing is rewritten or added to the file
 * just by opening it. When the variation tools are used, `variationsOf` gives them records derived from what the project already holds:
 *   - one garment per costume asset (the costume's description, its approved pictures, its approval),
 *   - one production look per character per variant name the generation queue already uses ("Canonical", an age, a costume change).
 * The same project always produces the same records and the same ids, so what is derived today matches what is derived tomorrow.
 * Once a person makes something new, the whole set (derived records included) is saved under `variations` and from then on that saved copy is the truth.
 */
export interface StudioLike {
  analysis: { assets: ExtractedAsset[]; story?: { variants?: StoryVariant[] } }
  queue?: { jobs: ImageJob[] }
  variations?: VariationState
}

const slug = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const AT = '1970-01-01T00:00:00.000Z'

const approvedMedia = (jobs: ImageJob[]): MediaRef[] =>
  jobs.filter((j) => j.approved && j.outputPath).map((j) => ({ path: j.outputPath as string, role: 'legacy-approved-picture', jobId: j.id, view: j.viewKey }))

export function variationsOf(studio: StudioLike): VariationState {
  if (studio.variations) return studio.variations
  return deriveFromLegacy(studio)
}

export function deriveFromLegacy(studio: StudioLike): VariationState {
  const assets = studio.analysis.assets
  const jobs = studio.queue?.jobs ?? []
  const characters = assets.filter((a) => a.type === 'character')
  const byName = new Map(characters.map((c) => [c.name.toUpperCase(), c]))
  const entities: AnyEntity[] = []

  // One garment per costume asset. The text is the costume's own description or the words the script reader kept for it.
  for (const a of assets.filter((x) => x.type === 'costume')) {
    const wearer = byName.get(a.name.replace(/\s+costume$/i, '').toUpperCase())
    const own = jobs.filter((j) => j.assetId === a.id)
    const spec: GarmentSpec = { description: (a.description ?? a.prompt ?? '').trim() }
    const revision: Revision<GarmentSpec> = {
      n: 1, createdAt: AT, status: a.status === 'approved' || own.some((j) => j.approved) ? 'approved' : 'candidate', spec,
      media: approvedMedia(own), legacy: { source: 'costume-asset', assetId: a.id },
    }
    entities.push({ id: `GAR-L-${slug(a.id)}`, kind: 'garment', name: a.name, ...(wearer ? { characterId: wearer.id } : {}), revisions: [revision] })
  }

  // One production look per character per variant name already in use. Pictures made before this keep working: the queue still finds them by that name.
  const names = new Map<string, { character: ExtractedAsset; name: string; sceneIds: Set<string> }>()
  const note = (character: ExtractedAsset, name: string, sceneId?: string) => {
    const key = `${character.id}|${name.toLowerCase()}`
    const found = names.get(key) ?? { character, name, sceneIds: new Set<string>() }
    if (sceneId) found.sceneIds.add(sceneId)
    names.set(key, found)
  }
  for (const c of characters) note(c, 'Canonical')
  for (const j of jobs) { const c = characters.find((x) => x.id === j.assetId); if (c && j.variant) note(c, j.variant) }
  for (const v of studio.analysis.story?.variants ?? []) { const c = byName.get(v.character.toUpperCase()); if (c && v.value.trim()) note(c, v.value.trim(), v.sceneId) }

  for (const { character, name, sceneIds } of names.values()) {
    const own = jobs.filter((j) => j.assetId === character.id && j.variant.toLowerCase() === name.toLowerCase())
    const approved = own.some((j) => j.approved) || (name === 'Canonical' && character.status === 'approved')
    const spec: LookSpec = { characterId: character.id, queueVariant: name, ...(sceneIds.size ? { sceneIds: [...sceneIds].sort() } : {}) }
    const revision: Revision<LookSpec> = { n: 1, createdAt: AT, status: approved ? 'approved' : 'candidate', spec, media: approvedMedia(own), legacy: { source: 'queue-variant', assetId: character.id, variant: name } }
    entities.push({ id: `LOOK-L-${slug(character.id)}-${slug(name)}`, kind: 'look', name: `${character.name} · ${name}`, characterId: character.id, revisions: [revision] })
  }

  return { ...emptyVariations(), entities }
}

/** The variant name the generation queue uses for a look. Looks made after this change keep the name of the look they were built from; derived looks use their original name. */
export function queueVariantOf(look: { revisions: Array<Revision<LookSpec>> }, revision: number): string {
  return look.revisions.find((r) => r.n === revision)?.spec.queueVariant ?? 'Canonical'
}

const KINDS = new Set(['garment', 'fit', 'condition', 'age', 'transformation', 'look', 'relationship', 'prop', 'creature', 'machine', 'ability', 'profile'])
/** Kinds whose settings are checked and rewritten in a known shape when read. */
const SPEC_READERS: Record<string, (raw: unknown) => unknown> = { relationship: readRelationshipSpec, prop: readPropSpec, creature: readCreatureSpec, machine: readMachineSpec, ability: readAbilitySpec, profile: readProfileSpec }
const STATUSES = new Set(['candidate', 'approved', 'rejected'])
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Reads the saved records back from a project file. A project file can be damaged or edited by hand, and the screens read these records on every change,
 * so nothing is trusted: a record needs a known kind, and each revision needs a number, a known decision, a settings object and a list of pictures.
 * Anything that does not is dropped (a record with no valid revision is dropped whole), so a bad file cannot break opening the project.
 */
export function readVariations(raw: unknown): VariationState | undefined {
  if (!isObj(raw) || raw.schema !== 1 || !Array.isArray(raw.entities)) return undefined
  const counters: Record<string, number> = {}
  if (isObj(raw.counters)) for (const [k, v] of Object.entries(raw.counters)) if (typeof v === 'number' && Number.isFinite(v)) counters[k] = v
  const entities: AnyEntity[] = []
  for (const e of raw.entities) {
    if (!isObj(e) || typeof e.id !== 'string' || !e.id || typeof e.kind !== 'string' || !KINDS.has(e.kind) || !Array.isArray(e.revisions)) continue
    const revisions = e.revisions.filter((r): r is Record<string, unknown> => isObj(r) && typeof r.n === 'number' && Number.isInteger(r.n) && r.n > 0 && typeof r.status === 'string' && STATUSES.has(r.status) && isObj(r.spec) && Array.isArray(r.media))
      .map((r) => ({ ...r, media: (r.media as unknown[]).filter((m) => isObj(m) && typeof m.path === 'string' && typeof m.role === 'string') }))
      // A relationship's settings are checked and rewritten in a known shape; a revision whose settings cannot be read is dropped.
      .flatMap((r) => { const read = SPEC_READERS[e.kind as string]; if (!read) return [r]; const spec = read((r as Record<string, unknown>).spec); return spec ? [{ ...r, spec }] : [] })
    if (revisions.length === 0) continue
    entities.push({ ...e, name: typeof e.name === 'string' ? e.name : e.id, revisions } as unknown as AnyEntity)
  }
  const continuity = readContinuity(raw.continuity)
  return { schema: 1, entities, counters, ...(continuity ? { continuity } : {}) }
}
