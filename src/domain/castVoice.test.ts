import { describe, expect, it } from 'vitest'
import { countWithSavedVoice, describeCastVoice, forgetVoice, rememberVoice, savedVoiceFor } from './castVoice'
import { analyzeScript, mergeAnalysis, type ExtractedAsset } from './productionStudio'

const mara: ExtractedAsset = { id: 'CHAR-MARA', name: 'MARA', type: 'character', sceneIds: [], status: 'planned', personality: 'warm' }

describe('saved character voices', () => {
  it('saves and clears a voice without touching anything else on the character', () => {
    const saved = rememberVoice(mara, { provider: 'elevenlabs', voice: ' v-1 ', label: 'Rachel', model: 'eleven_v4' })
    expect(saved).toMatchObject({ personality: 'warm', castVoice: { provider: 'elevenlabs', voice: 'v-1', label: 'Rachel', model: 'eleven_v4' } })
    expect(forgetVoice(saved)).toEqual(mara)
    expect(rememberVoice(mara, { provider: 'windows', voice: '   ' })).toBe(mara)
  })
  it('only offers a saved voice to the engine it belongs to', () => {
    const saved = rememberVoice(mara, { provider: 'windows', voice: 'Zira' })
    expect(savedVoiceFor(saved, 'windows')?.voice).toBe('Zira')
    expect(savedVoiceFor(saved, 'elevenlabs')).toBeUndefined()
    expect(savedVoiceFor(mara, 'windows')).toBeUndefined()
  })
  it('describes the voice and counts characters that have one', () => {
    expect(describeCastVoice({ provider: 'elevenlabs', voice: 'v-1', label: 'Rachel' })).toBe('Rachel (ElevenLabs)')
    expect(describeCastVoice({ provider: 'windows', voice: 'Zira' })).toBe('Zira (Windows voices)')
    const tom: ExtractedAsset = { ...mara, id: 'CHAR-TOM', name: 'TOM' }
    expect(countWithSavedVoice([rememberVoice(mara, { provider: 'windows', voice: 'Zira' }), tom], 'windows')).toBe(1)
  })
})

describe('reading the script again keeps what the person set', () => {
  const script = 'INT. ROOM - DAY\n\nMARA enters.\n\nMARA\nHello.\n\nTOM\nHi.\n'
  it('carries confirmed fields, the saved voice and approval to assets that are still there', () => {
    const first = analyzeScript(script)
    const edited = { ...first, assets: first.assets.map((a) => (a.name === 'MARA' ? { ...rememberVoice(a, { provider: 'windows', voice: 'Zira' }), personality: 'warm', never: 'never pale', status: 'approved' as const } : a)) }
    const again = mergeAnalysis(edited, analyzeScript('EXT. YARD - NIGHT\n\nTOM waits.\n\n' + script))
    const m = again.assets.find((a) => a.name === 'MARA')!
    expect(m).toMatchObject({ personality: 'warm', never: 'never pale', status: 'approved', castVoice: { voice: 'Zira' } })
    expect(m.id).toBe(first.assets.find((a) => a.name === 'MARA')!.id)
    expect(again.assets.find((a) => a.name === 'TOM')?.status).toBe('planned')
  })
  it('drops assets the script no longer has', () => {
    const first = analyzeScript(script)
    const again = mergeAnalysis(first, analyzeScript('INT. ROOM - DAY\n\nMARA enters.\n\nMARA\nHello.\n'))
    expect(again.assets.some((a) => a.name === 'TOM')).toBe(false)
    expect(again.assets.some((a) => a.name === 'MARA')).toBe(true)
  })
  it('does not let a changed asset type inherit another type\'s fields', () => {
    const prev = { scenes: [], assets: [{ ...mara, id: 'X1', name: 'X', type: 'prop' as const, personality: 'cool' }] }
    const next = { scenes: [], assets: [{ ...mara, id: 'X2', name: 'X', personality: undefined }] }
    expect(mergeAnalysis(prev, next).assets[0]).toMatchObject({ id: 'X2', personality: undefined })
  })
  it('keeps every id stable when a new location is added earlier, so pictures and shots still point at the right asset', () => {
    const first = analyzeScript(script)
    const again = mergeAnalysis(first, analyzeScript('EXT. HARBOUR - DAWN\n\nMARA waits.\n\n' + script))
    for (const a of first.assets) expect(again.assets.find((x) => x.name === a.name && x.type === a.type)?.id).toBe(a.id)
    expect(new Set(again.assets.map((a) => a.id)).size).toBe(again.assets.length)
  })
})
