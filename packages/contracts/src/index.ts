export type StoredPitchPoint = {
  time: number
  midi: number | null
  confidence: number
}

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
