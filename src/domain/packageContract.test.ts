import { describe, expect, it } from 'vitest'
import { validatePackageContract, type PackageManifestContract } from './packageContract'

const base: PackageManifestContract = { format: 'production-one-package', schemaVersion: 1, mode: 'verified', status: 'production-ready', projectId: 'P1', entries: [{ id: 'A1', relativePath: 'Approved References/a.png', sha256: 'abc', size: 4, approved: true, required: true }] }
describe('package contract', () => {
  it('validates hashes, sizes, paths, approvals and stale state', () => {
    expect(validatePackageContract(base, [{ relativePath: 'Approved References/a.png', sha256: 'abc', size: 4 }])).toEqual([])
    expect(validatePackageContract(base, [{ relativePath: 'Approved References/a.png', sha256: 'wrong', size: 3 }])).toHaveLength(2)
    expect(validatePackageContract({ ...base, entries: [{ ...base.entries[0], stale: true }] }, [{ relativePath: 'Approved References/a.png', sha256: 'abc', size: 4 }])[0]).toMatch(/current and approved/)
  })
})
