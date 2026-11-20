/** A short content hash (two 32-bit FNV-1a hashes), enough to show an original has not changed. Not a security hash. */
export function contentHash(bytes: ArrayLike<number>): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ bytes.length
  for (let i = 0; i < bytes.length; i++) { a = Math.imul(a ^ bytes[i], 0x01000193); b = Math.imul(b ^ (bytes[i] + i), 0x85ebca6b) }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`
}
