import type { StoredPitchPoint } from '@singjourney/contracts'
import { resolveApiUrl } from '../config/endpoints'
import type { ShareAudioPayload } from '../platform/share-audio'
import { uploadShareAudio } from '../platform/share-audio'

type ShareUploadIntent = {
  id: string
  expires_at: string
  upload_url: string
  upload_headers: Record<string, string>
  complete_url: string
  delete_token: string
}

export type ActivatedShare = {
  id: string
  title: string
  duration_seconds: number
  expires_at: string
  share_url: string
  audio_url: string
}

export type PublicRecordingShare = {
  id: string
  title: string
  duration_seconds: number
  expires_at: string
  curve: StoredPitchPoint[]
  audio_url: string
}

const API_REQUEST_TIMEOUT_MS = 15000
const RECORDING_SHARE_CACHE_KEY = 'singjourney.recording-share-cache.v2'
const MINIMUM_REUSABLE_SHARE_LIFETIME_MS = 60 * 1000
const PUBLIC_AUDIO_URL_CACHE_KEY = 'singjourney.public-audio-url-cache.v1'
const PUBLIC_AUDIO_URL_CACHE_LIFETIME_MS = 4 * 60 * 1000

export type ShareFailureStage = 'preparation' | 'intent' | 'upload' | 'activation'

export class ShareFlowError extends Error {
  readonly cause: unknown

  constructor(public readonly stage: ShareFailureStage, cause: unknown) {
    super(`Recording share failed during ${stage}`)
    this.name = 'ShareFlowError'
    this.cause = cause
  }
}

export function getCachedRecordingShare(recordingId: string): ActivatedShare | null {
  if (!recordingId) return null
  const cache = readRecordingShareCache()
  const cached = cache[recordingId]
  if (!cached || Date.parse(cached.expires_at) - Date.now() <= MINIMUM_REUSABLE_SHARE_LIFETIME_MS) {
    if (cached) {
      delete cache[recordingId]
      uni.setStorageSync(RECORDING_SHARE_CACHE_KEY, cache)
    }
    return null
  }
  return cached
}

export function cacheRecordingShare(recordingId: string, share: ActivatedShare) {
  if (!recordingId) return
  const cache = readRecordingShareCache()
  cache[recordingId] = share
  for (const [id, candidate] of Object.entries(cache)) {
    if (Date.parse(candidate.expires_at) <= Date.now()) delete cache[id]
  }
  uni.setStorageSync(RECORDING_SHARE_CACHE_KEY, cache)
}

export async function getPublicRecordingShare(id: string) {
  const share = await requestJson<PublicRecordingShare>(resolveApiUrl(`/shares/${encodeURIComponent(id)}`), 'GET')
  const cache = readPublicAudioUrlCache()
  const cached = cache[id]
  if (cached && cached.expiresAt > Date.now()) {
    share.audio_url = cached.url
    return share
  }
  if (!share.audio_url.includes('.r2.cloudflarestorage.com/')) return share
  cache[id] = {
    url: share.audio_url,
    expiresAt: Date.now() + PUBLIC_AUDIO_URL_CACHE_LIFETIME_MS
  }
  for (const [shareId, candidate] of Object.entries(cache)) {
    if (candidate.expiresAt <= Date.now()) delete cache[shareId]
  }
  uni.setStorageSync(PUBLIC_AUDIO_URL_CACHE_KEY, cache)
  return share
}

function readPublicAudioUrlCache(): Record<string, { url: string; expiresAt: number }> {
  const stored = uni.getStorageSync(PUBLIC_AUDIO_URL_CACHE_KEY)
  return stored && typeof stored === 'object'
    ? stored as Record<string, { url: string; expiresAt: number }>
    : {}
}

function readRecordingShareCache(): Record<string, ActivatedShare> {
  const stored = uni.getStorageSync(RECORDING_SHARE_CACHE_KEY)
  return stored && typeof stored === 'object' ? stored as Record<string, ActivatedShare> : {}
}

export async function createRecordingShare(input: {
  title: string
  durationSeconds: number
  points: StoredPitchPoint[]
  audio: ShareAudioPayload
}) {
  let intent: ShareUploadIntent
  try {
    intent = await requestJson<ShareUploadIntent>(resolveApiUrl('/shares'), 'POST', {
      title: input.title,
      duration_seconds: input.durationSeconds,
      curve: input.points,
      audio: {
        filename: input.audio.filename,
        mime_type: input.audio.mimeType,
        byte_size: input.audio.byteSize
      }
    })
  } catch (error) {
    throw new ShareFlowError('intent', error)
  }
  try {
    await uploadShareAudio(intent.upload_url, intent.upload_headers, input.audio)
  } catch (error) {
    throw new ShareFlowError('upload', error)
  }
  let activated: ActivatedShare
  try {
    activated = await requestJson<ActivatedShare>(intent.complete_url, 'POST')
  } catch (error) {
    throw new ShareFlowError('activation', error)
  }
  return { ...activated, deleteToken: intent.delete_token }
}

function requestJson<T>(url: string, method: 'GET' | 'POST', data?: unknown) {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url,
      method,
      data: data as any,
      timeout: API_REQUEST_TIMEOUT_MS,
      header: data ? { 'Content-Type': 'application/json' } : undefined,
      success: result => {
        if (result.statusCode >= 200 && result.statusCode < 300) resolve(result.data as T)
        else reject(new Error(`Share API failed: ${result.statusCode}`))
      },
      fail: reject
    })
  })
}
