import { createEntity, findEntity, latestApproved, type BodyPlan, type CreatureSpec, type ProfileSpec, type Ref, type VariationState } from './variations'
import { BODY_PLANS, approvedCreature, recordCreature } from './creatureLab'

/**
 * Species and faction profiles. A profile states what its members have in common (body plan, eyes, symmetry, features that are intentional or forbidden, free
 * traits such as a palette or a dress code). Inheritance runs species, then faction, then the being's own approved record; a being can be exempt from any field.
 *
 * Nothing here ever rewrites an approved record. When a profile and a member's own approved anatomy disagree, the difference is a PROPOSAL: the person accepts it
 * (which makes a new candidate revision of the being's record, for them to approve), keeps their own (which records an exception on the profile), or leaves it.
 */
const FIELDS = ['bodyPlan', 'eyes', 'symmetry', 'intentional', 'never'] as const
export type ProfileField = (typeof FIELDS)[number]

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined)
const strings = (v: unknown, n: number, each: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim().slice(0, each)).slice(0, n) : [])

/** Reads a saved profile. Unusable settings return undefined and the record is dropped. */
export function readProfileSpec(raw: unknown): ProfileSpec | undefined {
  if (!isObj(raw) || (raw.level !== 'species' && raw.level !== 'faction')) return undefined
  const name = text(raw.name, 60)
  if (!name) return undefined
  const members = [...new Set(strings(raw.members, 500, 80))]
  const parent = isObj(raw.parent) && typeof raw.parent.id === 'string' && raw.parent.id && typeof raw.parent.revision === 'number' && Number.isInteger(raw.parent.revision) && raw.parent.revision > 0 ? { id: raw.parent.id, revision: raw.parent.revision } : undefined
  const exceptions: Record<string, ProfileField[]> = {}
  if (isObj(raw.exceptions)) for (const [id, v] of Object.entries(raw.exceptions)) if (members.includes(id) && Array.isArray(v)) { const f = v.filter((x): x is ProfileField => FIELDS.includes(x as ProfileField)); if (f.length) exceptions[id] = [...new Set(f)] }
  const eyes = typeof raw.eyes === 'number' && Number.isInteger(raw.eyes) && raw.eyes >= 0 && raw.eyes <= 100 ? raw.eyes : undefined
  const traits: Record<string, string> = {}
  if (isObj(raw.traits)) for (const [k, v] of Object.entries(raw.traits).slice(0, 20)) { const t = text(v, 200); if (t && k.trim()) traits[k.trim().slice(0, 40)] = t }
  return {
    level: raw.level, name, members, exceptions, traits,
    intentional: strings(raw.intentional, 30, 120), never: strings(raw.never, 30, 120),
    ...(BODY_PLANS.includes(raw.bodyPlan as BodyPlan) ? { bodyPlan: raw.bodyPlan as BodyPlan } : {}),
    ...(eyes !== undefined ? { eyes } : {}),
    ...(raw.symmetry === 'symmetric' || raw.symmetry === 'asymmetric' || raw.symmetry === 'mixed' ? { symmetry: raw.symmetry } : {}),
    ...(parent ? { parent } : {}),
  }
}

export function checkProfileSpec(spec: ProfileSpec): string | undefined {
  if (!spec.name.trim()) return 'Give the profile a name.'
  const clash = spec.never.find((n) => spec.intentional.some((i) => i.toLowerCase() === n.toLowerCase()))
  if (clash) return `"${clash}" is listed as both intentional and never. Keep it in one list.`
  if (spec.level === 'species' && spec.parent) return 'A species does not sit under another profile. Only a faction can be tied to a species.'
  return undefined
}

export interface ProfileView { id: string; name: string; ref: Ref; spec: ProfileSpec; stale: boolean }

/** The newest approved version of each profile. */
export function approvedProfiles(state: VariationState): ProfileView[] {
  const out: ProfileView[] = []
  for (const e of state.entities) {
    if (e.kind !== 'profile' || e.archived) continue
    const r = latestApproved(e)
    if (r) out.push({ id: e.id, name: (r.spec as ProfileSpec).name, ref: { id: e.id, revision: r.n }, spec: r.spec as ProfileSpec, stale: false })
  }
  return out
}

