import { describe, expect, it } from 'vitest'
import { newlyDone, workspaceShortcut } from './shortcuts'

const key = (k: string, o: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) => ({ key: k, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, ...o })
describe('shortcuts', () => {
  it('maps Alt+1..6 to workspaces; Review is Alt+6 so the first five keep their meaning', () => {
    expect(workspaceShortcut(key('1'))).toBe('Projects')
    expect(workspaceShortcut(key('3'))).toBe('Design')
    expect(workspaceShortcut(key('5'))).toBe('Deliver')
    expect(workspaceShortcut(key('6'))).toBe('Review')
  })
  it('ignores other keys and combinations', () => {
    expect(workspaceShortcut(key('7'))).toBeNull()
    expect(workspaceShortcut(key('a'))).toBeNull()
    expect(workspaceShortcut(key('1', { altKey: false }))).toBeNull()
    expect(workspaceShortcut(key('1', { ctrlKey: true }))).toBeNull()
  })
  it('reports only steps that just became done', () => {
    expect(newlyDone(['create'], ['create', 'analyze'])).toEqual(['analyze'])
    expect(newlyDone(['create', 'analyze'], ['create'])).toEqual([])
  })
})
