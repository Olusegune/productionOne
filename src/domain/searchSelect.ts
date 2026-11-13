export interface SelectOption { value: string; label: string }

/** Case-insensitive match on every typed word, so "fem brit" finds "Female · British". Empty query keeps everything. */
export function filterOptions(options: SelectOption[], query: string): SelectOption[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return options
  return options.filter((o) => { const text = o.label.toLowerCase(); return words.every((w) => text.includes(w)) })
}

/** Move the highlighted row, wrapping at both ends. */
export function moveActive(current: number, delta: number, count: number): number {
  if (count <= 0) return -1
  return (current + delta + count) % count
}
