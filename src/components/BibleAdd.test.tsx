import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BibleTree } from './bible'
import { emptyQueue } from '../domain/generationQueue'
import type { ExtractedAsset } from '../domain/productionStudio'

const setup = (onAddAsset = vi.fn(), assets: ExtractedAsset[] = [], onAddMany?: (kind: string) => void) => {
  render(<BibleTree assets={assets} queue={emptyQueue()} selected={0} onSelect={() => {}} onAddAsset={onAddAsset} onAddMany={onAddMany as never} />)
  return onAddAsset
}
const openDialog = () => fireEvent.click(screen.getByRole('button', { name: /Add to the bible/ }))
const type = (name: string) => fireEvent.change(screen.getByLabelText('Name for the new asset'), { target: { value: name } })

describe('Add to the production bible', () => {
  it('stays disabled until a name is typed, then adds a character from an image', () => {
    const add = setup()
    expect(screen.queryByLabelText('Name for the new asset')).toBeNull()
    openDialog()
    const button = screen.getByRole('button', { name: /Add from image/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    type('Dominic')
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(add).toHaveBeenCalledWith('character', 'Dominic', '', true, { description: '', layout: '', makeConcept: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('passes the chosen gender along, for characters only', () => {
    const add = setup()
    openDialog()
    type('Mara')
    fireEvent.change(screen.getByLabelText('Gender for the new character'), { target: { value: 'female' } })
    fireEvent.click(screen.getByRole('button', { name: /Add from image/ }))
    expect(add).toHaveBeenCalledWith('character', 'Mara', 'female', true, { description: '', layout: '', makeConcept: false })
  })
  it('adds a prop, a set or a costume, with or without an image, and hides gender for them', () => {
    const add = setup()
    openDialog()
    fireEvent.change(screen.getByLabelText('Type of the new asset'), { target: { value: 'set' } })
    expect(screen.queryByLabelText('Gender for the new character')).toBeNull()
    type('Rooftop at night')
    fireEvent.click(screen.getByRole('button', { name: /Add without image/ }))
    expect(add).toHaveBeenCalledWith('set', 'Rooftop at night', '', false, { description: '', layout: '', makeConcept: false })
    openDialog()
    fireEvent.change(screen.getByLabelText('Type of the new asset'), { target: { value: 'prop' } })
    type('Golden microphone')
    fireEvent.click(screen.getByRole('button', { name: /Add from image/ }))
    expect(add).toHaveBeenLastCalledWith('prop', 'Golden microphone', '', true, { description: '', layout: '', makeConcept: false })
  })
  it('always shows Characters, Costumes, Props and Sets, saying None yet for an empty group so nothing seems hidden', () => {
    setup(vi.fn(), [{ id: 'C1', name: 'MARA', type: 'character', sceneIds: [], status: 'planned' } as ExtractedAsset])
    for (const g of ['Characters', 'Costumes', 'Props', 'Sets']) expect(screen.getByRole('heading', { name: new RegExp(g) })).toBeTruthy()
    expect(screen.getAllByText(/None yet/).length).toBe(3)
  })
  it('is absent when the host cannot import images', () => {
    render(<BibleTree assets={[]} queue={emptyQueue()} selected={0} onSelect={() => {}} />)
    expect(screen.queryByRole('button', { name: /Add to the bible/ })).toBeNull()
  })
  it('closes with Escape without adding anything', () => {
    const add = setup()
    openDialog()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(add).not.toHaveBeenCalled()
  })
  it('adds several images at once of the chosen kind, without needing a name', () => {
    const many = vi.fn()
    setup(vi.fn(), [], many)
    openDialog()
    fireEvent.change(screen.getByLabelText('Type of the new asset'), { target: { value: 'prop' } })
    const button = screen.getByRole('button', { name: /Add several images at once/ }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(screen.getByText(/One prop per image/)).toBeTruthy()
    fireEvent.click(button)
    expect(many).toHaveBeenCalledWith('prop')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('does not offer it when the app cannot add many', () => {
    setup()
    openDialog()
    expect(screen.queryByRole('button', { name: /Add several images at once/ })).toBeNull()
  })
  it('carries a description and, for a set, its layout, and can make a first concept straight away', () => {
    const add = setup()
    openDialog()
    type('Hotel Lobby')
    fireEvent.change(screen.getByLabelText('Type of the new asset'), { target: { value: 'set' } })
    fireEvent.change(screen.getByLabelText('Description of the new asset'), { target: { value: 'A faded art-deco lobby' } })
    fireEvent.change(screen.getByLabelText('Layout of the new set'), { target: { value: 'Door on the left, desk in the centre' } })
    fireEvent.click(screen.getByRole('button', { name: /Add and make a first concept/ }))
    expect(add).toHaveBeenCalledWith('set', 'Hotel Lobby', '', false, { description: 'A faded art-deco lobby', layout: 'Door on the left, desk in the centre', makeConcept: true })
  })
  it('asks for a layout only for a set, never for a character or prop', () => {
    setup()
    openDialog()
    expect(screen.queryByLabelText('Layout of the new set')).toBeNull()
    fireEvent.change(screen.getByLabelText('Type of the new asset'), { target: { value: 'prop' } })
    expect(screen.queryByLabelText('Layout of the new set')).toBeNull()
    expect(screen.getByLabelText('Description of the new asset')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Type of the new asset'), { target: { value: 'set' } })
    expect(screen.getByLabelText('Layout of the new set')).toBeTruthy()
    expect(screen.queryByLabelText('Gender for the new character')).toBeNull()
  })
})
