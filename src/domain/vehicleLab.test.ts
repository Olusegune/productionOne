import { describe, expect, it } from 'vitest'
import { approveRevision, emptyVariations, type VehicleSpec } from './variations'
import { approvedVehicle, checkVehicleSpec, compareVehicleViews, readVehicleSpec, recordVehicle, seatedFit, vehicleLine, vehicleOccupancyIssues, vehicleScaleLine } from './vehicleLab'
import { addRelationship } from './relationships'
import { VEHICLE_TEMPLATES, CUSTOM } from './templates'
import { readVariations } from './variationMigration'
import { staleRevisions } from './variationGraph'
import { bibleOverview } from './bibleGroups'
import { bodyMetres } from './fit'
import { createProfile } from './proportions'
import { buildViewPrompt } from './sheetSpecs'
import { defaultStyleBible } from './visualDevelopment'
import type { ExtractedAsset } from './productionStudio'

const car: VehicleSpec = { assetId: 'P-CAR', kind: 'car', seats: 2, lengthM: 4.5, widthM: 1.8, heightM: 1.4, interiorHeightM: 1.1, entrances: [{ name: 'door', count: 2, views: ['side'] }], features: [{ name: 'wheel', count: 4, views: ['side'] }, { name: 'headlight', count: 2, views: ['front'] }], powerSource: 'an electric motor', intentional: ['gull-wing doors'], never: ['a roof rack'] }
const body = (h: number) => bodyMetres({ ...createProfile('T', 'natural'), heightM: h } as never)
const nameOf = (id: string) => ({ 'P-CAR': 'the car', 'C1': 'Mara', 'C2': 'Bo', 'C3': 'Cy' } as Record<string, string>)[id] ?? id

function withRiders(n: number, scenes?: string[]) {
  const made = recordVehicle(emptyVariations(), car, 'the car', 'a'); if ('error' in made) throw new Error(made.error)
  let s = approveRevision(made.state, made.ref)
  for (const who of ['C1', 'C2', 'C3'].slice(0, n)) { const r = addRelationship(s, { relation: 'interaction', a: { asset: who }, b: { asset: 'P-CAR' }, verb: 'sit', basis: 'declared', ...(scenes ? { sceneIds: scenes } : {}) }, nameOf, 'x'); if ('error' in r) throw new Error(r.error); s = approveRevision(r.state, r.ref) }
  return s
}

describe('a vehicle is described by what it must have', () => {
  it('says it in plain sentences for a picture prompt', () => {
    const line = vehicleLine(car)
    expect(line).toBe('Vehicle: car, 4.5 m long, 1.8 m wide, 1.4 m high, 2 seats. Entrances: 2 door. Features: 4 wheel; 2 headlight. Power: an electric motor. Intentional, not a mistake: gull-wing doors. Never: a roof rack.')
    expect(vehicleLine({ ...car, seats: 1, lengthM: undefined, widthM: undefined, heightM: undefined })).toMatch(/^Vehicle: car, 1 seat\./)
  })
  it('reaches a picture prompt as a declared design for a prop, not an anatomy', () => {
    const prompt = buildViewPrompt({ style: defaultStyleBible, asset: { id: 'P-CAR', name: 'The car', type: 'prop' } as never, variant: 'Canonical', sheetType: 'Multi-view' as never, view: { key: 'front', label: 'Front', aspect: '3:2', fullBody: false } as never, anatomy: vehicleLine(car) } as never)
    expect(prompt).toMatch(/Declared design \(exact, keep it the same in every picture\): Vehicle: car/)
    expect(prompt).not.toMatch(/Declared anatomy/)
  })
  it('flags a declared part missing from a view and an undeclared one, judging only the views checked', () => {
    const f = compareVehicleViews(car, [{ view: 'side', parts: ['door', 'wheel', 'spoiler'] }, { view: 'front', parts: ['headlight'] }])
    expect(f.map((x) => `${x.kind}:${x.part}`)).toEqual(['unexpected:spoiler'])
    expect(compareVehicleViews(car, [{ view: 'side', parts: ['door'] }])[0].message).toBe('wheel should be visible from the side but was not seen.')
    expect(compareVehicleViews(car, [])).toEqual([])
  })
  it('refuses nonsense in plain words', () => {
    expect(checkVehicleSpec({ ...car, seats: -1 })).toMatch(/whole number/)
    expect(checkVehicleSpec({ ...car, seats: 2.5 })).toMatch(/whole number/)
    expect(checkVehicleSpec({ ...car, lengthM: 0 })).toMatch(/length must be a number of metres greater than zero/)
    expect(checkVehicleSpec({ ...car, interiorHeightM: 2 })).toMatch(/inside cannot be taller/)
    expect(checkVehicleSpec({ ...car, features: [...car.features, { name: 'Wheel', count: 1, views: [] }] })).toMatch(/Two features have the same name/)
    expect(checkVehicleSpec({ ...car, intentional: ['A roof rack'] })).toMatch(/both intentional and never/)
    expect(checkVehicleSpec(car)).toBeUndefined()
  })
  it('every template passes its own checks and survives a save', () => {
    for (const t of VEHICLE_TEMPLATES) { const spec = { assetId: 'A', ...t.fill }; expect(checkVehicleSpec(spec as never), t.id).toBeUndefined(); expect(readVehicleSpec(JSON.parse(JSON.stringify(spec)))?.kind, t.id).toBe(t.fill.kind) }
    expect(VEHICLE_TEMPLATES[0].id).toBe(CUSTOM)
  })
})

