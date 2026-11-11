export type PackageMode = 'draft' | 'verified'

export interface PackageEntry { id: string; revisionId?: string; relativePath: string; sha256?: string; size?: number; approved: boolean; stale?: boolean; required: boolean }
export interface PackageManifestContract { format: 'production-one-package'; schemaVersion: number; mode: PackageMode; status: string; projectId: string; entries: PackageEntry[] }
export interface PackageFile { relativePath: string; sha256: string; size: number }

export function validatePackageContract(manifest: PackageManifestContract, files: PackageFile[]): string[] {
  const errors: string[] = []
  if (manifest.format !== 'production-one-package') errors.push('Unsupported package format.')
  if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) errors.push('Missing or invalid schema version.')
  if (!manifest.projectId) errors.push('Missing immutable project ID.')
  const byPath = new Map(files.map((file) => [file.relativePath, file]))
  const seen = new Set<string>()
  for (const entry of manifest.entries) {
    if (seen.has(entry.id)) errors.push(`Duplicate manifest entry ID: ${entry.id}`)
    seen.add(entry.id)
    if (!entry.relativePath || entry.relativePath.includes('..') || entry.relativePath.startsWith('/')) errors.push(`Non-portable path for ${entry.id}.`)
    const file = byPath.get(entry.relativePath)
    if (entry.required && !file) errors.push(`Missing required file: ${entry.relativePath}`)
    if (file && entry.sha256 && file.sha256 !== entry.sha256) errors.push(`Hash mismatch: ${entry.relativePath}`)
    if (file && entry.size !== undefined && file.size !== entry.size) errors.push(`Size mismatch: ${entry.relativePath}`)
    if (manifest.mode === 'verified' && entry.required && (!entry.approved || entry.stale)) errors.push(`Required entry is not current and approved: ${entry.id}`)
  }
  if (manifest.mode === 'verified' && manifest.status !== 'production-ready') errors.push('Verified package is not marked production-ready.')
  return errors
}
