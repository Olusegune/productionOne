import { describe, expect, it } from 'vitest'
import { hasWork, needsBackup } from './projectSafety'
import { emptyQueue, enqueue } from './generationQueue'

const empty = { script: '', analysis: { scenes: [], assets: [] }, queue: emptyQueue() }

describe('hasWork', () => {
  it('is false for an empty production', () => expect(hasWork(empty)).toBe(false))
  it('is true for a script, an asset or a generated image', () => {
    expect(hasWork({ ...empty, script: 'INT. ROOM' })).toBe(true)
    expect(hasWork({ ...empty, analysis: { scenes: [], assets: [{ id: 'A', name: 'A', type: 'character', sceneIds: [], status: 'planned' }] } })).toBe(true)
    const queue = enqueue(emptyQueue(), [{ assetId: 'A', variant: 'Canonical', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: 'p', aspect: '3:4', fullBody: true, provider: 'google', model: 'm', references: [], outputName: () => 'x' }], 1).state
    expect(hasWork({ ...empty, queue })).toBe(true)
  })
  it('ignores a script of only spaces', () => expect(hasWork({ ...empty, script: '  \n ' })).toBe(false))
})

describe('needsBackup', () => {
  it('never backs up an empty production', () => expect(needsBackup({ hasWork: false, filePath: null, dirty: true })).toBe(false))
  it('backs up work that only lives in the autosave', () => expect(needsBackup({ hasWork: true, filePath: null, dirty: false })).toBe(true))
  it('backs up unsaved edits to a saved file', () => expect(needsBackup({ hasWork: true, filePath: 'C:/a.pone', dirty: true })).toBe(true))
  it('skips a production that is safely saved', () => expect(needsBackup({ hasWork: true, filePath: 'C:/a.pone', dirty: false })).toBe(false))
})
