import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('fonts are bundled, so the app looks the same offline', () => {
  it('Inter for text and Space Grotesk for headings are installed and loaded at start-up', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
    for (const name of ['@fontsource-variable/inter', '@fontsource-variable/space-grotesk', '@fontsource/courier-prime']) {
      expect(pkg.dependencies[name], name).toBeTruthy()
      expect(existsSync(resolve(process.cwd(), 'node_modules', name)), `${name} is installed`).toBe(true)
    }
    const main = read('src/main.tsx')
    expect(main).toContain("@fontsource-variable/inter/opsz.css")
    expect(main).toContain("@fontsource-variable/space-grotesk/index.css")
  })
  it('headings use Space Grotesk first, then Inter, and the text font stays Inter', () => {
    const theme = read('src/theme.css')
    expect(/--display:\s*"Space Grotesk Variable",\s*"Inter Variable"/.test(theme)).toBe(true)
    expect(/--ui:\s*"Inter Variable"/.test(theme)).toBe(true)
  })
  it('the security policy lets the app load its own fonts and nothing remote', () => {
    const conf = JSON.parse(read('src-tauri/tauri.conf.json')) as { app: { security: { csp: string } } }
    const csp = conf.app.security.csp
    expect(csp).toMatch(/font-src 'self' data:/)
    expect(csp).not.toMatch(/fonts\.googleapis|fonts\.gstatic/)
  })
})