/** The profiles a being belongs to, species first and then factions, each in a stable order. */
export function profilesOf(state: VariationState, assetId: string): ProfileView[] {
  return approvedProfiles(state).filter((p) => p.spec.members.includes(assetId)).sort((a, b) => (a.spec.level === b.spec.level ? a.id.localeCompare(b.id) : a.spec.level === 'species' ? -1 : 1))
}

export interface Effective { field: ProfileField; value: string; from: string }

const show = (spec: ProfileSpec, f: ProfileField): string | undefined => {
  if (f === 'intentional' || f === 'never') return spec[f].length ? spec[f].join('; ') : undefined
  const v = spec[f]
  return v === undefined ? undefined : String(v)
}

/**
 * What a being inherits, field by field, with where it came from. A later profile (faction) overrides an earlier one (species) for single-value fields;
 * the intentional and never lists add up. Fields the being is exempt from are skipped. The being's own approved record is not applied here: it is compared
 * against this list as proposals.
 */
export function inheritedFor(state: VariationState, assetId: string): Effective[] {
  const out = new Map<ProfileField, Effective>()
  for (const p of profilesOf(state, assetId)) {
    const exempt = new Set(p.spec.exceptions[assetId] ?? [])
    for (const f of FIELDS) {
      if (exempt.has(f)) continue
      const v = show(p.spec, f)
      if (v === undefined) continue
      const before = out.get(f)
      if ((f === 'intentional' || f === 'never') && before) out.set(f, { field: f, value: `${before.value}; ${v}`, from: `${before.from} and ${p.spec.level} ${p.spec.name}` })
      else out.set(f, { field: f, value: v, from: `${p.spec.level} ${p.spec.name}` })
    }
  }
  return [...out.values()]
}

export interface Proposal { assetId: string; field: ProfileField; profile: Ref; profileName: string; current: string; proposed: string; message: string }

