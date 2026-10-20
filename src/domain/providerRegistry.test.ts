import { describe,expect,it } from 'vitest'
import { providerRegistry,recommendProvider } from './providerRegistry'

describe('provider registry',()=>{
  it('keeps secrets in native credential storage',()=>expect(providerRegistry.every(provider=>provider.credentialStorage==='windows-credential-manager')).toBe(true))
  it('marks only implemented adapters ready',()=>expect(providerRegistry.filter(provider=>provider.status==='adapter-ready').map(provider=>provider.id)).toEqual(['kie']))
  it('selects a verified character consistency model',()=>expect(recommendProvider('character-consistency').id).toBe('gemini-3.1-flash-image'))
})
