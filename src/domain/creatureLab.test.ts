import { describe, expect, it } from 'vitest'
import { approveRevision, emptyVariations, type CreatureSpec } from './variations'
import { anatomyLine, approvedCreature, checkCreatureSpec, compareAnatomy, expectedAnatomy, readCreatureSpec, recordCreature, sameBody } from './creatureLab'
import { readVariations } from './variationMigration'
import { staleRevisions } from './variationGraph'

const venomspur: CreatureSpec = { assetId: 'CHAR-VEN', bodyPlan: 'serpentine', plan: 'long coiled body, upright forebody', limbs: [{ name: 'arm', count: 4, digits: 6 }, { name: 'tail', count: 1 }], eyes: 3, symmetry: 'symmetric', intentional: ['six fingers on each hand', 'a third eye in the forehead'], never: ['wings', 'human ears'], role: 'villain' }

describe('scenario 1: a nonhumanoid creature is described by its own fields', () => {
  it('keeps a serpentine, four-armed, three-eyed being with no legs, and says it in a prompt', () => {
    const line = anatomyLine(venomspur)
    expect(line).toMatch(/Body plan: serpentine \(long coiled body, upright forebody\)\./)
    expect(line).toMatch(/4 arms, each with exactly 6 digits\./)
    expect(line).toMatch(/1 tail\./)
    expect(line).toMatch(/3 eyes\./)
    expect(line).toMatch(/Intentional, not a mistake: six fingers on each hand; a third eye in the forehead\./)
    expect(line).toMatch(/Never: wings; human ears\./)
    expect(line).not.toMatch(/legs/)
    expect(expectedAnatomy(venomspur)).toContain('4 arms with 6 digits each')
  })

  it('refuses a clash between intentional and never, and two lines for one limb', () => {
    expect(checkCreatureSpec({ ...venomspur, never: ['A third eye in the forehead'].concat(), intentional: ['a third eye in the forehead'] })).toMatch(/both intentional and never/)
    expect(checkCreatureSpec({ ...venomspur, limbs: [{ name: 'arm', count: 2 }, { name: 'Arm', count: 4 }] })).toMatch(/same name/)
    expect(checkCreatureSpec(venomspur)).toBeUndefined()
  })
})

describe('scenario 2: six fingers are intended or a mistake depending on what was declared', () => {
  it('six digits on a hand declared to have six is not a finding; six on a hand declared to have five is', () => {
    expect(compareAnatomy(venomspur, [{ part: 'arm', count: 4, digits: 6 }])).toEqual([])
    const human: CreatureSpec = { assetId: 'CHAR-MARA', bodyPlan: 'humanoid', limbs: [{ name: 'arm', count: 2, digits: 5 }, { name: 'leg', count: 2 }], symmetry: 'symmetric', intentional: [], never: [] }
    const f = compareAnatomy(human, [{ part: 'arm', count: 2, digits: 6 }])
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ kind: 'wrong-digits' })
    expect(f[0].message).toMatch(/meant to have 5 digits each \(the usual number\), but the picture shows 6/)
  })

  it('a wrong limb count is reported, an undeclared part is not judged, and a forbidden feature is always reported', () => {
    expect(compareAnatomy(venomspur, [{ part: 'arm', count: 2 }])[0]).toMatchObject({ kind: 'wrong-count', message: 'arm: this is meant to have 4 but the picture shows 2.' })
    expect(compareAnatomy(venomspur, [{ part: 'wing', count: 2 }])).toEqual([])
    expect(compareAnatomy(venomspur, [], ['Wings'])[0]).toMatchObject({ kind: 'forbidden-seen' })
  })
})

describe('scenario 3: hero and villain are story roles, not bodies', () => {
  it('the same body can be a hero in one record and a villain in another', () => {
    const hero = { ...venomspur, assetId: 'CHAR-KAI', role: 'hero' as const }
    expect(sameBody(venomspur, hero)).toBe(true)
    expect(sameBody(venomspur, { ...hero, limbs: [{ name: 'arm', count: 2, digits: 5 }] })).toBe(false)
    expect(anatomyLine(hero)).toBe(anatomyLine(venomspur))
    expect(anatomyLine(hero)).not.toMatch(/hero|villain/i)
  })
})

describe('records with history, and older or damaged files', () => {
  it('a new anatomy for the same being is a new revision; only an approved one counts; nothing else is flagged', () => {
    const one = recordCreature(emptyVariations(), venomspur, 'Venomspur', 'a')
    if ('error' in one) throw new Error(one.error)
    expect(approvedCreature(one.state, 'CHAR-VEN')).toBeUndefined()
    const s1 = approveRevision(one.state, one.ref)
    const two = recordCreature(s1, { ...venomspur, eyes: 2 }, 'Venomspur', 'b')
    if ('error' in two) throw new Error()
    expect(two.ref.revision).toBe(2)
    expect(approvedCreature(two.state, 'CHAR-VEN')?.spec.eyes).toBe(3)
    expect(staleRevisions(s1)).toEqual([])
    expect('error' in recordCreature(s1, { ...venomspur, never: ['x'], intentional: ['X'] }, 'V', 'c')).toBe(true)
  })

  it('survives save and reload; drops a record with an unknown body plan or no asset; cleans and caps the lists', () => {
    const made = recordCreature(emptyVariations(), venomspur, 'Venomspur', 'a')
    if ('error' in made) throw new Error()
    const s = approveRevision(made.state, made.ref)
    expect(readVariations(JSON.parse(JSON.stringify(s)))?.entities).toHaveLength(1)
    expect(readCreatureSpec({ assetId: 'A', bodyPlan: 'dragon' })).toBeUndefined()
    expect(readCreatureSpec({ bodyPlan: 'humanoid' })).toBeUndefined()
    const cleaned = readCreatureSpec({ assetId: 'A', bodyPlan: 'humanoid', limbs: [{ name: 'arm', count: -1 }, { name: 'leg', count: 2.5 }, { name: 'ok', count: 2 }, 'x'], intentional: Array(60).fill('y'.repeat(500)), never: [1, 'z'], role: 'boss', symmetry: 'weird' })!
    expect(cleaned.limbs).toEqual([{ name: 'ok', count: 2 }])
    expect(cleaned.intentional).toHaveLength(30)
    expect(cleaned.intentional[0]).toHaveLength(120)
    expect(cleaned.never).toEqual(['z'])
    expect(cleaned.role).toBeUndefined()
    expect(cleaned.symmetry).toBe('symmetric')
  })
})
