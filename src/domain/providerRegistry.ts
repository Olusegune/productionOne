export type ProviderId = 'openai' | 'google' | 'fal' | 'kie' | 'openrouter' | 'elevenlabs' | 'voicekiller' | 'voicekiller-user'
export type ProviderCapability = 'image-generation' | 'image-editing' | 'model-discovery' | 'durable-queue' | 'video-generation' | 'voice'

export interface ProviderDefinition {
  id: ProviderId
  name: string
  capabilities: ProviderCapability[]
  credentialStorage: 'windows-credential-manager'
  verifiedAt: string
  documentationUrl: string
  status: 'adapter-ready' | 'catalog-ready'
  notes: string
}

export const providerRegistry: ProviderDefinition[] = [
  { id:'openai',name:'OpenAI',capabilities:['image-generation','image-editing'],credentialStorage:'windows-credential-manager',verifiedAt:'2026-10-20',documentationUrl:'https://developers.openai.com/api/docs/guides/image-generation',status:'catalog-ready',notes:'Image API and Responses image-generation tool; live adapter pending credentialed acceptance test.' },
  { id:'google',name:'Google Gemini',capabilities:['image-generation','image-editing','video-generation'],credentialStorage:'windows-credential-manager',verifiedAt:'2026-10-20',documentationUrl:'https://ai.google.dev/gemini-api/docs/image-generation',status:'catalog-ready',notes:'Gemini 3.1 image generation and Veo/Gemini Omni video capabilities.' },
  { id:'fal',name:'fal.ai',capabilities:['image-generation','image-editing','durable-queue'],credentialStorage:'windows-credential-manager',verifiedAt:'2026-10-20',documentationUrl:'https://fal.ai/docs/documentation/model-apis/inference/queue',status:'catalog-ready',notes:'Official persistent queue supports submit, status, result, cancel, retries, and webhooks.' },
  { id:'kie',name:'KIE.ai',capabilities:['image-generation','image-editing','video-generation','durable-queue'],credentialStorage:'windows-credential-manager',verifiedAt:'2026-10-20',documentationUrl:'https://docs.kie.ai/market/bytedance/seedance-2',status:'adapter-ready',notes:'Native task creation and status adapter implemented for verified KIE job endpoints.' },
  { id:'openrouter',name:'OpenRouter',capabilities:['image-generation','image-editing','model-discovery'],credentialStorage:'windows-credential-manager',verifiedAt:'2026-10-20',documentationUrl:'https://openrouter.ai/docs/api/api-reference/images/list-image-models',status:'catalog-ready',notes:'Unified image API exposes model and endpoint capability discovery.' },
  { id:'elevenlabs',name:'ElevenLabs (voice and sound effects)',capabilities:['voice'],credentialStorage:'windows-credential-manager',verifiedAt:'2026-11-12',documentationUrl:'https://elevenlabs.io/docs/api-reference',status:'catalog-ready',notes:'Speech, voice design and sound effects in the Voice audition. Paid: spends your ElevenLabs credits. Speech checked live on 2026-11-13 (a short line produced valid audio); voice design and sound effects not yet run live.' },
  { id:'voicekiller',name:'VoiceKiller API key',capabilities:['voice'],credentialStorage:'windows-credential-manager',verifiedAt:'2026-11-12',documentationUrl:'https://voicekiller.com/api-docs',status:'catalog-ready',notes:'Speech in the Voice audition. Needs the API key and the user ID below, both from your VoiceKiller dashboard. Speech checked live on 2026-11-13 (a short line produced valid audio); cloning is not built.' },
  { id:'voicekiller-user',name:'VoiceKiller user ID',capabilities:['voice'],credentialStorage:'windows-credential-manager',verifiedAt:'2026-11-12',documentationUrl:'https://voicekiller.com/api-docs',status:'catalog-ready',notes:'The user ID that goes with the VoiceKiller API key.' },
]

export const imageModels = [
  { provider:'google' as ProviderId,id:'gemini-3.1-flash-image',name:'Gemini 3.1 Flash Image',references:14,resolutions:['512','1K','2K','4K'],verifiedAt:'2026-10-20' },
  { provider:'google' as ProviderId,id:'gemini-3-pro-image',name:'Gemini 3 Pro Image',references:14,resolutions:['1K','2K','4K'],verifiedAt:'2026-10-20' },
  { provider:'openrouter' as ProviderId,id:'bytedance-seed/seedream-4.5',name:'Seedream 4.5',references:null,resolutions:['1K','2K','4K'],verifiedAt:'2026-10-20' },
]

export function recommendProvider(task:'character-consistency'|'environment'|'high-volume'|'external-portability') {
  if(task==='character-consistency') return imageModels[0]
  if(task==='environment') return imageModels[1]
  if(task==='high-volume') return imageModels[2]
  return { provider:'external' as const,id:'universal-prompt',name:'Universal Prompt Package',references:null,resolutions:[],verifiedAt:'2026-10-20' }
}
