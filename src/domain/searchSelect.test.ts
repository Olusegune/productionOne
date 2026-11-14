import { describe, expect, it } from 'vitest'
import { filterOptions, moveActive } from './searchSelect'

const opts = [{ value: 'a', label: 'Aria · Female · British' }, { value: 'b', label: 'Bruno · Male · American' }, { value: 'c', label: 'Cleo · Female · American' }]
describe('searchable select', () => {
  it('keeps everything for an empty query', () => expect(filterOptions(opts, '  ')).toHaveLength(3))
  it('matches every typed word in any order, ignoring case', () => {
    expect(filterOptions(opts, 'fem AMER').map((o) => o.value)).toEqual(['c'])
    expect(filterOptions(opts, 'british female').map((o) => o.value)).toEqual(['a'])
    expect(filterOptions(opts, 'zzz')).toEqual([])
  })
  it('wraps the highlight and survives an empty list', () => {
    expect(moveActive(2, 1, 3)).toBe(0)
    expect(moveActive(0, -1, 3)).toBe(2)
    expect(moveActive(0, 1, 0)).toBe(-1)
  })
})
