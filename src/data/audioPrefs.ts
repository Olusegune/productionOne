import { useSyncExternalStore } from 'react'

const KEY = 'po.audio.levelled'
const listeners = new Set<() => void>()

/** Should audition clips be level-matched and trimmed when played? On by default; one switch for every clip on screen. */
export function levelMatchingOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

export function setLevelMatching(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* storage unavailable: the choice lasts until the page reloads */ }
  memory = on
  listeners.forEach((l) => l())
}

let memory: boolean | null = null
const read = () => (memory === null ? levelMatchingOn() : memory)
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export function useLevelMatching(): boolean {
  return useSyncExternalStore(subscribe, read, () => true)
}

/** Test hook: forget the remembered choice. */
export function resetLevelMatching(): void { memory = null; listeners.forEach((l) => l()) }
