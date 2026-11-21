/**
 * Looking for a newer version of Production One. The desktop app asks this project's public releases page for the latest version number (nothing about you or your
 * project is sent). It can look once a day when the app starts, which you can switch off, and you can always look yourself. Nothing is downloaded or installed here:
 * "Download" opens the releases page in your browser.
 */
export interface UpdateInfo { current: string; latest: string; newer: boolean; url: string; notes: string }

const AUTO = 'po.update.auto'
const LAST = 'po.update.last'
const SKIPPED = 'po.update.skipped'
const DAY_MS = 20 * 60 * 60 * 1000

const read = (key: string): string | null => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* private window: it asks again next time */ } }

export const autoCheckOn = (): boolean => read(AUTO) !== '0'
export const setAutoCheck = (on: boolean) => write(AUTO, on ? '1' : '0')

/** True when automatic checks are on and the last one was more than about a day ago (or never). */
export function dueForAutoCheck(now = Date.now()): boolean {
  if (!autoCheckOn()) return false
  const last = Number(read(LAST))
  return !Number.isFinite(last) || last <= 0 || now - last >= DAY_MS
}
export const markChecked = (now = Date.now()) => write(LAST, String(now))

export const skipVersion = (version: string) => write(SKIPPED, version)
export const skippedVersion = (): string | null => read(SKIPPED)

/** Whether to put the "new version" bar on screen: only for a newer version the person has not chosen to skip. */
export const worthShowing = (info: UpdateInfo, skipped: string | null = skippedVersion()): boolean => info.newer && info.latest !== skipped

export async function checkForUpdate(): Promise<UpdateInfo> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<UpdateInfo>('check_for_update')
}

export async function openReleasePage(url: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('open_release_page', { url })
}

/** One plain sentence about the result of a check the person asked for. */
export const updateSentence = (info: UpdateInfo): string =>
  info.newer ? `Production One ${info.latest} is available (you have ${info.current}).` : `You have the latest version (${info.current}).`
