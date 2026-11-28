/**
 * Variation records: garments, fits, conditions, age variants, transformations and production looks.
 *
 * Every record is an entity with a stable id and numbered, immutable revisions. A revision's spec is written once; the only thing that changes
 * afterwards is its decision (candidate, approved or rejected). Editing means adding a new revision. Anything that depends on another record
 * points at a specific revision ({ id, revision }), never at a name or at "the newest one".
 *
 * This file is pure data and pure functions: nothing here calls a provider, reads a file or starts a paid request.
 * Older projects have no `variations` field at all; see variationMigration.ts for how those are read.
 */

export const VARIATIONS_SCHEMA = 1

export type EntityKind = 'garment' | 'fit' | 'condition' | 'age' | 'transformation' | 'look' | 'relationship' | 'prop' | 'creature' | 'machine' | 'ability'

/** A pinned pointer to one revision of one entity. */
export interface Ref { id: string; revision: number }

export type RevisionStatus = 'candidate' | 'approved' | 'rejected'

/** A picture (or mask) that belongs to a revision. `jobId` links back to the generation queue record that made it; `role` says what it is for. */
export interface MediaRef { path: string; role: string; jobId?: string; view?: string }

export interface Revision<S> {
  /** 1, 2, 3 ... within its entity. Never reused and never renumbered. */
  n: number
  createdAt: string
  status: RevisionStatus
  /** Written once. A change is a new revision. */
  spec: S
  /** The revision this one was made from, in this entity or (for a branch) another. */
  parent?: Ref
  media: MediaRef[]
  /** Free words from the person about why this exists. */
  note?: string
  /** Set on records derived from a project saved before variations existed. */
  legacy?: { source: string; assetId?: string; variant?: string }
}

export interface Entity<K extends EntityKind, S> {
  id: string
  kind: K
  name: string
  /** The character this belongs to, when it belongs to one. A garment is not tied to a character. */
  characterId?: string
  revisions: Array<Revision<S>>
  archived?: boolean
}

// ---------- specs ----------

/** The garment's design: what it is and how it is built. Not how it is drawn (the art style is separate) and not who wears it. */
export interface GarmentSpec {
  description: string
  category?: string
  pieces?: string[]
  /** Free structured design fields: era, fabric, colour, closures, fit and so on. */
  details?: Record<string, string>
}

/** One garment on one character (and, when it applies, one body variant). The same garment has a separate fit for each person. */
export interface FitSpec {
  garment: Ref
  characterId: string
  /** The age or transformation revision this fit was made for, when the body is not the base one. */
  body?: Ref
  /** The garment condition worn, when it is not pristine. */
  condition?: Ref
  /** What the fit must leave alone: face, hair, pose, accessories and so on. */
  keep?: string[]
  /** The name the generation queue files this outfit's pictures under (the look's name). Set when the fit is made so retries and sheets land in the same place. */
  variant?: string
}

export type CharacterSide = 'character-left' | 'character-right' | 'centre' | 'both'

/** A change to one part of a garment. The side is the wearer's side, never the side of the picture. */
export interface ConditionRegion {
  component: string
  side: CharacterSide
  /** The view this mark was made on and the revision of the picture it was made on. A mark on one view does not apply to another view by itself. */
  view?: string
  anchor?: Ref
  severity: 'light' | 'moderate' | 'heavy'
  description: string
}

/** Wear, damage, dirt, wetness or repair, derived from one garment revision. A condition can come from an earlier condition: that is how histories branch. */
export interface ConditionSpec {
  garment: Ref
  kind: string
  regions: ConditionRegion[]
  /** The condition this one continues from. Absent for the first condition on a garment. */
  from?: Ref
  keep?: string[]
}

export interface AgeSpec {
  characterId: string
  /** 'same-person' is a variant of the character. 'redesign' is a younger- or older-looking take. A relative is a separate character, not an age variant. */
  mode: 'same-person' | 'redesign'
  targetAge: string
  adjustments?: Record<string, string>
  keep?: string[]
  /** What must stay recognisable, in the person's own words. */
  anchors?: string[]
  /** The name the generation queue files this age's pictures under (the look's name). */
  variant?: string
}

