const VOICEPRINT_CONSENT_STORAGE_KEY = 'singjourney.voiceprint-consent'
const VOICEPRINT_CONSENT_VERSION = '2026-08-17'

interface StoredVoiceprintConsent {
  version: string
  agreedAt: string
}

export function hasVoiceprintConsent() {
  const stored = uni.getStorageSync(VOICEPRINT_CONSENT_STORAGE_KEY) as
    | StoredVoiceprintConsent
    | undefined
  return stored?.version === VOICEPRINT_CONSENT_VERSION
}

export function setVoiceprintConsent(agreed: boolean) {
  if (!agreed) {
    uni.removeStorageSync(VOICEPRINT_CONSENT_STORAGE_KEY)
    return
  }
  uni.setStorageSync(VOICEPRINT_CONSENT_STORAGE_KEY, {
    version: VOICEPRINT_CONSENT_VERSION,
    agreedAt: new Date().toISOString()
  } satisfies StoredVoiceprintConsent)
}
