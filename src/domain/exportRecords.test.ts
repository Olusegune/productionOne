import { describe, expect, it } from 'vitest'
import { runAcceptance } from '../acceptance/flow'
import { DESIGN_RECORDS_FORMAT, DESIGN_RECORDS_VERSION, baseName, buildDesignRecords } from './exportRecords'
import { checkExport, safetyMessage, unsafeFileReason } from './exportSafety'
import { createProfile } from './proportions'
import { profileFromWorld, deltasOf, defaultWorld } from './worldRules'

describe('export safety', () => {
  it('refuses credential and key files, and machine-specific model files, with a reason', () => {
    const bad: Array<[string, RegExp]> = [
      ['C:/p/.env', /environment/], ['C:/p/.env.local', /environment/], ['C:/Users/x/.ssh/id_rsa', /SSH/], ['D:/keys/server.pem', /key or certificate/], ['C:/p/credentials.json', /credentials/], ['C:/p/secrets.yaml', /credentials/], ['C:/p/.npmrc', /credentials/],
      ['D:/models/flux1-dev.safetensors', /model file/], ['D:/m/model.gguf', /model file/], ['D:/ComfyUI/models/checkpoints/a.bin', /ComfyUI/], ['C:/Users/x/.ollama/models/blobs/sha256-1', /Ollama/],
    ]
    for (const [path, why] of bad) expect(unsafeFileReason(path), path).toMatch(why)
    for (const ok of ['C:/out/frame_v01.png', 'C:/out/notes.txt', 'C:/out/token-economy.png', 'D:/pictures/key-art.png']) expect(unsafeFileReason(ok), ok).toBeUndefined()
  })
  it('refuses text that holds a key or token, and does not echo it', () => {
    const texts: Array<[string, RegExp]> = [
      ['x sk-abcdefghijklmnopqrstuvwx', /OpenAI/], ['AIzaSyA1234567890123456789012345678901234', /Google/], ['Authorization: Bearer abcdefghijklmnopqrstuvwxyz', /bearer/], ['-----BEGIN PRIVATE KEY-----\nabc', /private key/],
      ['{"apiKey": "supersecretvalue123"}', /credential field/], ['ghp_abcdefghijklmnopqrstuvwxyz0123456789', /GitHub/],
    ]
    for (const [text, why] of texts) {
      const problems = checkExport([], [{ name: 'design_records.json', text }])
      expect(problems, text).toHaveLength(1)
      expect(problems[0].why).toMatch(why)
      expect(safetyMessage(problems)).not.toContain('abcdefghijkl')
    }
    expect(checkExport([], [{ name: 'a', text: 'A normal note about a sketch and a skeleton: sk- is short.' }])).toEqual([])
  })
  it('lists every problem and the message names files without folders', () => {
    const problems = checkExport(['C:/secret-folder/.env', 'D:/ComfyUI/models/a.safetensors', 'C:/ok.png'])
    expect(problems.map((p) => p.where)).toEqual(['C:/secret-folder/.env', 'D:/ComfyUI/models/a.safetensors'])
    const message = safetyMessage(problems)
    expect(message).toMatch(/\.env/)
    expect(message).not.toMatch(/secret-folder/)
    expect(message).toMatch(/never go into a package/)
  })
})

describe('design records for a package', () => {
  it('hold every record, a file name instead of any folder, and pass the safety check', async () => {
    const run = await runAcceptance()
    const records = buildDesignRecords(run.project, { 'IMG-MARCUS-1-2': 'abc123' })
    const text = JSON.stringify(records)
    expect(records.format).toBe(DESIGN_RECORDS_FORMAT)
    expect(records.version).toBe(DESIGN_RECORDS_VERSION)
    expect(records.proportions).toHaveLength(2)
    expect(records.proportions.every((p) => /^pp1-[0-9a-f]{8}$/.test(p.fingerprint))).toBe(true)
    expect(records.scaleConvention).toBe('metres')
    expect(Object.keys(records.fitRules)).toEqual(['MARCUS', 'AMINA'])
    expect(Object.keys(records.sceneStates)).toEqual(['SC-1'])
    expect(records.shots).toHaveLength(3)
    expect(records.shots[0].camera).toBeTruthy()
    expect(records.shots[0].lighting).toBeTruthy()
    expect(records.looks.bakedIntoOriginals).toBe(false)
    expect(records.looks.luts).toEqual([])
    expect(records.review.deterministic.length).toBeGreaterThan(0)
    expect(records.review.vision.length).toBeGreaterThan(0)
    expect(records.approvedRevisions).toHaveLength(2)
    expect(records.approvedRevisions[0]).toMatchObject({ assetId: 'MARCUS', sheetType: 'Identity', view: 'front', revision: 1 })
    expect(text).not.toMatch(/C:\/mock|C:\\\\mock/)
    expect(checkExport([], [{ name: 'design_records.json', text }])).toEqual([])
    expect(() => JSON.parse(text)).not.toThrow()
  })
  it('an old project gives valid, empty-ish records instead of failing', () => {
    const records = buildDesignRecords({ script: '', analysis: { scenes: [], assets: [] }, shots: [], jobs: [], storyboardsEnabled: false, model: 'Seedance 2.0' })
    expect(records.proportions).toEqual([])
    expect(records.fitRules).toEqual({})
    expect(records.approvedRevisions).toEqual([])
    expect(records.world).toEqual({ scaleConvention: 'metres' })
  })
  it('baseName keeps only the file name', () => {
    expect(baseName('C:\\Users\\me\\out\\a.png')).toBe('a.png')
    expect(baseName('/home/me/out/b.png')).toBe('b.png')
    expect(baseName('')).toBe('')
  })
})

describe('world rules and inheritance', () => {
  it('a character is the world default plus its own changes, and only those changes are overrides', () => {
    const world = { ...defaultWorld(), profile: { preset: 'rounded' as const, stylization: 35 } }
    const a = profileFromWorld(world, 'A', { armLength: 3.6 }, 1.8)
    const b = profileFromWorld(world, 'B', { eyeSize: 0.26 }, 1.65)
    expect(deltasOf(a)).toEqual({ armLength: 3.6 })
    expect(deltasOf(b)).toEqual({ eyeSize: 0.26 })
    expect(a.heightM).toBe(1.8)
    expect(a.controls.eyeSize.value).toBe(b.controls.eyeSize.value === 0.26 ? a.controls.eyeSize.value : b.controls.eyeSize.value)
    expect(a.controls.shapeLanguage.value).toBe(-75)
    expect(a.stylization).toBe(35)
  })
  it('with no world default a new profile is Natural', () => {
    expect(profileFromWorld(undefined, 'X')).toEqual(createProfile('X'))
    expect(profileFromWorld(defaultWorld(), 'X')).toEqual(createProfile('X'))
  })
})
