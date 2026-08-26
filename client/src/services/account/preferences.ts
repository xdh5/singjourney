import { apiStorageKey } from '../../utils/http/client'

export type VoicePreset = 'female' | 'male'
export type VocalRange = { minimumMidi: number; maximumMidi: number }

const VOICE_PRESET_STORAGE_KEY = apiStorageKey('voice-preset')
const VOCAL_RANGE_STORAGE_KEY = apiStorageKey('vocal-range')
export const PRACTICE_RANGE_MINIMUM_MIDI = 48
export const PRACTICE_RANGE_MAXIMUM_MIDI = 77
export const DEFAULT_VOCAL_RANGE: VocalRange = { minimumMidi: 48, maximumMidi: 72 }
const LEGACY_VOICE_RANGES: Record<VoicePreset, VocalRange> = {
  male: { minimumMidi: 48, maximumMidi: 72 },
  female: { minimumMidi: 52, maximumMidi: 76 }
}

export function isVoicePreset(value: unknown): value is VoicePreset {
  return value === 'female' || value === 'male'
}

export function isVocalRange(value: unknown): value is VocalRange {
  if (!value || typeof value !== 'object') return false
  const range = value as VocalRange
  return (
    Number.isInteger(range.minimumMidi) &&
    Number.isInteger(range.maximumMidi) &&
    range.minimumMidi >= PRACTICE_RANGE_MINIMUM_MIDI &&
    range.maximumMidi <= PRACTICE_RANGE_MAXIMUM_MIDI &&
    range.minimumMidi < range.maximumMidi
  )
}

export function readLocalVocalRange(): VocalRange {
  return readStoredLocalVocalRange() ?? DEFAULT_VOCAL_RANGE
}

export function readStoredLocalVocalRange(): VocalRange | null {
  const stored = uni.getStorageSync(VOCAL_RANGE_STORAGE_KEY)
  if (isVocalRange(stored)) return stored
  const legacyVoice = readStoredLocalVoicePreset()
  return legacyVoice ? LEGACY_VOICE_RANGES[legacyVoice] : null
}

export function vocalRangeFromLegacyVoice(voice: unknown): VocalRange | null {
  return isVoicePreset(voice) ? LEGACY_VOICE_RANGES[voice] : null
}

export function storeLocalVocalRange(range: VocalRange) {
  uni.setStorageSync(VOCAL_RANGE_STORAGE_KEY, range)
  clearLocalVoicePreset()
}

export function clearLocalVocalRange() {
  uni.removeStorageSync(VOCAL_RANGE_STORAGE_KEY)
  clearLocalVoicePreset()
}

export function readStoredLocalVoicePreset(): VoicePreset | null {
  const stored = uni.getStorageSync(VOICE_PRESET_STORAGE_KEY)
  return isVoicePreset(stored) ? stored : null
}

export function clearLocalVoicePreset() {
  uni.removeStorageSync(VOICE_PRESET_STORAGE_KEY)
}
