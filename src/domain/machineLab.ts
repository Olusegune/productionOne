import { createEntity, latestApproved, type MachineSpec, type MachinePart, type PartView, type Ref, type VariationState } from './variations'

/**
 * Robots, androids, mechs and powered armour. A person declares the parts that must be there (joints, sensors, panels) and in which views each must be
 * visible; checks compare what was seen in each view with that list. Nothing here looks at a picture: what was seen comes from a person (or a measured model).
 *
 * A cutaway or exploded view is a DESIGN REFERENCE, drawn by an image model to show intent. It is not an engineering drawing, it does not prove the parts
 * would work, and it is labelled that way wherever it appears.
 */
export const MACHINE_KINDS = ['robot', 'android', 'mech', 'powered-armor'] as const
export const PART_VIEWS: PartView[] = ['front', 'back', 'side', 'top']
export const PART_GROUPS = ['joints', 'sensors', 'panels'] as const
export type PartGroup = (typeof PART_GROUPS)[number]

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined)

function readParts(raw: unknown): MachinePart[] {
  return (Array.isArray(raw) ? raw : []).flatMap((p) => {
    if (!isObj(p)) return []
    const name = text(p.name, 40)
    if (!name) return []
    const count = typeof p.count === 'number' && Number.isInteger(p.count) && p.count >= 1 && p.count <= 100 ? p.count : 1
    const views = (Array.isArray(p.views) ? p.views : []).filter((v): v is PartView => PART_VIEWS.includes(v as PartView))
    const where = text(p.where, 60)
    return [{ name, count, views: [...new Set(views)], ...(where ? { where } : {}) }]
  }).slice(0, 40)
}

/** Reads a saved machine record. Unusable settings return undefined and the record is dropped. */
export function readMachineSpec(raw: unknown): MachineSpec | undefined {
  if (!isObj(raw) || typeof raw.assetId !== 'string' || !raw.assetId.trim()) return undefined
  if (!MACHINE_KINDS.includes(raw.kind as never)) return undefined
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim().slice(0, 120)).slice(0, 30) : [])
  const power = text(raw.powerSource, 120)
  return { assetId: raw.assetId.trim().slice(0, 80), kind: raw.kind as MachineSpec['kind'], joints: readParts(raw.joints), sensors: readParts(raw.sensors), panels: readParts(raw.panels), intentional: list(raw.intentional), never: list(raw.never), ...(power ? { powerSource: power } : {}) }
}

export function checkMachineSpec(spec: MachineSpec): string | undefined {
  if (!spec.assetId) return 'Choose the machine.'
  for (const g of PART_GROUPS) {
    const names = spec[g].map((p) => p.name.toLowerCase())
    if (new Set(names).size !== names.length) return `Two ${g} have the same name. Give each one line with its count.`
  }
  const clash = spec.never.find((n) => spec.intentional.some((i) => i.toLowerCase() === n.toLowerCase()))
  if (clash) return `"${clash}" is listed as both intentional and never. Keep it in one list.`
  return undefined
}

const plural = (n: number, w: string) => `${n} ${w}`

/** The declared parts as plain sentences for a picture prompt. */
export function machineLine(spec: MachineSpec): string {
  const group = (label: string, parts: MachinePart[]) => (parts.length ? `${label}: ${parts.map((p) => `${plural(p.count, p.name)}${p.where ? ` (${p.where})` : ''}`).join('; ')}.` : '')
  return [
    `Machine type: ${spec.kind.replace('-', ' ')}.`, group('Joints', spec.joints), group('Sensors', spec.sensors), group('Access panels', spec.panels),
    spec.powerSource ? `Power: ${spec.powerSource}.` : '',
    spec.intentional.length ? `Intentional, not a mistake: ${spec.intentional.join('; ')}.` : '',
    spec.never.length ? `Never: ${spec.never.join('; ')}.` : '',
  ].filter(Boolean).join(' ')
}

export interface SeenInView { view: PartView; /** The names of the parts a person (or a measured model) could see in that picture. */ parts: string[] }
export interface MachineFinding { view: PartView; part: string; kind: 'missing' | 'unexpected'; message: string }

/**
 * For each view that was checked: a declared part that should be visible there but was not seen is "missing"; a part seen that was never declared is
 * "unexpected". Views nobody checked are not judged.
 */
