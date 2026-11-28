import { createEntity, latestApproved, type MachinePart, type Ref, type VariationState, type VehicleKind, type VehicleSpec } from './variations'
import { approvedRelationships } from './relationships'
import { comparePartViews, parsePartLines, partsToLines, type MachineFinding, type SeenInView } from './machineLab'
import type { BodyMetres } from './fit'

/**
 * Vehicles: cars, trucks, motorbikes, aircraft, spacecraft, boats, trains. A person declares what it must have (seats, size, entrances, features such as
 * wheels or wings, in which views each must be visible); checks compare that with what was seen and with who is recorded as sitting in it. Sizes are what the
 * person states, and the fit against a body is guidance, not measurement. A cutaway of a vehicle is a design reference, like any other (see machineLab.ts).
 */
export const VEHICLE_KINDS: VehicleKind[] = ['car', 'truck', 'motorbike', 'aircraft', 'spacecraft', 'boat', 'train', 'other']
export { parsePartLines, partsToLines }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const metres = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1000 ? v : undefined)
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim().slice(0, 120)).slice(0, 30) : [])

function readParts(raw: unknown): MachinePart[] {
  return (Array.isArray(raw) ? raw : []).flatMap((p) => {
    if (!isObj(p) || typeof p.name !== 'string' || !p.name.trim()) return []
    const count = typeof p.count === 'number' && Number.isInteger(p.count) && p.count >= 1 && p.count <= 1000 ? p.count : 1
    const views = (Array.isArray(p.views) ? p.views : []).filter((v): v is MachinePart['views'][number] => ['front', 'back', 'side', 'top'].includes(v as string))
    const where = typeof p.where === 'string' && p.where.trim() ? p.where.trim().slice(0, 60) : undefined
    return [{ name: p.name.trim().slice(0, 40), count, views: [...new Set(views)], ...(where ? { where } : {}) }]
  }).slice(0, 40)
}

/** Reads a saved vehicle. Unusable settings return undefined and the record is dropped. */
export function readVehicleSpec(raw: unknown): VehicleSpec | undefined {
  if (!isObj(raw) || typeof raw.assetId !== 'string' || !raw.assetId.trim() || !VEHICLE_KINDS.includes(raw.kind as VehicleKind)) return undefined
  const seats = typeof raw.seats === 'number' && Number.isInteger(raw.seats) && raw.seats >= 0 && raw.seats <= 500 ? raw.seats : undefined
  if (seats === undefined) return undefined
  const [lengthM, widthM, heightM, interiorHeightM] = [raw.lengthM, raw.widthM, raw.heightM, raw.interiorHeightM].map(metres)
  const power = typeof raw.powerSource === 'string' && raw.powerSource.trim() ? raw.powerSource.trim().slice(0, 120) : undefined
  return {
    assetId: raw.assetId.trim().slice(0, 80), kind: raw.kind as VehicleKind, seats, entrances: readParts(raw.entrances), features: readParts(raw.features),
    intentional: list(raw.intentional), never: list(raw.never),
    ...(lengthM !== undefined ? { lengthM } : {}), ...(widthM !== undefined ? { widthM } : {}), ...(heightM !== undefined ? { heightM } : {}), ...(interiorHeightM !== undefined ? { interiorHeightM } : {}),
    ...(power ? { powerSource: power } : {}),
  }
}

export function checkVehicleSpec(spec: VehicleSpec): string | undefined {
  if (!spec.assetId) return 'Choose the vehicle.'
  if (!(Number.isInteger(spec.seats) && spec.seats >= 0 && spec.seats <= 500)) return 'Give the number of seats as a whole number, such as 4 (0 if nobody rides in it).'
  for (const [label, v] of [['length', spec.lengthM], ['width', spec.widthM], ['height', spec.heightM], ['interior height', spec.interiorHeightM]] as const) if (v !== undefined && !(v > 0 && v <= 1000)) return `The ${label} must be a number of metres greater than zero.`
  if (spec.interiorHeightM !== undefined && spec.heightM !== undefined && spec.interiorHeightM > spec.heightM) return 'The inside cannot be taller than the whole vehicle.'
  for (const [g, parts] of [['entrances', spec.entrances], ['features', spec.features]] as const) {
    const names = parts.map((p) => p.name.toLowerCase())
    if (new Set(names).size !== names.length) return `Two ${g} have the same name. Give each one line with its count.`
  }
  const clash = spec.never.find((n) => spec.intentional.some((i) => i.toLowerCase() === n.toLowerCase()))
  if (clash) return `"${clash}" is listed as both intentional and never. Keep it in one list.`
  return undefined
}

const r = (n: number) => String(Math.round(n * 100) / 100)
const group = (label: string, parts: MachinePart[]) => (parts.length ? `${label}: ${parts.map((p) => `${p.count} ${p.name}${p.where ? ` (${p.where})` : ''}`).join('; ')}.` : '')

