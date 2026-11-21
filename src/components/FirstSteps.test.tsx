// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickStart } from './QuickStart'
import { Tour, tourDone, tourSteps, type TourStep } from './Tour'
import { FirstRun } from './FirstRun'
import { ProportionPanel } from './ProportionPanel'
import { FitPanel } from './FitPanel'
import { ShotCameraLighting } from './ShotCameraLighting'
import { createProfile } from '../domain/proportions'
import type { ExtractedAsset, ShotRecord } from '../domain/productionStudio'

let keys: Record<string, boolean> = { kie: true }
const calls: string[] = []
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
  invoke: async (name: string, args: Record<string, unknown> = {}) => {
    calls.push(name)
    if (name === 'credential_status') return !!keys[String(args.provider)]
    if (name === 'model_catalog') return {}
    if (name === 'kie_models') return { kie: { fetchedAt: Date.now() / 1000, models: [] } }
    return undefined
  },
}))

const characters = [{ id: 'C1', name: 'MARCUS' }, { id: 'C2', name: 'AMINA' }]
beforeEach(() => { keys = { kie: true }; calls.length = 0; try { localStorage.clear() } catch { /* ignore */ } })
afterEach(cleanup)

const qs = (over: Partial<Parameters<typeof QuickStart>[0]> = {}) => {
  const onMake = vi.fn(); const onKeys = vi.fn(); const onOwnPicture = vi.fn()
  const utils = render(<QuickStart desktop providersVersion={0} perImageUsd={null} characters={characters} styleName="Restrained Cinematic Realism" onMake={onMake} onKeys={onKeys} onOwnPicture={onOwnPicture} {...over} />)
  return { onMake, onKeys, onOwnPicture, ...utils }
}

