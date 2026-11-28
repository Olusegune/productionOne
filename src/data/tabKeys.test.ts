import { describe, expect, it, vi } from 'vitest'
import { nextTab, tabListKeys } from './tabKeys'

const ids = ['sheets', 'wardrobe', 'age', 'voice']

describe('keyboard use of a row of tabs', () => {
  it('Right and Left move one tab and wrap round; Home and End go to the ends', () => {
    expect(nextTab(ids, 'sheets', 'ArrowRight')).toBe('wardrobe')
    expect(nextTab(ids, 'voice', 'ArrowRight')).toBe('sheets')
    expect(nextTab(ids, 'sheets', 'ArrowLeft')).toBe('voice')
    expect(nextTab(ids, 'age', 'ArrowLeft')).toBe('wardrobe')
    expect(nextTab(ids, 'age', 'Home')).toBe('sheets')
    expect(nextTab(ids, 'age', 'End')).toBe('voice')
  })
  it('ignores other keys, an empty list, and a tab that is no longer there (it starts from the first)', () => {
    expect(nextTab(ids, 'age', 'a')).toBeUndefined()
    expect(nextTab(ids, 'age', 'ArrowDown')).toBeUndefined()
    expect(nextTab([], 'x', 'ArrowRight')).toBeUndefined()
    expect(nextTab(ids, 'gone', 'ArrowRight')).toBe('wardrobe')
  })
  it('the handler opens the tab, moves focus to it, and only swallows the keys it uses', () => {
    const open = vi.fn()
    const target = document.createElement('button'); target.id = 'as-tab-wardrobe'; document.body.appendChild(target)
    const handler = tabListKeys(ids, 'sheets', open, (id) => `as-tab-${id}`)
    const used = { key: 'ArrowRight', preventDefault: vi.fn() }
    handler(used as never)
    expect(open).toHaveBeenCalledWith('wardrobe')
    expect(used.preventDefault).toHaveBeenCalled()
    const other = { key: 'Tab', preventDefault: vi.fn() }
    handler(other as never)
    expect(other.preventDefault).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledTimes(1)
    target.remove()
  })
})
