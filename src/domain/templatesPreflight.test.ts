import { describe, expect, it } from 'vitest'
import { ABILITY_TEMPLATES, CREATURE_TEMPLATES, CUSTOM, MACHINE_TEMPLATES, templateById } from './templates'
import { checkCreatureSpec, readCreatureSpec } from './creatureLab'
import { checkMachineSpec, readMachineSpec } from './machineLab'
import { checkAbilitySpec, readAbilitySpec, missingStates } from './abilityLab'
import { affectedBy, buildPreflight } from './preflight'
import { approveRevision, createEntity, addRevision, emptyVariations, type AgeSpec, type LookSpec } from './variations'

describe('templates are valid starting points and never role-based', () => {
  it('every creature template passes its own checks and survives being saved and read back', () => {
    for (const t of CREATURE_TEMPLATES) {
      const spec = { assetId: 'A', ...t.fill }
      expect(checkCreatureSpec(spec as never), t.id).toBeUndefined()
      expect(readCreatureSpec(JSON.parse(JSON.stringify(spec)))?.bodyPlan, t.id).toBe(t.fill.bodyPlan)
    }
    expect(CREATURE_TEMPLATES.map((t) => t.id)).not.toContain('hero')
    expect(CREATURE_TEMPLATES.map((t) => t.id)).not.toContain('villain')
  })

  it('every machine template passes its own checks, and its parts keep what views they must appear in', () => {
    for (const t of MACHINE_TEMPLATES) {
      const spec = { assetId: 'A', ...t.fill }
      expect(checkMachineSpec(spec as never), t.id).toBeUndefined()
      expect(readMachineSpec(JSON.parse(JSON.stringify(spec)))?.kind, t.id).toBe(t.fill.kind)
    }
    expect(templateById(MACHINE_TEMPLATES, 'mech')?.fill.panels.map((p) => p.name)).toContain('cockpit hatch')
  })

  it('every power template describes all six states with one visual language, and passes its checks', () => {
    for (const t of ABILITY_TEMPLATES.filter((x) => x.id !== CUSTOM)) {
      const spec = { assetId: 'A', ...t.fill }
      expect(checkAbilitySpec(spec as never), t.id).toBeUndefined()
      expect(missingStates(spec as never), t.id).toEqual([])
      expect(readAbilitySpec(JSON.parse(JSON.stringify(spec))), t.id).toBeTruthy()
    }
  })

  it('"Custom" is first in each list and fills in nothing', () => {
    for (const list of [CREATURE_TEMPLATES, MACHINE_TEMPLATES, ABILITY_TEMPLATES]) expect(list[0].id).toBe(CUSTOM)
    expect(CREATURE_TEMPLATES[0].fill.limbs).toEqual([])
    expect(templateById(CREATURE_TEMPLATES, 'nope')).toBeUndefined()
  })

  it('the serpent template has no legs or arms and says it must never have them', () => {
    const t = templateById(CREATURE_TEMPLATES, 'serpent')!.fill
    expect(t.limbs.map((l) => l.name)).toEqual(['tail'])
    expect(t.never).toEqual(['legs', 'arms'])
  })
})

describe('preflight says what will happen, in plain words, before anything is made', () => {
  it('builds the sentences from the records', () => {
    const p = buildPreflight({ count: 4, what: 'Mara at 65', costLabel: '$0.60', protectedItems: ['her scar', ' '], approvedUntouched: 12, affects: ['Mara, rain-soaked'], uses: ['her approved front view', ''] })
    expect(p.makes).toBe('4 candidate pictures: Mara at 65')
    expect(p.cost).toBe('$0.60')
    expect(p.protectedItems).toEqual(['her scar'])
    expect(p.untouched).toBe('12 approved items stay exactly as they are. New pictures are candidates until you approve them.')
    expect(p.uses).toEqual(['her approved front view'])
    expect(p.deliverables).toEqual(['4 candidate pictures for you to approve or turn down'])
    expect(buildPreflight({ count: 1, what: 'x', costLabel: 'free', protectedItems: [], approvedUntouched: 0, affects: [], uses: [] }).untouched).toBe('New pictures are candidates until you approve them. Nothing approved is changed.')
    expect(buildPreflight({ count: 1, what: 'x', costLabel: 'free', protectedItems: [], approvedUntouched: 1, affects: [], uses: [] }).untouched).toMatch(/^1 approved item stay/)
  })

  it('lists the approved things that depend on a record, and only those', () => {
    const age: AgeSpec = { characterId: 'C', mode: 'same-person', targetAge: '40' }
    const a = createEntity(emptyVariations(), 'age', { name: 'C at 40', characterId: 'C', spec: age, now: 'x' })
    let s = approveRevision(a.state, a.ref)
    const look = (spec: LookSpec, name: string) => { const m = createEntity(s, 'look', { name, characterId: 'C', spec, now: 'x' }); s = m.state; return m.ref }
    const dependent = look({ characterId: 'C', age: a.ref }, 'Look on the age'); s = approveRevision(s, dependent)
    const candidate = look({ characterId: 'C', age: a.ref }, 'Draft look') // a candidate is not an approved thing
    const unrelated = look({ characterId: 'C' }, 'Unrelated'); s = approveRevision(s, unrelated)
    expect(candidate.id).toBeTruthy()
    expect(affectedBy(s, a.ref)).toEqual(['Look on the age'])
    expect(affectedBy(s, undefined)).toEqual([])
    expect(addRevision).toBeTypeOf('function')
  })
})