export interface TransformationSpec {
  characterId: string
  /** For example "normal", "subtle symptoms", "partial", "full form". */
  stage: string
  kind: string
  intensity?: number
  /** What must stay recognisable. */
  anchors?: string[]
  /** What the body is meant to have, so a deliberate feature is not read as an artifact. */
  expectedAnatomy?: string[]
  /** The earlier stage this one continues from. */
  from?: Ref
  /** A creative target (1 barely recognisable to 5 unmistakably them), reviewed by a person. It is never a measured score. */
  recognisability?: number
  /** Free design fields: anatomy and silhouette, skin and surface, features (eyes, hair, teeth, horns, claws), and what changes from the previous stage. */
  details?: Record<string, string>
  symmetry?: 'symmetric' | 'asymmetric' | 'mixed'
  /** What happens to the costume: kept as it is, adapted to the new body, or damaged by the change. */
  costume?: 'keep' | 'adapt' | 'damage'
  /** How strong the result may be for the project's audience. */
  audience?: 'family' | 'teen' | 'mature'
  /** The name the generation queue files this stage's pictures under (the look's name). */
  variant?: string
}

/** A chosen combination. Every slot is a pinned revision. */
export interface LookSpec {
  characterId: string
  age?: Ref
  transformation?: Ref
  fit?: Ref
  condition?: Ref
  accessories?: Ref[]
  /** The fingerprint of the art style this look was approved in. */
  styleFp?: string
  /** Scenes this look is assigned to. */
  sceneIds?: string[]
  /** For looks derived from a saved project: the variant name the generation queue already uses for this character ('Canonical', an age, a costume change). */
  queueVariant?: string
}

// ---------- relationships between assets ----------

export type RelationKind = 'scale' | 'interaction' | 'ownership' | 'attachment'

/** One side of a relationship: an asset (a character, prop, set or environment), and optionally the exact revision of a variation it applies to (a body, an outfit). */
export interface Subject { asset: string; pin?: Ref }

/**
 * A fact about two assets that must hold wherever both appear. Read it as "a <relation> b": a owns b, a sits on b, a is `ratio` times as tall as b, a is attached to b.
 * It is a record like any other: numbered, immutable revisions, approved by a person, and a pinned `Subject.pin` makes it depend on that revision, so when the
 * body or outfit it was agreed for changes, the relationship is flagged for a look instead of silently going stale.
 */
export interface RelationshipSpec {
  relation: RelationKind
  a: Subject
  b: Subject
  /** For an interaction: what a does with b ("sit", "hold", "wear", "operate", "open", "carry"). */
  verb?: string
  /** For ownership: only a may use b. */
  exclusive?: boolean
  /** For scale: a's height divided by b's height. */
  ratio?: number
  /** Declared by a person, or measured from approved pictures. A declared fact is never presented as measured. */
  basis: 'declared' | 'measured'
  note?: string
  /** Scenes this holds in. Absent: everywhere. */
  sceneIds?: string[]
}

/** How a prop is held or used by a person. */
export type PropGrip = 'one-hand' | 'two-hand' | 'worn' | 'carried' | 'none'

/** A prop's declared size, so how it sits in a hand or against a body is a stated fact and not a guess made by the picture model. */
export interface PropSpec {
  /** The prop asset this describes. */
  assetId: string
  /** Longest dimension, and the grip width (the smallest cross-section a hand closes around), in metres. Declared by a person. */
  lengthM: number
  gripM?: number
  grip: PropGrip
  note?: string
}

export type BodyPlan = 'humanoid' | 'quadruped' | 'serpentine' | 'avian' | 'insectoid' | 'amorphous' | 'other'
/** What a being does in the story. It says nothing about its body. */
export type NarrativeRole = 'hero' | 'villain' | 'ally' | 'neutral' | 'background'

/** The anatomy a being is meant to have, declared by a person. Quality checks hold pictures to these facts. */
export interface CreatureSpec {
  assetId: string
  bodyPlan: BodyPlan
  plan?: string
  limbs: Array<{ name: string; count: number; digits?: number }>
  eyes?: number
  symmetry: 'symmetric' | 'asymmetric' | 'mixed'
  /** Features that are deliberate, so they are not read as mistakes. */
  intentional: string[]
  /** Features it must never have. */
  never: string[]
  role?: NarrativeRole
}

export type PartView = 'front' | 'back' | 'side' | 'top'
/** A joint, sensor or panel: how many, where, and the views it must be visible in. */
export interface MachinePart { name: string; count: number; where?: string; views: PartView[] }

