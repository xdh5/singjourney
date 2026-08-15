import type { StoredPitchPoint } from '@singjourney/contracts'

type RecordingCatalogEntry = {
  id: string
  name: string
}

export type StoredCurvePoint = [time: number, midi: number | null, confidence: number]

export function prependRecording<T>(recordings: readonly T[], recording: T) {
  return [recording, ...recordings]
}

export function removeRecordings<T extends RecordingCatalogEntry>(
  recordings: readonly T[],
  ids: readonly string[]
) {
  const selectedIds = new Set(ids)
  return recordings.filter((recording) => !selectedIds.has(recording.id))
}

export function renameRecordingEntry<T extends RecordingCatalogEntry>(
  recordings: readonly T[],
  id: string,
  name: string
) {
  const normalizedName = name.trim()
  if (!normalizedName) return [...recordings]
  return recordings.map((recording) =>
    recording.id === id ? { ...recording, name: normalizedName } : recording
  )
}

export function toggleRecordingSelection(selectedIds: readonly string[], id: string) {
  return selectedIds.includes(id)
    ? selectedIds.filter((selectedId) => selectedId !== id)
    : [...selectedIds, id]
}

export function retainExistingRecordingSelection<T extends RecordingCatalogEntry>(
  selectedIds: readonly string[],
  recordings: readonly T[]
) {
  const existingIds = new Set(recordings.map((recording) => recording.id))
  return selectedIds.filter((id) => existingIds.has(id))
}

export function encodeRecordingCurve(points: readonly StoredPitchPoint[]): StoredCurvePoint[] {
  return points.map((point) => [point.time, point.midi, point.confidence])
}

export function decodeRecordingCurve(stored: unknown): StoredPitchPoint[] {
  if (!Array.isArray(stored)) return []
  const points: StoredPitchPoint[] = []
  for (const point of stored) {
    if (!Array.isArray(point) || point.length < 3) continue
    const time = Number(point[0])
    const midi = point[1] === null ? null : Number(point[1])
    const confidence = Number(point[2])
    if (
      !Number.isFinite(time) ||
      (midi !== null && !Number.isFinite(midi)) ||
      !Number.isFinite(confidence)
    )
      continue
    points.push({ time, midi, confidence })
  }
  return points
}
