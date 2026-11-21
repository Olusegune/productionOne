/** Calls to the desktop app for Topaz Labs. The key never passes through the page: it is kept in Windows Credential Manager and used by the app. */
export interface TopazBalance { available: number; reserved: number; total: number }
export interface TopazResult { path: string; width: number; height: number; credits: number | null }

export async function topazHasKey(): Promise<boolean> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return false
  try { const { invoke } = await import('@tauri-apps/api/core'); return await invoke<boolean>('credential_status', { provider: 'topaz' }) } catch { return false }
}

export async function topazBalance(): Promise<TopazBalance> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<TopazBalance>('topaz_balance')
}

export async function enhanceWithTopaz(path: string, model: string, scale: number): Promise<TopazResult> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<TopazResult>('topaz_enhance', { path, model, scale })
}