/** The parts a robot, android, mech or suit of powered armour must have, declared by a person. */
export interface MachineSpec {
  assetId: string
  kind: 'robot' | 'android' | 'mech' | 'powered-armor'
  joints: MachinePart[]
  sensors: MachinePart[]
  panels: MachinePart[]
  powerSource?: string
  intentional: string[]
  never: string[]
}

export type AbilityState = 'inactive' | 'activation' | 'controlled' | 'peak' | 'recovery' | 'aftermath'

/** A power: one visual language held constant across six states. */
export interface AbilitySpec {
  assetId: string
  name: string
  language: { colour: string; shape: string; motion?: string }
  states: Partial<Record<AbilityState, string>>
  /** 'alpha-required' means a picture may only be called transparent when the file really has transparency. */
  transparency: 'none' | 'translucent' | 'alpha-required'
}

export type Garment = Entity<'garment', GarmentSpec>
export type Fit = Entity<'fit', FitSpec>
export type Condition = Entity<'condition', ConditionSpec>
export type AgeVariant = Entity<'age', AgeSpec>
export type Transformation = Entity<'transformation', TransformationSpec>
export type ProductionLook = Entity<'look', LookSpec>
export type Relationship = Entity<'relationship', RelationshipSpec>
export type Prop = Entity<'prop', PropSpec>
export type Creature = Entity<'creature', CreatureSpec>
export type Machine = Entity<'machine', MachineSpec>
export type Ability = Entity<'ability', AbilitySpec>
export type AnyEntity = Garment | Fit | Condition | AgeVariant | Transformation | ProductionLook | Relationship | Prop | Creature | Machine | Ability
export type AnySpec = GarmentSpec | FitSpec | ConditionSpec | AgeSpec | TransformationSpec | LookSpec | RelationshipSpec | PropSpec | CreatureSpec | MachineSpec | AbilitySpec

export interface VariationState {
  schema: typeof VARIATIONS_SCHEMA
  entities: AnyEntity[]
  /** Last number used per id prefix, so ids are never reused even after something is archived. */
  counters: Record<string, number>
}

export const emptyVariations = (): VariationState => ({ schema: VARIATIONS_SCHEMA, entities: [], counters: {} })

const PREFIX: Record<EntityKind, string> = { garment: 'GAR', fit: 'FIT', condition: 'CND', age: 'AGE', transformation: 'TRN', look: 'LOOK', relationship: 'REL', prop: 'PRP', creature: 'CRT', machine: 'MCH', ability: 'ABL' }

const clone = <T>(value: T): T => structuredClone(value)

export const refKey = (r: Ref) => `${r.id}@${r.revision}`
export const sameRef = (a: Ref | undefined, b: Ref | undefined) => !!a && !!b && a.id === b.id && a.revision === b.revision

export function findEntity(state: VariationState, id: string): AnyEntity | undefined {
  return state.entities.find((e) => e.id === id)
}

export function findRevision(state: VariationState, ref: Ref): Revision<AnySpec> | undefined {
  return findEntity(state, ref.id)?.revisions.find((r) => r.n === ref.revision)
}

/** The newest approved revision of an entity, or undefined when none is approved yet. */
export function latestApproved(entity: AnyEntity): Revision<AnySpec> | undefined {
  return [...entity.revisions].filter((r) => r.status === 'approved').sort((a, b) => b.n - a.n)[0]
}

// ---------- changes: each returns a new state and never edits the one it was given ----------

/** A new entity with its first revision as a candidate. */
export function createEntity<K extends EntityKind>(
  state: VariationState,
  kind: K,
  input: { name: string; characterId?: string; spec: AnySpec; now: string; parent?: Ref; media?: MediaRef[]; note?: string },
): { state: VariationState; ref: Ref } {
  const prefix = PREFIX[kind]
  const next = (state.counters[prefix] ?? 0) + 1
  const id = `${prefix}-${String(next).padStart(3, '0')}`
  const entity = {
    id, kind, name: input.name.trim() || id, ...(input.characterId ? { characterId: input.characterId } : {}),
    revisions: [{ n: 1, createdAt: input.now, status: 'candidate' as const, spec: clone(input.spec), ...(input.parent ? { parent: input.parent } : {}), media: clone(input.media ?? []), ...(input.note ? { note: input.note } : {}) }],
  } as AnyEntity
  return { state: { ...state, entities: [...state.entities, entity], counters: { ...state.counters, [prefix]: next } }, ref: { id, revision: 1 } }
}