/** Differences between each member's own approved anatomy and what its profiles say. Lists are additive: a missing entry is proposed, an extra one is left alone. */
export function proposals(state: VariationState): Proposal[] {
  const out: Proposal[] = []
  const seen = new Set<string>()
  for (const prof of approvedProfiles(state)) for (const assetId of prof.spec.members) {
    if (seen.has(assetId)) continue
    seen.add(assetId)
    const own = approvedCreature(state, assetId)?.spec
    if (!own) continue
    for (const p of profilesOf(state, assetId)) {
      const exempt = new Set(p.spec.exceptions[assetId] ?? [])
      const add = (field: ProfileField, current: string, proposed: string, message: string) => out.push({ assetId, field, profile: p.ref, profileName: `${p.spec.level} ${p.spec.name}`, current, proposed, message })
      if (!exempt.has('bodyPlan') && p.spec.bodyPlan && p.spec.bodyPlan !== own.bodyPlan) add('bodyPlan', own.bodyPlan, p.spec.bodyPlan, `${p.spec.level} ${p.spec.name} has a ${p.spec.bodyPlan} body; this being is recorded as ${own.bodyPlan}.`)
      if (!exempt.has('eyes') && p.spec.eyes !== undefined && p.spec.eyes !== own.eyes) add('eyes', own.eyes === undefined ? 'not set' : String(own.eyes), String(p.spec.eyes), `${p.spec.level} ${p.spec.name} has ${p.spec.eyes} eyes; this being is recorded with ${own.eyes === undefined ? 'none stated' : own.eyes}.`)
      if (!exempt.has('symmetry') && p.spec.symmetry && p.spec.symmetry !== own.symmetry) add('symmetry', own.symmetry, p.spec.symmetry, `${p.spec.level} ${p.spec.name} is ${p.spec.symmetry}; this being is ${own.symmetry}.`)
      for (const f of ['intentional', 'never'] as const) {
        if (exempt.has(f)) continue
        const have = new Set(own[f].map((x) => x.toLowerCase()))
        for (const item of p.spec[f]) if (!have.has(item.toLowerCase())) add(f, own[f].join('; ') || 'nothing', item, `${p.spec.level} ${p.spec.name} lists "${item}" as ${f === 'never' ? 'never allowed' : 'intentional'}; this being's record does not.`)
      }
    }
  }
  return out
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Accepts a proposal: a new CANDIDATE revision of the being's record with that one change. It is not approved, and the approved record is untouched. */
export function acceptProposal(state: VariationState, p: Proposal, beingName: string, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const own = approvedCreature(state, p.assetId)?.spec
  if (!own) return { error: 'This being has no approved anatomy to change.' }
  const next: CreatureSpec = structuredClone(own)
  if (p.field === 'bodyPlan') next.bodyPlan = p.proposed as BodyPlan
  else if (p.field === 'eyes') next.eyes = Number(p.proposed)
  else if (p.field === 'symmetry') next.symmetry = p.proposed as CreatureSpec['symmetry']
  else if (!next[p.field].some((x) => same(x, p.proposed))) next[p.field] = [...next[p.field], p.proposed]
  return recordCreature(state, next, beingName, now)
}

/** Keeps a being's own value: a new CANDIDATE revision of the profile that exempts this being from this field. Nothing changes until it is approved. */
export function exemptFrom(state: VariationState, profileId: string, assetId: string, field: ProfileField, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const e = findEntity(state, profileId)
  const rev = e && latestApproved(e)
  if (!e || !rev || e.kind !== 'profile') return { error: 'That profile is not approved.' }
  const spec = structuredClone(rev.spec as ProfileSpec)
  spec.exceptions[assetId] = [...new Set([...(spec.exceptions[assetId] ?? []), field])]
  return addProfileRevision(state, profileId, spec, now, 'Exception recorded: this being keeps its own value.')
}

function addProfileRevision(state: VariationState, id: string, spec: ProfileSpec, now: string, note?: string): { state: VariationState; ref: Ref } {
  const e = findEntity(state, id)!
  const n = e.revisions.reduce((m, x) => Math.max(m, x.n), 0) + 1
  const updated = { ...e, revisions: [...e.revisions, { n, createdAt: now, status: 'candidate' as const, spec, parent: { id, revision: n - 1 }, media: [], ...(note ? { note } : {}) }] }
  return { state: { ...state, entities: state.entities.map((x) => (x.id === id ? (updated as typeof x) : x)) }, ref: { id, revision: n } }
}

/** Makes a new profile, or a new revision when a profile of that level and name exists. */
export function recordProfile(state: VariationState, spec: ProfileSpec, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const bad = checkProfileSpec(spec)
  if (bad) return { error: bad }
  const existing = state.entities.find((e) => e.kind === 'profile' && !e.archived && (e.revisions[e.revisions.length - 1].spec as ProfileSpec).level === spec.level && same((e.revisions[e.revisions.length - 1].spec as ProfileSpec).name, spec.name))
  if (existing) return addProfileRevision(state, existing.id, structuredClone(spec), now)
  return createEntity(state, 'profile', { name: `${spec.level === 'species' ? 'Species' : 'Faction'}: ${spec.name}`, spec, now })
}

/** Adds or removes a being from a profile as a new approved version of the profile (the person asked for it directly). Exceptions of a removed being are dropped. */
export function setMembership(state: VariationState, profileId: string, assetId: string, member: boolean, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const e = findEntity(state, profileId)
  const rev = e && latestApproved(e)
  if (!e || !rev || e.kind !== 'profile') return { error: 'That profile is not approved.' }
  const spec = structuredClone(rev.spec as ProfileSpec)
  const has = spec.members.includes(assetId)
  if (member === has) return { error: member ? 'Already a member.' : 'Not a member.' }
  spec.members = member ? [...spec.members, assetId] : spec.members.filter((x) => x !== assetId)
  if (!member) delete spec.exceptions[assetId]
  const made = addProfileRevision(state, profileId, spec, now, member ? 'Member added.' : 'Member removed.')
  const approved = { ...made.state, entities: made.state.entities.map((x) => (x.id === profileId ? { ...x, revisions: x.revisions.map((r) => (r.n === made.ref.revision ? { ...r, status: 'approved' as const } : r)) } : x)) } as VariationState
  return { state: approved, ref: made.ref }
}
