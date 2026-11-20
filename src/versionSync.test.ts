import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('the version is the same everywhere it is written', () => {
  const version = (JSON.parse(read('package.json')) as { version: string }).version
  it('is a plain x.y.z', () => expect(version).toMatch(/^\d+\.\d+\.\d+$/))
  it('matches package-lock.json, tauri.conf.json and Cargo.toml', () => {
    const lock = JSON.parse(read('package-lock.json')) as { version: string; packages: Record<string, { version?: string }> }
    expect(lock.version).toBe(version)
    expect(lock.packages[''].version).toBe(version)
    expect((JSON.parse(read('src-tauri/tauri.conf.json')) as { version: string }).version).toBe(version)
    expect(/^version = "([^"]+)"/m.exec(read('src-tauri/Cargo.toml'))?.[1]).toBe(version)
  })
  it('matches the production-guy entry in Cargo.lock and the splash screen', () => {
    expect(new RegExp(`name = "production-guy"\r?\nversion = "${version.replace(/\./g, '\.')}"`).test(read('src-tauri/Cargo.lock'))).toBe(true)
    expect(read('public/splash.html')).toContain(`Version <b>${version}</b>`)
  })
  it('has a changelog entry and release notes for it', () => {
    expect(read('CHANGELOG.md')).toMatch(new RegExp(`^## ${version.replace(/\./g, '\.')} `, 'm'))
    expect(read(`RELEASE_NOTES_${version}.md`)).toContain(version)
  })
})