describe('people and a vehicle', () => {
  it('a tall person does not sit upright in a low car, a short one does; guidance only', () => {
    expect(seatedFit(car, body(2.2), 'Bo')?.ok).toBe(false)
    expect(seatedFit(car, body(2.2), 'Bo')?.message).toMatch(/Bo would not sit upright inside/)
    expect(seatedFit(car, body(1.6), 'Mara')?.ok).toBe(true)
    expect(seatedFit({ ...car, interiorHeightM: undefined }, body(2.2), 'Bo')).toBeUndefined()
  })
  it('states the size against a person', () => {
    expect(vehicleScaleLine(car, body(1.8), 'The car', 'Mara')).toBe('The car is 4.5 m long, about 2.5 times Mara\'s height and 1.4 m high, shorter than Mara.')
    expect(vehicleScaleLine({ ...car, lengthM: undefined, heightM: undefined }, body(1.8), 'The car', 'Mara')).toBe('')
  })
  it('more riders than seats is reported (also in the bible overview); within the seats is not', () => {
    expect(vehicleOccupancyIssues(withRiders(2), nameOf)).toEqual([])
    const over = withRiders(3)
    expect(vehicleOccupancyIssues(over, nameOf)).toEqual(['3 people are recorded as riding in the car, which has 2 seats.'])
    const assets = [{ id: 'P-CAR', name: 'the car', type: 'prop', status: 'approved', sceneIds: [] }] as ExtractedAsset[]
    expect(bibleOverview({ assets, variations: over }).relationships.conflicts).toContain('3 people are recorded as riding in the car, which has 2 seats.')
  })
  it('counts riders per scene: three people in different scenes are not three in one car', () => {
    const made = recordVehicle(emptyVariations(), car, 'the car', 'a'); if ('error' in made) throw new Error()
    let s = approveRevision(made.state, made.ref)
    for (const [who, scene] of [['C1', 'SC-1'], ['C2', 'SC-2'], ['C3', 'SC-3']] as const) { const r = addRelationship(s, { relation: 'interaction', a: { asset: who }, b: { asset: 'P-CAR' }, verb: 'sit', basis: 'declared', sceneIds: [scene] }, nameOf, 'x'); if ('error' in r) throw new Error(r.error); s = approveRevision(r.state, r.ref) }
    expect(vehicleOccupancyIssues(s, nameOf)).toEqual([])
  })
})

describe('records with history, and damaged files', () => {
  it('a new version is a new revision and only an approved one counts', () => {
    const one = recordVehicle(emptyVariations(), car, 'the car', 'a'); if ('error' in one) throw new Error()
    expect(approvedVehicle(one.state, 'P-CAR')).toBeUndefined()
    const s1 = approveRevision(one.state, one.ref)
    const two = recordVehicle(s1, { ...car, seats: 5 }, 'the car', 'b'); if ('error' in two) throw new Error()
    expect(two.ref.revision).toBe(2)
    expect(approvedVehicle(two.state, 'P-CAR')?.spec.seats).toBe(2)
    expect(staleRevisions(s1)).toEqual([])
    expect('error' in recordVehicle(s1, { ...car, seats: -3 }, 'x', 'c')).toBe(true)
  })
  it('survives a reload, and drops unreadable settings', () => {
    const made = recordVehicle(emptyVariations(), car, 'the car', 'a'); if ('error' in made) throw new Error()
    const s = approveRevision(made.state, made.ref)
    expect(readVariations(JSON.parse(JSON.stringify(s)))?.entities[0].revisions[0].spec).toEqual(car)
    expect(readVehicleSpec({ assetId: 'A', kind: 'unicycle', seats: 1 })).toBeUndefined()
    expect(readVehicleSpec({ assetId: 'A', kind: 'car', seats: 'many' })).toBeUndefined()
    expect(readVehicleSpec({ assetId: 'A', kind: 'car', seats: 2, lengthM: -4, widthM: 'wide', features: [{ name: '' }, 'x', { name: 'wheel', count: 0, views: ['front', 'under'] }] })).toEqual({ assetId: 'A', kind: 'car', seats: 2, entrances: [], features: [{ name: 'wheel', count: 1, views: ['front'] }], intentional: [], never: [] })
  })
})
