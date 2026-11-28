import { describe, expect, it } from 'vitest'
import { approveRevision, emptyVariations, type AbilitySpec, type MachineSpec } from './variations'
import { approvedMachine, checkMachineSpec, compareViews, CUTAWAY_LABEL, labelForView, machineLine, parsePartLines, partsToLines, readMachineSpec, recordMachine } from './machineLab'
import { abilityLine, abilityRamp, approvedAbilities, checkAbilitySpec, missingStates, pngHasAlpha, readAbilitySpec, recordAbility, transparencyProblem } from './abilityLab'
import { readVariations } from './variationMigration'
import { staleRevisions } from './variationGraph'

const robot: MachineSpec = {
  assetId: 'CHAR-R1', kind: 'robot', powerSource: 'a sealed core in the chest',
  joints: [{ name: 'elbow', count: 2, views: ['front', 'side'], where: 'arms' }, { name: 'knee', count: 2, views: ['front', 'side'] }],
  sensors: [{ name: 'eye lens', count: 2, views: ['front'], where: 'head' }, { name: 'rear camera', count: 1, views: ['back'] }],
  panels: [{ name: 'chest hatch', count: 1, views: ['front'] }, { name: 'back panel', count: 1, views: ['back', 'side'] }],
  intentional: ['exposed cabling at the neck'], never: ['a mouth'],
}

describe('scenario 6: robot joints, sensors and panels across views', () => {
  it('says the declared parts in a prompt', () => {
    const line = machineLine(robot)
    expect(line).toMatch(/Machine type: robot\./)
    expect(line).toMatch(/Joints: 2 elbow \(arms\); 2 knee\./)
    expect(line).toMatch(/Sensors: 2 eye lens \(head\); 1 rear camera\./)
    expect(line).toMatch(/Access panels: 1 chest hatch; 1 back panel\./)
    expect(line).toMatch(/Power: a sealed core in the chest\./)
    expect(line).toMatch(/Never: a mouth\./)
  })

  it('flags a part missing from a view it must appear in, and an undeclared part, and judges only the views checked', () => {
    const f = compareViews(robot, [{ view: 'front', parts: ['elbow', 'knee', 'eye lens', 'Chest hatch', 'antenna'] }, { view: 'back', parts: ['rear camera'] }])
    expect(f.filter((x) => x.kind === 'missing').map((x) => `${x.view}:${x.part}`)).toEqual(['back:back panel'])
    expect(f.filter((x) => x.kind === 'unexpected').map((x) => x.part)).toEqual(['antenna'])
    expect(f.find((x) => x.part === 'back panel')?.message).toBe('back panel should be visible from the back but was not seen.')
    expect(compareViews(robot, [])).toEqual([])
    expect(compareViews(robot, [{ view: 'front', parts: ['elbow', 'knee', 'eye lens', 'chest hatch'] }])).toEqual([])
  })

  it('labels a cutaway as a design reference, and ordinary views as nothing', () => {
    expect(labelForView('cutaway-torso')).toBe(CUTAWAY_LABEL)
    expect(labelForView('exploded-arm')).toBe(CUTAWAY_LABEL)
    expect(labelForView('full-front')).toBeUndefined()
    expect(CUTAWAY_LABEL).toMatch(/not an engineering diagram/)
  })

  it('refuses duplicates and contradictions in plain words, and keeps history', () => {
    expect(checkMachineSpec({ ...robot, joints: [...robot.joints, { name: 'Elbow', count: 1, views: [] }] })).toMatch(/Two joints have the same name/)
    expect(checkMachineSpec({ ...robot, intentional: ['A mouth'] })).toMatch(/both intentional and never/)
    const one = recordMachine(emptyVariations(), robot, 'R1', 'a')
    if ('error' in one) throw new Error(one.error)
    const s1 = approveRevision(one.state, one.ref)
    const two = recordMachine(s1, { ...robot, powerSource: 'a battery pack' }, 'R1', 'b')
    if ('error' in two) throw new Error()
    expect(two.ref.revision).toBe(2)
    expect(approvedMachine(two.state, 'CHAR-R1')?.spec.powerSource).toBe('a sealed core in the chest')
    expect(staleRevisions(s1)).toEqual([])
  })

  it('survives a reload and drops damaged records', () => {
    const made = recordMachine(emptyVariations(), robot, 'R1', 'a')
    if ('error' in made) throw new Error()
    const s = approveRevision(made.state, made.ref)
    expect(readVariations(JSON.parse(JSON.stringify(s)))?.entities[0].revisions[0].spec).toEqual(robot)
    expect(readMachineSpec({ assetId: 'A', kind: 'toaster' })).toBeUndefined()
    const cleaned = readMachineSpec({ assetId: 'A', kind: 'mech', joints: [{ name: 'hip', count: 0, views: ['front', 'underneath', 'front'] }, { name: '' }, 'x'] })!
    expect(cleaned.joints).toEqual([{ name: 'hip', count: 1, views: ['front'] }])
  })
})

const power: AbilitySpec = { assetId: 'CHAR-VEN', name: 'Venom surge', language: { colour: 'acid green', shape: 'branching veins of light', motion: 'crawling outward' }, states: { activation: 'green light starts under the skin of the forearm', peak: 'veins of light cover the whole body and lift the hair' }, transparency: 'alpha-required' }

