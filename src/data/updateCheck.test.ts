import { beforeEach, describe, expect, it } from 'vitest'
import { autoCheckOn, dueForAutoCheck, markChecked, setAutoCheck, skipVersion, updateSentence, worthShowing, type UpdateInfo } from './updateCheck'

const info = (over: Partial<UpdateInfo> = {}): UpdateInfo => ({ current: '0.61.0', latest: '0.62.0', newer: true, url: 'https://github.com/Olusegune/productionOne/releases', notes: '', ...over })

beforeEach(() => localStorage.clear())

describe('when to look for an update', () => {
  it('is on by default, looks when it never has, and then waits about a day', () => {
    expect(autoCheckOn()).toBe(true)
    expect(dueForAutoCheck(1_000_000)).toBe(true)
    markChecked(1_000_000)
    expect(dueForAutoCheck(1_000_000 + 60_000)).toBe(false)
    expect(dueForAutoCheck(1_000_000 + 21 * 3600 * 1000)).toBe(true)
  })
  it('never looks on its own when the person turned it off, and remembers that', () => {
    setAutoCheck(false)
    expect(autoCheckOn()).toBe(false)
    expect(dueForAutoCheck(Date.now() + 10 * 24 * 3600 * 1000)).toBe(false)
    setAutoCheck(true)
    expect(autoCheckOn()).toBe(true)
  })
})

describe('whether to tell the person', () => {
  it('only for a newer version they have not skipped', () => {
    expect(worthShowing(info())).toBe(true)
    expect(worthShowing(info({ newer: false, latest: '0.61.0' }))).toBe(false)
    skipVersion('0.62.0')
    expect(worthShowing(info())).toBe(false)
    expect(worthShowing(info({ latest: '0.63.0' }))).toBe(true)
  })
  it('says it in one plain sentence', () => {
    expect(updateSentence(info())).toBe('Production One 0.62.0 is available (you have 0.61.0).')
    expect(updateSentence(info({ newer: false, latest: '0.61.0' }))).toBe('You have the latest version (0.61.0).')
  })
})
