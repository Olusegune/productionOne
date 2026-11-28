import { describe, expect, it } from 'vitest'
import { approveRevision, emptyVariations, addRevision, type PropSpec } from './variations'
import { approvedPropSize, checkPropSpec, propFit, propScaleLine, readPropSpec, recordPropSize } from './propFit'
import { readVariations } from './variationMigration'
import { staleRevisions } from './variationGraph'
import { bodyMetres } from './fit'
import { createProfile } from './proportions'

const body = (heightM: number) => bodyMetres({ ...createProfile('T', 'natural'), heightM } as never)
const spec = (over: Partial<PropSpec> = {}): PropSpec => ({ assetId: 'PROP-001', lengthM: 0.4, gripM: 0.04, grip: 'one-hand', ...over })

describe('prop size and fit against a body', () => {
  it('a mug-sized prop suits a one-hand grip; a door-sized one is too long for one hand', () => {
    expect(propFit(spec(), body(1.75))[0].ok).toBe(true)
    const long = propFit(spec({ lengthM: 2.0, gripM: 0.04 }), body(1.75))
    expect(long[0].ok).toBe(false)
    expect(long[0].message).toMatch(/Too long to hold in one hand/)
  })

  it('a wide prop is too wide for one hand, and says what to do', () => {
    const v = propFit(spec({ lengthM: 0.5, gripM: 0.5 }), body(1.75))
    expect(v.some((x) => /Too wide to hold in one hand.*two hands/.test(x.message))).toBe(true)
  })

  it('the same prop fits a taller body better than a shorter one', () => {
    const p = spec({ lengthM: 1.0, gripM: 0.05 })
    expect(propFit(p, body(2.4))[0].ok).toBe(true)
    expect(propFit(p, body(1.0))[0].ok).toBe(false)
  })

  it('rejects things that cannot be carried or worn', () => {
    expect(propFit(spec({ grip: 'two-hand', lengthM: 5 }), body(1.75))[0].message).toMatch(/Longer than this person is tall/)
    expect(propFit(spec({ grip: 'worn', lengthM: 3 }), body(1.75))[0].message).toMatch(/Too large to be worn/)
  })

  it('states the size against the person in words a picture can use', () => {
    const line = propScaleLine(spec({ lengthM: 0.9 }), body(1.8), 'The staff', 'Mara')
    expect(line).toMatch(/The staff is 0.9 m long, about \d+(\.\d)? hand-lengths of Mara's hand and about 50% of Mara's height/)
  })

  it('refuses nonsense sizes in plain words', () => {
    expect(checkPropSpec(spec({ lengthM: 0 }))).toMatch(/greater than zero/)
    expect(checkPropSpec(spec({ lengthM: 0.1, gripM: 0.5 }))).toMatch(/no longer than the prop/)
    expect(checkPropSpec(spec())).toBeUndefined()
  })
})

describe('prop sizes are records with history', () => {
  it('a new size for the same prop is a new revision, the old one is kept, and only an approved size counts', () => {
    const one = recordPropSize(emptyVariations(), spec(), 'Hammer', 'a')
    if ('error' in one) throw new Error(one.error)
    expect(approvedPropSize(one.state, 'PROP-001')).toBeUndefined()
    const s1 = approveRevision(one.state, one.ref)
    expect(approvedPropSize(s1, 'PROP-001')?.spec.lengthM).toBe(0.4)
    const two = recordPropSize(s1, spec({ lengthM: 0.6 }), 'Hammer', 'b')
    if ('error' in two) throw new Error()
    expect(two.ref).toEqual({ id: one.ref.id, revision: 2 })
    expect(approvedPropSize(two.state, 'PROP-001')?.spec.lengthM).toBe(0.4)
    expect(approvedPropSize(approveRevision(two.state, two.ref), 'PROP-001')?.spec.lengthM).toBe(0.6)
    expect(addRevision).toBeTypeOf('function')
    expect('error' in recordPropSize(s1, spec({ lengthM: -1 }), 'Hammer', 'c')).toBe(true)
  })

  it('survives save and reload, drops damaged sizes, and is not flagged out of date by itself', () => {
    const made = recordPropSize(emptyVariations(), spec({ note: 'x'.repeat(900) }), 'Hammer', 'a')
    if ('error' in made) throw new Error()
    const s = approveRevision(made.state, made.ref)
    const back = readVariations(JSON.parse(JSON.stringify(s)))!
    expect(back.entities).toHaveLength(1)
    expect((back.entities[0].revisions[0].spec as PropSpec).note).toHaveLength(300)
    expect(staleRevisions(s)).toEqual([])
    const raw = JSON.parse(JSON.stringify(s))
    raw.entities.push({ ...raw.entities[0], id: 'PRP-009', revisions: [{ ...raw.entities[0].revisions[0], spec: { assetId: 'P', lengthM: 'long' } }] })
    expect(readVariations(raw)?.entities).toHaveLength(1)
    expect(readPropSpec({ assetId: 'P', lengthM: 1, grip: 'teleport' })?.grip).toBe('none')
  })
})