describe('scenario 4: a power keeps one visual language across intensity', () => {
  it('uses the same colour and shape words in every active state and only changes the strength', () => {
    for (const state of ['activation', 'controlled', 'peak', 'recovery', 'aftermath'] as const) {
      const line = abilityLine(power, state)
      expect(line).toContain('acid green, branching veins of light, crawling outward')
      expect(line).toContain('never change the colour or the shape')
    }
    expect(abilityLine(power, 'peak')).toMatch(/Strength 5 of 5\. veins of light cover the whole body/)
    expect(abilityLine(power, 'activation')).toMatch(/Strength 2 of 5\./)
    expect(abilityLine(power, 'aftermath')).toMatch(/Strength 1 of 5\./)
  })

  it('inactive shows no effect at all, and the ramp says which states still need a description', () => {
    expect(abilityLine(power, 'inactive')).toMatch(/inactive: no visible effect at all/)
    expect(abilityLine(power, 'inactive')).not.toMatch(/acid green/)
    expect(abilityRamp(power).map((r) => `${r.state}:${r.intensity}:${r.described}`)).toEqual(['inactive:0:false', 'activation:2:true', 'controlled:3:false', 'peak:5:true', 'recovery:2:false', 'aftermath:1:false'])
    expect(missingStates(power)).toEqual(['inactive', 'controlled', 'recovery', 'aftermath'])
  })

  it('refuses a power with no colour, no shape or no state, in plain words', () => {
    expect(checkAbilitySpec({ ...power, language: { colour: '', shape: 'x' } })).toMatch(/colour and its shape/)
    expect(checkAbilitySpec({ ...power, states: {} })).toMatch(/at least one state/)
    expect(checkAbilitySpec({ ...power, name: ' ' })).toMatch(/name/)
    expect(checkAbilitySpec(power)).toBeUndefined()
  })

  it('a second power on the same being is a different record; the same name is a new revision', () => {
    const a = recordAbility(emptyVariations(), power, 'Venomspur', 'a')
    if ('error' in a) throw new Error()
    const b = recordAbility(a.state, { ...power, name: 'Shed skin' }, 'Venomspur', 'b')
    if ('error' in b) throw new Error()
    const c = recordAbility(b.state, { ...power, name: 'venom SURGE', language: { colour: 'blue', shape: 'x' } }, 'Venomspur', 'c')
    if ('error' in c) throw new Error()
    expect(c.state.entities).toHaveLength(2)
    expect(c.ref).toEqual({ id: a.ref.id, revision: 2 })
    let s = approveRevision(c.state, a.ref)
    s = approveRevision(s, b.ref)
    expect(approvedAbilities(s, 'CHAR-VEN').map((x) => x.spec.name).sort()).toEqual(['Shed skin', 'Venom surge'])
    expect(readVariations(JSON.parse(JSON.stringify(s)))?.entities).toHaveLength(2)
    expect(readAbilitySpec({ assetId: 'A', name: 'n', language: { colour: 'c' }, states: {} })).toBeUndefined()
  })
})

describe('no "transparent" label without real alpha', () => {
  const png = (colourType: number, extra: number[][] = []) => {
    const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, colourType, 0, 0, 0, 0, 0, 0, 0]
    const chunks = extra.flat()
    return new Uint8Array([...header, ...chunks, 0, 0, 0, 0, 0x49, 0x44, 0x41, 0x54, 0, 0, 0, 0])
  }
  it('reads alpha from the header, a tRNS chunk, and says false for everything else', () => {
    expect(pngHasAlpha(png(6))).toBe(true)
    expect(pngHasAlpha(png(4))).toBe(true)
    expect(pngHasAlpha(png(2))).toBe(false)
    expect(pngHasAlpha(png(3, [[0, 0, 0, 1, 0x74, 0x52, 0x4e, 0x53, 0, 0, 0, 0, 0]]))).toBe(true)
    expect(pngHasAlpha(new Uint8Array([1, 2, 3]))).toBe(false)
    expect(pngHasAlpha(new Uint8Array(40))).toBe(false)
  })
  it('refuses to call a picture transparent when the power needs real alpha and the file has none', () => {
    expect(transparencyProblem(power, false)).toMatch(/cannot be labelled transparent/)
    expect(transparencyProblem(power, true)).toBeUndefined()
    expect(transparencyProblem({ ...power, transparency: 'none' }, false)).toBeUndefined()
  })
})

describe('editing parts one per line', () => {
  it('reads name, count, views and where, and writes them back the same', () => {
    const r = parsePartLines('elbow x2 @front,side (arms)\nchest hatch @front\nrear camera')
    expect(r.errors).toEqual([])
    expect(r.parts).toEqual([{ name: 'elbow', count: 2, views: ['front', 'side'], where: 'arms' }, { name: 'chest hatch', count: 1, views: ['front'] }, { name: 'rear camera', count: 1, views: [] }])
    expect(parsePartLines(partsToLines(r.parts)).parts).toEqual(r.parts)
  })
  it('reports a line it cannot read instead of dropping it', () => {
    const r = parsePartLines('elbow @underneath\n@front\nknee x0\nhip x2 @top')
    expect(r.errors).toEqual(['"elbow @underneath": "underneath" is not a view. Use front, back, side or top.', '"@front" has no name.', '"knee x0": the count must be between 1 and 100.'])
    expect(r.parts).toEqual([{ name: 'hip', count: 2, views: ['top'] }])
  })
})