export function compareViews(spec: MachineSpec, seen: SeenInView[]): MachineFinding[] {
  const out: MachineFinding[] = []
  const all = [...spec.joints, ...spec.sensors, ...spec.panels]
  for (const s of seen) {
    const have = new Set(s.parts.map((p) => p.toLowerCase()))
    for (const p of all) if (p.views.includes(s.view) && !have.has(p.name.toLowerCase())) out.push({ view: s.view, part: p.name, kind: 'missing', message: `${p.name} should be visible from the ${s.view} but was not seen.` })
    const declared = new Set(all.map((p) => p.name.toLowerCase()))
    for (const name of s.parts) if (!declared.has(name.toLowerCase())) out.push({ view: s.view, part: name, kind: 'unexpected', message: `${name} appears in the ${s.view} view but is not in the declared parts. Add it if it is meant to be there.` })
  }
  return out
}

/** The label that goes on a cutaway or exploded view wherever it is shown. */
export const CUTAWAY_LABEL = 'Design reference, not an engineering diagram: it shows intent and does not prove the parts would work.'
export const isCutawayView = (viewKey: string) => /cutaway|exploded|x-?ray|internals?/i.test(viewKey)
export const labelForView = (viewKey: string): string | undefined => (isCutawayView(viewKey) ? CUTAWAY_LABEL : undefined)

export function approvedMachine(state: VariationState, assetId: string): { ref: Ref; spec: MachineSpec } | undefined {
  for (const e of state.entities) {
    if (e.kind !== 'machine' || e.archived) continue
    const rev = latestApproved(e)
    if (rev && (rev.spec as MachineSpec).assetId === assetId) return { ref: { id: e.id, revision: rev.n }, spec: rev.spec as MachineSpec }
  }
  return undefined
}

export function recordMachine(state: VariationState, spec: MachineSpec, name: string, now: string): { state: VariationState; ref: Ref } | { error: string } {
  const bad = checkMachineSpec(spec)
  if (bad) return { error: bad }
  const existing = state.entities.find((e) => e.kind === 'machine' && !e.archived && (e.revisions[e.revisions.length - 1].spec as MachineSpec).assetId === spec.assetId)
  if (existing) {
    const n = existing.revisions.reduce((m, x) => Math.max(m, x.n), 0) + 1
    const updated = { ...existing, revisions: [...existing.revisions, { n, createdAt: now, status: 'candidate' as const, spec: structuredClone(spec), parent: { id: existing.id, revision: n - 1 }, media: [] }] }
    return { state: { ...state, entities: state.entities.map((e) => (e.id === existing.id ? (updated as typeof e) : e)) }, ref: { id: existing.id, revision: n } }
  }
  return createEntity(state, 'machine', { name: `${name} machine`, spec, now })
}

/**
 * Parts are edited one per line: `name x2 @front,side (where)`. Only the name is required; the count defaults to 1 and the views to none.
 * Lines that cannot be read are returned as errors so nothing is silently dropped.
 */
export function parsePartLines(textBlock: string): { parts: MachinePart[]; errors: string[] } {
  const parts: MachinePart[] = []
  const errors: string[] = []
  for (const raw of textBlock.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const where = /\(([^)]*)\)\s*$/.exec(raw)
    const noWhere = where ? raw.slice(0, where.index).trim() : raw
    const at = noWhere.indexOf('@')
    const viewsText = at >= 0 ? noWhere.slice(at + 1) : ''
    const head = (at >= 0 ? noWhere.slice(0, at) : noWhere).trim()
    const m = /^(.*?)(?:\s+x\s*(\d+))?$/i.exec(head)
    const name = (m?.[1] ?? '').trim()
    if (!name) { errors.push(`"${raw}" has no name.`); continue }
    const views = viewsText.split(/[,\s]+/).filter(Boolean)
    const bad = views.find((v) => !PART_VIEWS.includes(v as PartView))
    if (bad) { errors.push(`"${raw}": "${bad}" is not a view. Use front, back, side or top.`); continue }
    const count = m?.[2] ? Number(m[2]) : 1
    if (count < 1 || count > 100) { errors.push(`"${raw}": the count must be between 1 and 100.`); continue }
    parts.push({ name: name.slice(0, 40), count, views: [...new Set(views as PartView[])], ...(where?.[1].trim() ? { where: where[1].trim().slice(0, 60) } : {}) })
  }
  return { parts, errors }
}

export const partsToLines = (parts: MachinePart[]): string => parts.map((p) => `${p.name}${p.count > 1 ? ` x${p.count}` : ''}${p.views.length ? ` @${p.views.join(',')}` : ''}${p.where ? ` (${p.where})` : ''}`).join('\n')