describe('QuickStart: make my first picture', () => {
  it('shows the style, the model and the cost before you press anything, and spends nothing until you do', async () => {
    const { onMake } = qs()
    await waitFor(() => expect(screen.getByRole('button', { name: /Make my first picture/ })).toBeTruthy())
    expect(screen.getByText(/Restrained Cinematic Realism/)).toBeTruthy()
    expect(screen.getByText(/Model:/).parentElement!.textContent).toMatch(/Nano Banana|nanobanana|Kie\.ai/i)
    expect(screen.getByTestId('qs-cost').textContent).toMatch(/^1 picture · about \$0\.\d\d \(typical price/)
    expect(screen.getByText(/Nothing is made or charged until you press the button/)).toBeTruthy()
    expect(onMake).not.toHaveBeenCalled()
  })
  it('uses your own price when you have set one', async () => {
    qs({ perImageUsd: 0.05 })
    await waitFor(() => expect(screen.getByTestId('qs-cost').textContent).toBe('1 picture · about $0.05 at your price of $0.05 each'))
  })
  it('makes a first picture of someone already in the project, only when pressed', async () => {
    const { onMake } = qs()
    fireEvent.change(await screen.findByLabelText('First picture subject'), { target: { value: 'C2' } })
    fireEvent.click(await screen.findByRole('button', { name: /Make my first picture/ }))
    expect(onMake).toHaveBeenCalledTimes(1)
    expect(onMake).toHaveBeenCalledWith({ kind: 'existing', assetId: 'C2' })
  })
  it('a new character needs a name and a sentence first', async () => {
    const { onMake } = qs()
    fireEvent.change(await screen.findByLabelText('First picture subject'), { target: { value: 'new' } })
    const go = await screen.findByRole('button', { name: /Make my first picture/ }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    expect(screen.getByText('Describe the character in a sentence first.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('New character description'), { target: { value: 'A harbour pilot in a navy coat.' } })
    expect(go.disabled).toBe(false)
    fireEvent.click(go)
    expect(onMake).toHaveBeenCalledWith({ kind: 'new', name: 'Mara', description: 'A harbour pilot in a navy coat.' })
  })
  it('with no key it offers to add one instead of making a picture', async () => {
    keys = {}
    const { onMake, onKeys } = qs()
    fireEvent.click(await screen.findByRole('button', { name: /Add a key first/ }))
    expect(onKeys).toHaveBeenCalledTimes(1)
    expect(onMake).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Make my first picture/ })).toBeNull()
    expect(screen.getByText(/There is no .* key yet/)).toBeTruthy()
  })
  it('in the browser preview it says making pictures needs the desktop app, and the button is off', async () => {
    qs({ desktop: false })
    const go = await screen.findByRole('button', { name: /Make my first picture/ }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    expect(screen.getByText('Making pictures needs the desktop app.')).toBeTruthy()
  })
  it('can use your own picture instead, and can be hidden for good', async () => {
    const { onOwnPicture, container } = qs()
    fireEvent.click(await screen.findByRole('button', { name: 'Use my own picture instead' }))
    expect(onOwnPicture).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Hide the quick start' }))
    expect(container.querySelector('.qs')).toBeNull()
    cleanup()
    const again = qs()
    expect(again.container.querySelector('.qs')).toBeNull()
  })
})

describe('the quick tour', () => {
  const dom = (html: string) => { document.body.insertAdjacentHTML('beforeend', html) }
  afterEach(() => { document.body.innerHTML = '' })

  it('has six steps that name the real controls and promise an estimate before every Generate', () => {
    expect(tourSteps.map((s) => s.id)).toEqual(['screens', 'next', 'keys', 'assistant', 'find', 'first'])
    const all = tourSteps.map((s) => s.body).join(' ')
    expect(all).toMatch(/Golden Path/)
    expect(all).toMatch(/every Generate button shows an estimate first/)
    expect(all).toMatch(/one line per beat/)
    expect(all).toMatch(/Ctrl\+K/)
    expect(all).toMatch(/F1/)
  })
  it('moves through the steps with Next and Back, and shows where you are', () => {
    render(<Tour onClose={() => {}} />)
    expect(screen.getByText('1 of 6')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Back/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText('2 of 6')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'It always tells you what is next' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(screen.getByText('1 of 6')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('2 of 6')).toBeTruthy()
  })
  it('can be skipped at any step with Skip, the x or Esc, and remembers it was seen', () => {
    for (const how of ['skip', 'x', 'esc']) {
      localStorage.clear()
      const close = vi.fn()
      const { unmount } = render(<Tour onClose={close} />)
      fireEvent.click(screen.getByRole('button', { name: /Next/ }))
      if (how === 'skip') fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
      if (how === 'x') fireEvent.click(screen.getByRole('button', { name: 'Skip the tour' }))
      if (how === 'esc') fireEvent.keyDown(window, { key: 'Escape' })
      expect(close, how).toHaveBeenCalledTimes(1)
      expect(tourDone(), how).toBe(true)
      unmount()
    }
  })
  it('the last step offers to take you to the quick start, or just finish', () => {
    const close = vi.fn(); const go = vi.fn()
    render(<Tour onClose={close} onFinish={go} />)
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText('6 of 6')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take me there' }))
    expect(go).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })
  it('points at the real control when it is on screen, and centres the card when it is not', () => {
    dom('<nav aria-label="Workspaces"><button>Projects</button><button>Assistant</button></nav>')
    const nav = document.querySelector('nav')!
    nav.getBoundingClientRect = () => ({ top: 100, left: 20, width: 160, height: 300, right: 180, bottom: 400, x: 20, y: 100, toJSON: () => ({}) })
    const steps: TourStep[] = [{ id: 'a', title: 'Here', body: 'Pointing at the nav.', find: () => nav }, { id: 'b', title: 'Nowhere', body: 'Not on screen.', find: () => null }]
    const { container } = render(<Tour onClose={() => {}} steps={steps} />)
    expect(container.querySelector('.tour-spot')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(container.querySelector('.tour-spot')).toBeNull()
    expect(container.querySelector('.tour-dim')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Quick tour' })).toBeTruthy()
  })
  it('never calls the app: it only points', () => {
    render(<Tour onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(calls).toEqual([])
  })
})

describe('the first-run card offers the tour', () => {
  it('has a Take the 1-minute tour button that closes the card and starts the tour', () => {
    const tour = vi.fn()
    const { container } = render(<FirstRun onKeys={() => {}} onStory={() => {}} onTour={tour} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take the 1-minute tour' }))
    expect(tour).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.first-run')).toBeNull()
  })
  it('without a tour it keeps its single Got it button', () => {
    render(<FirstRun onKeys={() => {}} onStory={() => {}} />)
    expect(screen.queryByRole('button', { name: /tour/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy()
  })
})

describe('the cost is on every Generate button', () => {
  const asset: ExtractedAsset = { id: 'C1', name: 'MARCUS', type: 'character', sceneIds: [], status: 'planned' }
  it('Generate preview (proportions)', () => {
    render(<ProportionPanel asset={asset} profile={createProfile('C1')} onChange={() => {}} onGenerate={() => {}} candidates={[]} approvedViews={0} cost="about $0.04" notify={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Edit proportions/ }))
    expect(screen.getByRole('button', { name: 'Generate design preview · about $0.04' })).toBeTruthy()
  })
  it('Scale and Fit and redesign', () => {
    render(<FitPanel asset={asset} profile={createProfile('C1')} rules={[]} onRules={() => {}} people={[]} onGenerateScaleSheet={() => {}} originalPath="C:/o.png" redesignCandidates={[]} onGenerateRedesign={() => {}} onApproveCandidate={() => {}} staleViews={0} cost="about $0.04" notify={() => {}} />)
    expect(screen.getByRole('button', { name: 'Generate Scale and Fit reference · about $0.04' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Generate redesign candidate · about $0.04' })).toBeTruthy()
  })
  it('the lighting test says what all its pictures will cost', () => {
    const shot = { id: 'S1', sceneId: 'SC', order: 1, duration: 4, assetIds: [], action: '', dialogue: '', speaker: '', emotionalObjective: '', facialActing: '', bodyLanguage: '', microAnimation: '', cameraFraming: '', cameraMovement: '', lighting: '', soundEffects: '', ambience: '', music: '', transition: 'Cut', storyboardStatus: 'planned', lightingRecord: { keyAzimuth: 0, keyElevation: 30, sourceSize: 'medium', contrast: 'medium', rim: false, practicals: '', ambient: 'normal', colorTempK: 5500, timeOfDay: '', exposure: 'normal' } } as ShotRecord
    render(<ShotCameraLighting shot={shot} sceneShots={[shot]} assets={[]} flat2D={false} styleName="x" update={() => {}} onLightingTest={() => {}} testCost="about $0.32" />)
    for (const b of screen.getAllByRole('button', { expanded: false })) fireEvent.click(b)
    expect(screen.getByRole('button', { name: /Make a lighting test of the focus character \(8 pictures, about \$0\.32\)/ })).toBeTruthy()
  })
})
