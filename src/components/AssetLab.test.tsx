import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssetLab } from './AssetLab'
import type { ExtractedAsset } from '../domain/productionStudio'

const base = { id: 'A1', sceneIds: [], status: 'planned' as const }
const view = (asset: ExtractedAsset) => render(<AssetLab asset={asset} onChange={vi.fn()} notify={vi.fn()} />)

describe('identity fields follow the kind of asset', () => {
  it('shows age, gender, race, ethnicity, role and personality for a character', () => {
    view({ ...base, name: 'MARA', type: 'character' })
    for (const label of ['Age', 'Gender', 'Race', 'Ethnicity']) expect(screen.getByText(label)).toBeTruthy()
    expect(screen.getByLabelText('Personality')).toBeTruthy()
  })
  it('shows only what must never drift for a set, a prop or a vehicle', () => {
    for (const type of ['set', 'prop', 'vehicle'] as const) {
      const { unmount } = view({ ...base, name: 'ARENA', type })
      expect(screen.queryByText('Age')).toBeNull()
      expect(screen.queryByText('Ethnicity')).toBeNull()
      expect(screen.queryByLabelText('Personality')).toBeNull()
      expect(screen.getByLabelText('Never: what must not drift')).toBeTruthy()
      unmount()
    }
  })
  it('keeps character facts that an older project saved on a set, and says so', () => {
    view({ ...base, name: 'ARENA', type: 'set', age: '40', gender: 'male' })
    expect(screen.getByTestId('kept-character-fields').textContent).toMatch(/age: 40.*gender: male/)
  })
})
