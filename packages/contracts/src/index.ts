export type StoredPitchPoint = {
  time: number
  midi: number | null
  confidence: number
}

export const MAX_RECORDING_DURATION_SECONDS = 10 * 60
export const RECORDING_DURATION_WARNING_SECONDS = 60
export const RECORDING_DURATION_WARNING_AT_SECONDS =
  MAX_RECORDING_DURATION_SECONDS - RECORDING_DURATION_WARNING_SECONDS

export type RecordingMetadata = {
  id: string
  name: string
  duration: number
  mimeType: string
  size: number
  createdAt: string
  updatedAt: string
  pointCount: number
}
