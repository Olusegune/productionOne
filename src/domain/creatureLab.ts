import { createEntity, latestApproved, type CreatureSpec, type NarrativeRole, type BodyPlan, type Ref, type VariationState } from './variations'

/**
 * Creature and anatomy. What a being is meant to have is declared by a person and kept as a revisioned record: body plan, limbs with counts and digits, eyes,
 * symmetry, features that are intentional, and features it must never have. Quality checks read these declared facts, so six fingers on a hand that is meant to
 * have six is intended, and six on a hand meant to have five is flagged. Nothing here looks at a picture: counts seen in a picture come from a person (or
 * from a model that has been measured), and are compared here.
 *
 * Hero, villain and the other roles are narrative: they say what a being does in the story, not what its body is. Two beings can share one body plan
 * and differ only in role.
 */
export const BODY_PLANS: BodyPlan[] = ['humanoid', 'quadruped', 'serpentine', 'avian', 'insectoid', 'amorphous', 'other']
export const ROLES: NarrativeRole[] = ['hero', 'villain', 'ally', 'neutral', 'background']

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const count = (v: unknown, max: number): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : undefined)
const words = (v: unknown, n: number, each: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim().slice(0, each)).slice(0, n) : [])

/** Reads a saved creature record. Unusable settings return undefined and the record is dropped. */
export function readCreatureSpec(raw: unknown): CreatureSpec | undefined {
  if (!isObj(raw) || typeof raw.assetId !== 'string' || !raw.assetId.trim()) return undefined
  const bodyPlan = BODY_PLANS.includes(raw.bodyPlan as BodyPlan) ? (raw.bodyPlan as BodyPlan) : undefined
  if (!bodyPlan) return undefined
  const limbs = (Array.isArray(raw.limbs) ? raw.limbs : []).flatMap((l) => {
    if (!isObj(l) || typeof l.name !== 'string' || !l.name.trim()) return []
    const n = count(l.count, 100)
    if (n === undefined) return []
    const digits = count(l.digits, 100)
    return [{ name: l.name.trim().slice(0, 40), count: n, ...(digits !== undefined ? { digits } : {}) }]
  }).slice(0, 30)
  const eyes = count(raw.eyes, 100)
  const role = ROLES.includes(raw.role as NarrativeRole) ? (raw.role as NarrativeRole) : undefined
  const plan = typeof raw.plan === 'string' && raw.plan.trim() ? raw.plan.trim().slice(0, 300) : undefined
  return {
    assetId: raw.assetId.trim().slice(0, 80), bodyPlan, limbs,
    symmetry: raw.symmetry === 'asymmetric' || raw.symmetry === 'mixed' ? raw.symmetry : 'symmetric',
    intentional: words(raw.intentional, 30, 120), never: words(raw.never, 30, 120),
    ...(eyes !== undefined ? { eyes } : {}), ...(role ? { role } : {}), ...(plan ? { plan } : {}),
  }
}

