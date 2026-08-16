import { apiStorageKey } from '../../utils/http/client'

export type VoicePreset = 'female' | 'male'

const VOICE_PRESET_STORAGE_KEY = apiStorageKey('voice-preset')
const DEFAULT_VOICE_PRESET: VoicePreset = 'female'

export function isVoicePreset(value: unknown): value is VoicePreset {
  return value === 'female' || value === 'male'
}

export function readLocalVoicePreset(): VoicePreset {
  const stored = readStoredLocalVoicePreset()
  return isVoicePreset(stored) ? stored : DEFAULT_VOICE_PRESET
}

export function readStoredLocalVoicePreset(): VoicePreset | null {
  const stored = uni.getStorageSync(VOICE_PRESET_STORAGE_KEY)
  return isVoicePreset(stored) ? stored : null
}

export function storeLocalVoicePreset(voice: VoicePreset) {
  uni.setStorageSync(VOICE_PRESET_STORAGE_KEY, voice)
}

export function clearLocalVoicePreset() {
  uni.removeStorageSync(VOICE_PRESET_STORAGE_KEY)
}
