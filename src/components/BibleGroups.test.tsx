import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { BibleTree } from './bible'
import { ProductionBibleOverview } from './ProductionBibleOverview'
import { bibleOverview, type BibleView } from '../domain/bibleGroups'
import { emptyQueue } from '../domain/generationQueue'
import { emptyVariations } from '../domain/variations'
import type { ExtractedAsset } from '../domain/productionStudio'

const a = (id: string, name: string, type: ExtractedAsset['type'], status: ExtractedAsset['status'] = 'planned') => ({ id, name, type, status, sceneIds: [] }) as ExtractedAsset
const assets = [a('C1', 'Mara', 'character', 'approved'), a('K1', 'Field jacket', 'costume'), a('P1', 'Staff', 'prop'), a('S1', 'Kitchen', 'set')]

function Tree({ initial }: { initial?: BibleView }) {
  const [view, setView] = useState<BibleView | undefined>(initial)
  return <BibleTree assets={assets} queue={emptyQueue()} selected={0} onSelect={() => {}} view={view} onView={initial === undefined ? undefined : setView} />
}

describe('browsing the bible by group', () => {
  it('without a switcher it lists every group, as before', () => {
    render(<Tree />)
    for (const h of ['Characters', 'Costumes', 'Props', 'Sets']) expect(screen.getByRole('heading', { name: new RegExp(h) })).toBeTruthy()
    expect(screen.queryByRole('group', { name: /Browse the bible by group/ })).toBeNull()
  })

  it('with a switcher it shows one group at a time with counts, and Assets holds costumes and props', () => {
    render(<Tree initial="characters" />)
    const sw = screen.getByRole('group', { name: /Browse the bible by group/ })
    expect(within(sw).getByRole('button', { name: /Characters1/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('Staff')).toBeNull()
    fireEvent.click(within(sw).getByRole('button', { name: /Assets2/ }))
    expect(screen.getByText('Field jacket')).toBeTruthy()
    expect(screen.getByText('Staff')).toBeTruthy()
    expect(screen.queryByText('Mara')).toBeNull()
    fireEvent.click(within(sw).getByRole('button', { name: /Worlds1/ }))
    expect(screen.getByText('Kitchen')).toBeTruthy()
  })

  it('Overview lists no pieces and says so', () => {
    render(<Tree initial="characters" />)
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    expect(screen.queryByText('Mara')).toBeNull()
    expect(screen.getByText(/The overview is open/)).toBeTruthy()
  })
})

describe('the overview page', () => {
  it('shows what you have, and a group button opens that group', () => {
    const onGroup = vi.fn()
    render(<ProductionBibleOverview overview={bibleOverview({ assets, variations: emptyVariations(), styleName: 'Ink' })} onGroup={onGroup} />)
    expect(screen.getByText('Ink')).toBeTruthy()
    expect(screen.getByText('1 of 1 approved')).toBeTruthy()
    expect(screen.getByText(/Nothing is out of date/)).toBeTruthy()
    expect(screen.getByText('No scene has been frozen yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Worlds/ }))
    expect(onGroup).toHaveBeenCalledWith('worlds')
  })
})
