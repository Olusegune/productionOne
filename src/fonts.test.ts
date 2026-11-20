import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('fonts are bundled, so the app looks the same offline', () => {
  it('Geist (text and headings), Geist Mono and Inter are installed and loaded at start-up', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
    for (const name of ['@fontsource-variable/inter', '@fontsource-variable/geist', '@fontsource-variable/geist-mono', '@fontsource/courier-prime']) {
      expect(pkg.dependencies[name], name).toBeTruthy()
      expect(existsSync(resolve(process.cwd(), 'node_modules', name)), `${name} is installed`).toBe(true)
    }
    const main = read('src/main.tsx')
    expect(main).toContain("@fontsource-variable/inter/opsz.css")
    expect(main).toContain("@fontsource-variable/geist/index.css")
    expect(main).toContain("@fontsource-variable/geist-mono/index.css")
    expect(main.indexOf("./looks.css")).toBeGreaterThan(main.indexOf("./polish.css")) // the looks load before the refinement
    expect(main.indexOf("./refine.css")).toBeGreaterThan(main.indexOf("./sleek.css")) // the refinement loads last so it wins
  })
  it('text and headings use Geist, with Inter and the system font as fallbacks, and numbers get a mono face', () => {
    const refine = read('src/refine.css')
    expect(/--ui:\s*"Geist Variable",\s*"Inter Variable"/.test(refine)).toBe(true)
    expect(/--display:\s*var\(--ui\)/.test(refine)).toBe(true)
    expect(/--mono:\s*"Geist Mono Variable"/.test(refine)).toBe(true)
    expect(refine).not.toMatch(/Fraunces|Georgia|Space Grotesk/)
  })
  it('the security policy lets the app load its own fonts and nothing remote', () => {
    const conf = JSON.parse(read('src-tauri/tauri.conf.json')) as { app: { security: { csp: string } } }
    const csp = conf.app.security.csp
    expect(csp).toMatch(/font-src 'self' data:/)
    expect(csp).not.toMatch(/fonts\.googleapis|fonts\.gstatic/)
  })
})
