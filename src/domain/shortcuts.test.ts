import { describe, expect, it } from 'vitest'
import { newlyDone, workspaceShortcut } from './shortcuts'

const key = (k: string, o: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) => ({ key: k, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, ...o })
describe('shortcuts', () => {
  it('maps Alt+1..5 to workspaces', () => {
    expect(workspaceShortcut(key('1'))).toBe('Projects')
    expect(workspaceShortcut(key('3'))).toBe('Design')
    expect(workspaceShortcut(key('5'))).toBe('Deliver')
  })
  it('ignores other keys and combinations', () => {
    expect(workspaceShortcut(key('6'))).toBeNull()
    expect(workspaceShortcut(key('a'))).toBeNull()
    expect(workspaceShortcut(key('1', { altKey: false }))).toBeNull()
    expect(workspaceShortcut(key('1', { ctrlKey: true }))).toBeNull()
  })
  it('reports only steps that just became done', () => {
    expect(newlyDone(['create'], ['create', 'analyze'])).toEqual(['analyze'])
    expect(newlyDone(['create', 'analyze'], ['create'])).toEqual([])
  })
})