/** The vehicle as plain sentences for a picture prompt. */
export function vehicleLine(spec: VehicleSpec): string {
  const size = [spec.lengthM && `${r(spec.lengthM)} m long`, spec.widthM && `${r(spec.widthM)} m wide`, spec.heightM && `${r(spec.heightM)} m high`].filter(Boolean).join(', ')
  return [
    `Vehicle: ${spec.kind}${size ? `, ${size}` : ''}, ${spec.seats} seat${spec.seats === 1 ? '' : 's'}.`, group('Entrances', spec.entrances), group('Features', spec.features),
    spec.powerSource ? `Power: ${spec.powerSource}.` : '',
    spec.intentional.length ? `Intentional, not a mistake: ${spec.intentional.join('; ')}.` : '', spec.never.length ? `Never: ${spec.never.join('; ')}.` : '',
  ].filter(Boolean).join(' ')
}

/** Declared parts against what was seen in each view that was checked (same rules as machine parts). */
export function compareVehicleViews(spec: VehicleSpec, seen: SeenInView[]): MachineFinding[] {
  return comparePartViews([...spec.entrances, ...spec.features], seen)
}

/** Whether a person can sit upright inside, from their body and the stated inside height. Guidance: seated height is taken as 55% of standing height. */
export function seatedFit(spec: VehicleSpec, body: BodyMetres, personName: string): { ok: boolean; message: string } | undefined {
  if (spec.interiorHeightM === undefined) return undefined
  const seated = body.heightM * 0.55
  if (seated + 0.05 > spec.interiorHeightM) return { ok: false, message: `${personName} would not sit upright inside: seated height is about ${r(seated)} m and the inside is ${r(spec.interiorHeightM)} m high.` }
  return { ok: true, message: `${personName} fits sitting upright (about ${r(seated)} m seated, ${r(spec.interiorHeightM)} m inside).` }
}

/** A sentence stating the vehicle's size against a person, ready for a prompt. Empty when no height or length is stated. */
export function vehicleScaleLine(spec: VehicleSpec, body: BodyMetres, vehicleName: string, personName: string): string {
  const parts = [spec.lengthM && `${r(spec.lengthM)} m long, about ${r(spec.lengthM / body.heightM)} times ${personName}'s height`, spec.heightM && `${r(spec.heightM)} m high, ${spec.heightM > body.heightM ? 'taller than' : 'shorter than'} ${personName}`].filter(Boolean)
  return parts.length ? `${vehicleName} is ${parts.join(' and ')}.` : ''
}

/** More people recorded as sitting in a vehicle than it has seats, per scene (a relationship with no scene counts in every scene). */
export function vehicleOccupancyIssues(state: VariationState, nameOf: (id: string) => string = (id) => id): string[] {
  const rel = approvedRelationships(state).filter((x) => x.spec.relation === 'interaction' && (x.spec.verb === 'sit' || x.spec.verb === 'operate'))
  const out: string[] = []
  for (const e of state.entities) {
    if (e.kind !== 'vehicle' || e.archived) continue
    const rev = latestApproved(e)
    if (!rev) continue
    const spec = rev.spec as VehicleSpec
    const here = rel.filter((x) => x.spec.b.asset === spec.assetId)
    const scenes = [...new Set(here.flatMap((x) => x.spec.sceneIds ?? []))]
    const groups: Array<{ label: string; people: Set<string> }> = scenes.length ? scenes.map((s) => ({ label: ` in scene ${s}`, people: new Set(here.filter((x) => !x.spec.sceneIds?.length || x.spec.sceneIds.includes(s)).map((x) => x.spec.a.asset)) })) : [{ label: '', people: new Set(here.map((x) => x.spec.a.asset)) }]
    for (const g of groups) if (g.people.size > spec.seats) out.push(`${g.people.size} people are recorded as riding in ${nameOf(spec.assetId)}${g.label}, which has ${spec.seats} seat${spec.seats === 1 ? '' : 's'}.`)
  }
  return out
}

export function approvedVehicle(state: VariationState, assetId: string): { ref: Ref; spec: VehicleSpec } | undefined {
  for (const e of state.entities) {
    if (e.kind !== 'vehicle' || e.archived) continue
    const rev = latestApproved(e)
    if (rev && (rev.spec as VehicleSpec).assetId === assetId) return { ref: { id: e.id, revision: rev.n }, spec: rev.spec as VehicleSpec }
  }
  return undefined
}

export function recordVehicle(state: VariationState, spec: VehicleSpec, name: string, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const bad = checkVehicleSpec(spec)
  if (bad) return { error: bad }
  const existing = state.entities.find((e) => e.kind === 'vehicle' && !e.archived && (e.revisions[e.revisions.length - 1].spec as VehicleSpec).assetId === spec.assetId)
  if (existing) {
    const n = existing.revisions.reduce((m, x) => Math.max(m, x.n), 0) + 1
    const updated = { ...existing, revisions: [...existing.revisions, { n, createdAt: now, status: 'candidate' as const, spec: structuredClone(spec), parent: { id: existing.id, revision: n - 1 }, media: [] }] }
    return { state: { ...state, entities: state.entities.map((e) => (e.id === existing.id ? (updated as typeof e) : e)) }, ref: { id: existing.id, revision: n } }
  }
  return createEntity(state, 'vehicle', { name: `${name} vehicle`, spec, now })
}