export function checkCreatureSpec(spec: CreatureSpec): string | undefined {
  if (!spec.assetId) return 'Choose the being.'
  const names = spec.limbs.map((l) => l.name.toLowerCase())
  if (new Set(names).size !== names.length) return 'Two limbs have the same name. Give each kind of limb one line with its count.'
  const clash = spec.never.find((n) => spec.intentional.some((i) => i.toLowerCase() === n.toLowerCase()))
  if (clash) return `"${clash}" is listed as both intentional and never. Keep it in one list.`
  return undefined
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** The anatomy as plain sentences for a picture prompt: counts stated, deliberate features marked as deliberate, forbidden features named. */
export function anatomyLine(spec: CreatureSpec): string {
  const parts: string[] = [`Body plan: ${spec.bodyPlan}${spec.plan ? ` (${spec.plan})` : ''}.`]
  for (const l of spec.limbs) parts.push(`${plural(l.count, l.name)}${l.digits !== undefined ? `, each with exactly ${plural(l.digits, 'digit')}` : ''}.`)
  if (spec.eyes !== undefined) parts.push(`${plural(spec.eyes, 'eye')}.`)
  if (spec.symmetry !== 'symmetric') parts.push(`The body is ${spec.symmetry}, on purpose.`)
  if (spec.intentional.length) parts.push(`Intentional, not a mistake: ${spec.intentional.join('; ')}.`)
  if (spec.never.length) parts.push(`Never: ${spec.never.join('; ')}.`)
  return parts.join(' ')
}

/** The declared facts a check should hold a picture to. */
export function expectedAnatomy(spec: CreatureSpec): string[] {
  const out = spec.limbs.map((l) => `${plural(l.count, l.name)}${l.digits !== undefined ? ` with ${plural(l.digits, 'digit')} each` : ''}`)
  if (spec.eyes !== undefined) out.push(plural(spec.eyes, 'eye'))
  return [...out, ...spec.intentional]
}

export interface Observed { part: string; count: number; /** For a limb with digits, how many digits it shows. */ digits?: number }
export interface AnatomyFinding { part: string; kind: 'wrong-count' | 'wrong-digits' | 'forbidden-seen'; message: string }

/**
 * Compares what a person (or a measured model) saw with what was declared. A count that matches the declaration is never a finding, however unusual:
 * a deliberate six-fingered hand is intended. A part that is not declared is not judged. Forbidden features seen are always findings.
 */
export function compareAnatomy(spec: CreatureSpec, seen: Observed[], seenFeatures: string[] = []): AnatomyFinding[] {
  const out: AnatomyFinding[] = []
  for (const o of seen) {
    const l = spec.limbs.find((x) => x.name.toLowerCase() === o.part.toLowerCase())
    if (l && o.count !== l.count) out.push({ part: l.name, kind: 'wrong-count', message: `${l.name}: this is meant to have ${l.count} but the picture shows ${o.count}.` })
    if (l && l.digits !== undefined && o.digits !== undefined && o.digits !== l.digits) out.push({ part: l.name, kind: 'wrong-digits', message: `${l.name}: meant to have ${l.digits} digit${l.digits === 1 ? '' : 's'} each (${l.digits === 5 ? 'the usual number' : 'deliberately unusual'}), but the picture shows ${o.digits}.` })
  }
  for (const f of seenFeatures) {
    const bad = spec.never.find((n) => n.toLowerCase() === f.toLowerCase())
    if (bad) out.push({ part: bad, kind: 'forbidden-seen', message: `"${bad}" is on the never list but appears in the picture.` })
  }
  return out
}

/** True when two beings share a body plan and limbs, whatever their story roles. */
export function sameBody(a: CreatureSpec, b: CreatureSpec): boolean {
  const key = (s: CreatureSpec) => JSON.stringify({ p: s.bodyPlan, l: [...s.limbs].sort((x, y) => x.name.localeCompare(y.name)), e: s.eyes ?? null, s: s.symmetry })
  return key(a) === key(b)
}

export function approvedCreature(state: VariationState, assetId: string): { ref: Ref; spec: CreatureSpec } | undefined {
  for (const e of state.entities) {
    if (e.kind !== 'creature' || e.archived) continue
    const rev = latestApproved(e)
    if (rev && (rev.spec as CreatureSpec).assetId === assetId) return { ref: { id: e.id, revision: rev.n }, spec: rev.spec as CreatureSpec }
  }
  return undefined
}

/** Records an anatomy as a candidate; a new version for the same being is a new revision of the same record. */
export function recordCreature(state: VariationState, spec: CreatureSpec, name: string, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const bad = checkCreatureSpec(spec)
  if (bad) return { error: bad }
  const existing = state.entities.find((e) => e.kind === 'creature' && !e.archived && (e.revisions[e.revisions.length - 1].spec as CreatureSpec).assetId === spec.assetId)
  if (existing) {
    const n = existing.revisions.reduce((m, x) => Math.max(m, x.n), 0) + 1
    const updated = { ...existing, revisions: [...existing.revisions, { n, createdAt: now, status: 'candidate' as const, spec: structuredClone(spec), parent: { id: existing.id, revision: n - 1 }, media: [] }] }
    return { state: { ...state, entities: state.entities.map((e) => (e.id === existing.id ? (updated as typeof e) : e)) }, ref: { id: existing.id, revision: n } }
  }
  return createEntity(state, 'creature', { name: `${name} anatomy`, spec, now })
}
