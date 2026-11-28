import { createEntity, latestApproved, type PropGrip, type PropSpec, type Ref, type VariationState } from './variations'
import type { BodyMetres } from './fit'

/**
 * Prop size and fit. A prop's size is declared by a person (revisioned like any record); how it sits against a body is worked out from the character's
 * declared proportions. The rules are simple and labelled as design guidance, not measurement: they say when a prop is clearly too big or too small for the
 * way it is meant to be held, so a picture is not asked to draw a one-handed hammer the length of a door.
 */
export const GRIPS: PropGrip[] = ['one-hand', 'two-hand', 'worn', 'carried', 'none']

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const size = (v: unknown, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : undefined)
const r = (n: number) => String(Math.round(n * 100) / 100)

/** Reads a saved prop size. Unusable settings return undefined and the record is dropped. */
export function readPropSpec(raw: unknown): PropSpec | undefined {
  if (!isObj(raw) || typeof raw.assetId !== 'string' || !raw.assetId.trim()) return undefined
  const lengthM = size(raw.lengthM, 200)
  if (lengthM === undefined) return undefined
  const gripM = size(raw.gripM, 50)
  const grip = GRIPS.includes(raw.grip as PropGrip) ? (raw.grip as PropGrip) : 'none'
  const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim().slice(0, 300) : undefined
  return { assetId: raw.assetId.trim().slice(0, 80), lengthM, grip, ...(gripM !== undefined ? { gripM } : {}), ...(note ? { note } : {}) }
}

export function checkPropSpec(spec: PropSpec): string | undefined {
  if (!spec.assetId) return 'Choose the prop.'
  if (!(spec.lengthM > 0 && spec.lengthM <= 200)) return 'Give the length in metres as a number greater than zero, such as 0.6.'
  if (spec.gripM !== undefined && !(spec.gripM > 0 && spec.gripM <= spec.lengthM)) return 'The grip width must be greater than zero and no longer than the prop.'
  return undefined
}

export interface FitVerdict { ok: boolean; message: string }

/** Whether a prop suits the way it is meant to be held by this body. Illustrative guidance only. */
export function propFit(prop: PropSpec, body: BodyMetres): FitVerdict[] {
  const out: FitVerdict[] = []
  const grip = prop.gripM ?? Math.min(prop.lengthM, body.handM)
  if (prop.grip === 'one-hand') {
    if (grip > body.handM * 1.25) out.push({ ok: false, message: `Too wide to hold in one hand: the grip is ${r(grip)} m and this hand is about ${r(body.handM)} m. Hold it with two hands, or make it smaller.` })
    if (prop.lengthM > body.armM * 1.2) out.push({ ok: false, message: `Too long to hold in one hand: ${r(prop.lengthM)} m against an arm of about ${r(body.armM)} m.` })
  }
  if (prop.grip === 'two-hand' && prop.lengthM > body.heightM * 1.1) out.push({ ok: false, message: `Longer than this person is tall (${r(prop.lengthM)} m against ${r(body.heightM)} m). It cannot be carried like this.` })
  if (prop.grip === 'worn' && prop.lengthM > body.heightM) out.push({ ok: false, message: `Too large to be worn: ${r(prop.lengthM)} m against a height of ${r(body.heightM)} m.` })
  if ((prop.grip === 'one-hand' || prop.grip === 'two-hand') && prop.gripM !== undefined && prop.gripM < body.handM * 0.1) out.push({ ok: false, message: `The grip (${r(prop.gripM)} m) is too thin to see in a hand of about ${r(body.handM)} m.` })
  if (!out.length) out.push({ ok: true, message: `Suits ${prop.grip === 'none' ? 'this body' : prop.grip.replace('-', ' ')} use at this size.` })
  return out
}

/** A sentence for a picture prompt: the stated size, in terms the picture can show against the person. */
export function propScaleLine(prop: PropSpec, body: BodyMetres, propName: string, personName: string): string {
  const hands = prop.lengthM / Math.max(0.01, body.handM)
  return `${propName} is ${r(prop.lengthM)} m long, about ${Math.round(hands * 10) / 10} hand-lengths of ${personName}'s hand and about ${Math.round((prop.lengthM / body.heightM) * 100)}% of ${personName}'s height.`
}

/** The current approved size of a prop asset, if one is recorded. */
export function approvedPropSize(state: VariationState, assetId: string): { ref: Ref; spec: PropSpec } | undefined {
  for (const e of state.entities) {
    if (e.kind !== 'prop' || e.archived) continue
    const rev = latestApproved(e)
    if (rev && (rev.spec as PropSpec).assetId === assetId) return { ref: { id: e.id, revision: rev.n }, spec: rev.spec as PropSpec }
  }
  return undefined
}

/** Records a prop size as a candidate; a new size for the same prop becomes a new revision of the same record, so history is kept. */
export function recordPropSize(state: VariationState, spec: PropSpec, name: string, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const bad = checkPropSpec(spec)
  if (bad) return { error: bad }
  const existing = state.entities.find((e) => e.kind === 'prop' && !e.archived && (e.revisions[e.revisions.length - 1].spec as PropSpec).assetId === spec.assetId)
  if (existing) {
    const n = existing.revisions.reduce((m, x) => Math.max(m, x.n), 0) + 1
    const updated = { ...existing, revisions: [...existing.revisions, { n, createdAt: now, status: 'candidate' as const, spec: structuredClone(spec), parent: { id: existing.id, revision: n - 1 }, media: [] }] }
    return { state: { ...state, entities: state.entities.map((e) => (e.id === existing.id ? (updated as typeof e) : e)) }, ref: { id: existing.id, revision: n } }
  }
  return createEntity(state, 'prop', { name: `${name} size`, spec, now })
}
