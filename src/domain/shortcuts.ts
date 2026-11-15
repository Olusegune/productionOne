export const workspaceOrder = ['Projects', 'Story', 'Design', 'Direct', 'Deliver', 'Review'] as const
export type WorkspaceName = (typeof workspaceOrder)[number]

/** Alt+1..6 jumps to a workspace. Anything with Ctrl, Meta or Shift is left to other shortcuts. */
export function workspaceShortcut(e: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): WorkspaceName | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null
  const n = Number(e.key)
  return Number.isInteger(n) && n >= 1 && n <= workspaceOrder.length ? workspaceOrder[n - 1] : null
}

/** Names the steps that became done between two snapshots, so the app can acknowledge them. */
export function newlyDone(before: string[], after: string[]): string[] {
  return after.filter((id) => !before.includes(id))
}
