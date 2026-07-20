import type { StoredPitchPoint } from '@shengji/contracts'
import { resolveApiUrl } from '../config/runtime'
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

const API_REQUEST_TIMEOUT_MS = 15000

export async function createRecordingShare(input: {
  title: string
  durationSeconds: number
  points: StoredPitchPoint[]
  audio: ShareAudioPayload
}) {
  const intent = await requestJson<ShareUploadIntent>(resolveApiUrl('/shares'), 'POST', {
    title: input.title,
    duration_seconds: input.durationSeconds,
    curve: input.points,
    audio: {
      filename: input.audio.filename,
      mime_type: input.audio.mimeType,
      byte_size: input.audio.byteSize
    }
  })
  await uploadShareAudio(intent.upload_url, intent.upload_headers, input.audio)
  const activated = await requestJson<ActivatedShare>(intent.complete_url, 'POST')
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
