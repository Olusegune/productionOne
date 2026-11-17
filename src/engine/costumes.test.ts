import { describe, expect, it } from 'vitest'
import { analyzeScript } from '../domain/productionStudio'
import { buildViewPrompt } from '../domain/sheetSpecs'
import { defaultStyleBible } from '../domain/visualDevelopment'
import { planCoverage, buildShotPrompt, shotReferences } from '../domain/direct'
import { emptyQueue } from '../domain/generationQueue'
import { parseStory } from './story'

const nl = String.fromCharCode(10)
const script = [
  'SCENE 1 — EXT. PLATFORM — NIGHT', '',
  'KING FLEX stands alone on a wet basalt platform: oversized coral-red puffer jacket, bare tattooed torso, layered gold chains, black cargo trousers, and trainers with glowing orange soles. Red shutter glasses conceal his eyes.', '',
  'A silver microphone rests in his right hand.', '',
  'A distant lift bell rings.', '',
  'FLEX', 'Okay. Underground venue.', '',
  'SCENE 2 — INT. OFFICE — NIGHT', '',
  'VENOMSPUR finishes writing one word.', '',
  'He is impossibly tall and narrow. Bald crown. Round black glasses framing ember-red eyes.', '',
  'Black three-piece suit. Fitted tailcoat. Red bow tie. Red pocket square.', '',
  'Flex places the silver microphone beside the blotter. He holds it no longer like a trophy.', '',
  'VENOMSPUR', 'Sit down.', '',
  'FLEX', 'Fine.', '',
  'SCENE 3 — INT. OFFICE — LATER', '',
  'Flex removes his glasses. The silver microphone chirps.', '',
  'VENOMSPUR', 'Yes.',
].join(nl)

describe('costumes read from the way the script describes people', () => {
  const story = parseStory(script)
  it('finds what each character wears, from one sentence or from the fragments that follow', () => {
    const flex = story.costumes?.find((c) => c.character === 'FLEX')
    expect(flex?.items).toEqual(expect.arrayContaining(['oversized coral-red puffer jacket', 'layered gold chains', 'black cargo trousers', 'trainers']))
    const ven = story.costumes?.find((c) => c.character === 'VENOMSPUR')
    expect(ven?.items).toEqual(expect.arrayContaining(['Black three-piece suit', 'Fitted tailcoat', 'Red bow tie', 'Red pocket square']))
  })
  it('does not turn later actions into clothes ("removes his glasses") or a single mention into a wardrobe', () => {
    const all = (story.costumes ?? []).flatMap((c) => c.items).join(' | ')
    expect(all).not.toMatch(/removes/)
    const one = parseStory(['SCENE 1 — INT. HALL — DAY', '', 'MARA walks in wearing a coat.', '', 'MARA', 'Hello.'].join(nl))
    expect(one.costumes ?? []).toEqual([])
  })
  it('props: a bell ringing and a simile are not props, the microphone is', () => {
    const names = story.props.map((p) => p.name)
    expect(names).toContain('silver microphone')
    expect(names.join(' ')).not.toMatch(/bell rings|trophy/)
  })
})

describe('costumes and props in the production', () => {
  const analysis = analyzeScript(script)
  it('makes a costume asset per character, with the script words as its description', () => {
    const c = analysis.assets.find((a) => a.type === 'costume' && a.name === 'FLEX costume')
    expect(c?.prompt).toMatch(/Costume worn by FLEX/)
    expect(c?.prompt).toMatch(/puffer jacket/)
    expect(analysis.assets.some((a) => a.type === 'costume' && a.name === 'VENOMSPUR costume')).toBe(true)
  })
  it('a costume sheet prompt keeps the script description', () => {
    const c = analysis.assets.find((a) => a.name === 'FLEX costume')!
    const p = buildViewPrompt({ style: defaultStyleBible, asset: c, variant: 'Canonical', sheetType: 'Wardrobe', view: { key: 'costume-front', label: 'Costume front', instruction: 'Front.', aspect: '3:4', fullBody: true } as never })
    expect(p).toMatch(/oversized coral-red puffer jacket/)
  })
  it('master and dialogue shots carry the characters costumes and the props near them, and an insert for a prop that returns', () => {
    const shots = planCoverage(analysis)
    const name = (id: string) => analysis.assets.find((a) => a.id === id)?.name
    const master = shots.find((s) => s.sceneId === 'SCENE-002' && s.coverage === 'master')!
    const names = master.assetIds.map(name)
    expect(names).toEqual(expect.arrayContaining(['FLEX costume', 'VENOMSPUR costume', 'silver microphone']))
    expect(shots.some((s) => s.coverage === 'insert' && /silver microphone/.test(s.title))).toBe(true)
    const prompt = buildShotPrompt(master, analysis, { name: 's', description: 'd', rendering: 'r' } as never, [])
    expect(prompt).toMatch(/Wardrobe, exactly as the script describes it/)
    expect(prompt).toMatch(/Props in frame: .*silver microphone/)
  })
  it('a costume with an approved picture is sent as a reference for the shot, like the person', () => {
    const shots = planCoverage(analysis)
    const master = shots.find((s) => s.sceneId === 'SCENE-002' && s.coverage === 'master')!
    const costume = analysis.assets.find((a) => a.name === 'VENOMSPUR costume')!
    const queue = { ...emptyQueue(), jobs: [{ id: 'j', assetId: costume.id, variant: 'Canonical', viewKey: 'costume-front', approved: true, outputPath: 'c.png', revision: 1 } as never] }
    expect(shotReferences(master, analysis, queue).map((r) => r.label)).toContain('VENOMSPUR costume')
  })
})