/** A new revision of an existing entity. Earlier revisions are left exactly as they were. */
export function addRevision(
  state: VariationState,
  id: string,
  input: { spec: AnySpec; now: string; parent?: Ref; media?: MediaRef[]; note?: string },
): { state: VariationState; ref: Ref } {
  const entity = findEntity(state, id)
  if (!entity) throw new Error(`There is no ${id} in this project.`)
  const n = entity.revisions.reduce((m, r) => Math.max(m, r.n), 0) + 1
  const revision = { n, createdAt: input.now, status: 'candidate' as const, spec: clone(input.spec), parent: input.parent ?? (n > 1 ? { id, revision: n - 1 } : undefined), media: clone(input.media ?? []), ...(input.note ? { note: input.note } : {}) }
  if (!revision.parent) delete (revision as { parent?: Ref }).parent
  const updated = { ...entity, revisions: [...entity.revisions, revision] } as AnyEntity
  return { state: { ...state, entities: state.entities.map((e) => (e.id === id ? updated : e)) }, ref: { id, revision: n } }
}

export class VariationError extends Error {}

function setStatus(state: VariationState, ref: Ref, to: RevisionStatus): VariationState {
  const entity = findEntity(state, ref.id)
  const revision = entity?.revisions.find((r) => r.n === ref.revision)
  if (!entity || !revision) throw new VariationError(`There is no revision ${ref.revision} of ${ref.id} in this project.`)
  if (revision.status === to) return state
  // A decision is made once. An approved revision is never turned back or turned down: make a new revision instead, so nothing that depends on it changes underneath.
  if (revision.status !== 'candidate') throw new VariationError(`${ref.id} revision ${ref.revision} is already ${revision.status}. Make a new revision instead of changing it.`)
  const updated = { ...entity, revisions: entity.revisions.map((r) => (r.n === ref.revision ? { ...r, status: to } : r)) } as AnyEntity
  return { ...state, entities: state.entities.map((e) => (e.id === ref.id ? updated : e)) }
}

export const approveRevision = (state: VariationState, ref: Ref) => setStatus(state, ref, 'approved')
export const rejectRevision = (state: VariationState, ref: Ref) => setStatus(state, ref, 'rejected')

/** Attaches a finished picture to a candidate. Approved and rejected revisions are closed: their pictures do not change. */
export function attachMedia(state: VariationState, ref: Ref, media: MediaRef): VariationState {
  const entity = findEntity(state, ref.id)
  const revision = entity?.revisions.find((r) => r.n === ref.revision)
  if (!entity || !revision) throw new VariationError(`There is no revision ${ref.revision} of ${ref.id} in this project.`)
  if (revision.status !== 'candidate') throw new VariationError(`${ref.id} revision ${ref.revision} is ${revision.status}, so its pictures are closed. Make a new revision to add pictures.`)
  const updated = { ...entity, revisions: entity.revisions.map((r) => (r.n === ref.revision ? { ...r, media: [...r.media, clone(media)] } : r)) } as AnyEntity
  return { ...state, entities: state.entities.map((e) => (e.id === ref.id ? updated : e)) }
}

/** Approves a candidate and records which of its pictures was chosen (that picture's role becomes 'approved'). Nothing else about the revision changes. */
export function approveWithPicture(state: VariationState, ref: Ref, jobId: string): VariationState {
  const entity = findEntity(state, ref.id)
  const revision = entity?.revisions.find((r) => r.n === ref.revision)
  if (!entity || !revision) throw new VariationError(`There is no revision ${ref.revision} of ${ref.id} in this project.`)
  if (!revision.media.some((m) => m.jobId === jobId)) throw new VariationError(`${ref.id} revision ${ref.revision} has no picture from job ${jobId}.`)
  const approved = approveRevision(state, ref)
  const e2 = findEntity(approved, ref.id) as AnyEntity
  const updated = { ...e2, revisions: e2.revisions.map((r) => (r.n === ref.revision ? { ...r, media: r.media.map((m) => (m.jobId === jobId ? { ...m, role: 'approved' } : m)) } : r)) } as AnyEntity
  return { ...approved, entities: approved.entities.map((e) => (e.id === ref.id ? updated : e)) }
}

/** The picture that was chosen when a revision was approved. */
export const approvedPicture = (revision: Revision<AnySpec>): MediaRef | undefined => revision.media.find((m) => m.role === 'approved')
