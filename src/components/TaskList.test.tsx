import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TaskList } from './TaskList'
import { buildTaskList, groupTasks } from '../domain/taskList'
import { emptyQueue, type ImageJob, type QueueState } from '../domain/generationQueue'
import type { AnalysisResult } from '../domain/productionStudio'

const analysis = {
  scenes: [{ id: 'S1', number: 1, heading: 'EXT. ARENA - DAY', setting: 'ARENA', timeOfDay: 'DAY', body: '', dialogue: [] }],
  assets: [
    { id: 'C1', name: 'MARA', type: 'character', sceneIds: ['S1'], status: 'planned' },
    { id: 'C2', name: 'CASSIUS', type: 'character', sceneIds: ['S1'], status: 'approved' },
    { id: 'P1', name: 'JAR', type: 'prop', sceneIds: ['S1'], status: 'planned' },
    { id: 'S9', name: 'ARENA', type: 'set', sceneIds: ['S1'], status: 'planned' },
  ],
} as unknown as AnalysisResult
const job = (over: Partial<ImageJob>): ImageJob => ({
  id: 'j', key: 'k', assetId: 'C1', variant: 'base', sheetType: 'Turnaround', viewKey: 'front', label: 'Front', prompt: '', aspect: '3:4', fullBody: true, provider: 'kie', model: 'm', references: [], useAnchor: false,
  outputName: 'o', revision: 1, status: 'completed', attempts: 1, maxAttempts: 3, qaNotes: [], approved: false, rejected: false, createdAt: 1, updatedAt: 1, ...over,
})
const q = (jobs: ImageJob[] = []): QueueState => ({ ...emptyQueue(), jobs })
const audit = { ready: false, missingAssets: ['C1', 'P1', 'S9'], incompleteShots: [] as string[] }

describe('task list logic', () => {
  it('gives every role a target, a reason and a group, and leaves no role out', () => {
    const tasks = buildTaskList(analysis, q(), audit, false)
    expect(tasks).toHaveLength(11)
    for (const t of tasks) { expect(t.target.length).toBeGreaterThan(0); expect(t.reason.length).toBeGreaterThan(0); expect(['needs-approval', 'running', 'blocked', 'complete']).toContain(t.group) }
  })
  it('points each task at a real place, naming the first asset that needs work', () => {
    const t = Object.fromEntries(buildTaskList(analysis, q([job({ status: 'needs-review', id: 'r' })]), audit, false).map((x) => [x.role, x]))
    expect(t['character-designer'].action).toMatchObject({ kind: 'asset', assetId: 'C1', label: 'Open MARA' })
    expect(t['character-designer'].reason).toBe('1 without an approved sheet')
    expect(t['prop-designer'].action).toMatchObject({ assetId: 'P1' })
    expect(t['qa-supervisor'].action).toMatchObject({ kind: 'review' })
    expect(t['qa-supervisor'].reason).toMatch(/1 picture waiting/)
    expect(t['delivery-producer'].action).toMatchObject({ kind: 'style' })
    expect(t['delivery-producer'].reason).toBe('The visual style is not locked')
  })
  it('says nothing is waiting when nothing is, and offers no review button', () => {
    const t = Object.fromEntries(buildTaskList(analysis, q(), audit, true).map((x) => [x.role, x]))
    expect(t['qa-supervisor'].action).toBeUndefined()
    expect(t['qa-supervisor'].reason).toBe('Nothing to check')
  })
  it('puts each role where the project really stands, not where a template says', () => {
    const by = (jobs: ImageJob[], a = audit) => Object.fromEntries(buildTaskList(analysis, q(jobs), a, false).map((x) => [x.role, x.group]))
    const none = by([])
    expect(none['costume-designer']).toBe('complete') // no costumes in the script
    expect(none['character-designer']).toBe('running') // a sheet is missing and nothing is waiting
    expect(none['matte-painter']).toBe('blocked') // the sets are not approved yet
    expect(none['qa-supervisor']).toBe('complete')
    const waiting = by([job({ id: 'w', status: 'needs-review', assetId: 'C1' })])
    expect(waiting['character-designer']).toBe('needs-approval')
    expect(waiting['qa-supervisor']).toBe('needs-approval')
    expect(waiting['set-designer']).toBe('running')
    const done = by([], { ready: true, missingAssets: [], incompleteShots: [] })
    expect(done['character-designer']).toBe('complete')
    expect(done['matte-painter']).toBe('running') // the sets are approved, so backgrounds can start
  })
  it('groups in a fixed order and leaves empty groups out', () => {
    const groups = groupTasks(buildTaskList(analysis, q([job({ id: 'w', status: 'needs-review', assetId: 'C1' })]), audit, false))
    expect(groups.map((g) => g.id)).toEqual(expect.arrayContaining(['needs-approval', 'blocked']))
    const order = ['needs-approval', 'running', 'blocked', 'complete']
    expect(groups.map((g) => order.indexOf(g.id))).toEqual([...groups.map((g) => order.indexOf(g.id))].sort((a, b) => a - b))
    expect(groups.every((g) => g.tasks.length > 0)).toBe(true)
  })
})

describe('task list screen', () => {
  it('lists tasks under their group, with a count line, and a button where there is somewhere to go', () => {
    const onAct = vi.fn()
    render(<TaskList analysis={analysis} queue={q([job({ id: 'w', status: 'needs-review', assetId: 'C1' })])} audit={audit} styleLocked={false} onAct={onAct} />)
    expect(screen.getByRole('group', { name: 'Needs approval' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Blocked' })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Open MARA' })[0])
    expect(onAct).toHaveBeenCalledWith(expect.objectContaining({ kind: 'asset', assetId: 'C1' }))
  })
  it('opens the brief, evidence and dependencies for one task at a time, on request', () => {
    render(<TaskList analysis={analysis} queue={q()} audit={audit} styleLocked={false} onAct={() => {}} />)
    expect(screen.queryByRole('region', { name: /details$/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Details for Character designer' }))
    const drawer = screen.getByRole('region', { name: 'Character designer details' })
    expect(within(drawer).getByText('Evidence')).toBeTruthy()
    expect(within(drawer).getByText('Waits on')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Details for Set designer' }))
    expect(screen.queryByRole('region', { name: 'Character designer details' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Set designer details' })).toBeTruthy()
  })
  it('keeps the complete group folded away', () => {
    render(<TaskList analysis={analysis} queue={q()} audit={audit} styleLocked={false} onAct={() => {}} />)
    const complete = document.querySelector('details.tl-group') as HTMLDetailsElement | null
    if (complete) expect(complete.open).toBe(false)
  })
})
