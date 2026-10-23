import type { StoredPitchPoint } from '@singjourney/contracts'
import { deleteAudio, persistAudio } from '../audio/files'
import {
  decodeRecordingCurve,
  encodeRecordingCurve,
  prependRecording,
  removeRecordings,
  renameRecordingEntry
} from './catalog'

export type Recording = {
  id: string
  name: string
  duration: number
  audioOffset: number
  audioPath: string
  createdAt: string
  pointCount: number
  points: StoredPitchPoint[]
  recordingType: RecordingType
}

export const RECORDING_TYPE = {
  FREE_RECORDING: 'free-recording',
  ACCOMPANIED_PRACTICE: 'accompanied-practice'
} as const

export type RecordingType = (typeof RECORDING_TYPE)[keyof typeof RECORDING_TYPE]

type LocalRecordingIndexEntry = Omit<Recording, 'points'>
const LOCAL_RECORDING_INDEX_KEY = 'singjourney-recordings.index'
const LOCAL_RECORDING_CURVE_KEY_PREFIX = 'singjourney-recordings.curve.'
const RECORDING_SEQUENCE_SUFFIX = /\s+\((\d+)\)$/

export async function listRecordings(): Promise<Recording[]> {
  return readLocalRecordingIndex().map((recording) => ({ ...recording, points: [] }))
}

export async function getRecording(id: string) {
  const recording = readLocalRecordingIndex().find((item) => item.id === id)
  if (!recording) return undefined
  return { ...recording, points: readLocalRecordingCurve(id) }
}

export async function storeRecording(input: {
  recording: Omit<Recording, 'audioPath'>
  tempFilePath: string
}) {
  const audioPath = await persistAudio(input.tempFilePath, input.recording.id)
  const recording: Recording = { ...input.recording, audioPath }
  const { points, ...indexEntry } = recording
  const current = readLocalRecordingIndex()
  uni.setStorageSync(localRecordingCurveKey(recording.id), encodeRecordingCurve(points))
  uni.setStorageSync(LOCAL_RECORDING_INDEX_KEY, prependRecording(current, indexEntry))
  return recording
}

export async function getPlaybackSource(recording: Recording) {
  return recording.audioPath
}

export async function removeRecording(ids: string | readonly string[]) {
  const requestedIds = typeof ids === 'string' ? [ids] : ids
  const uniqueIds = [...new Set(requestedIds)]
  if (uniqueIds.length === 0) return

  const current = readLocalRecordingIndex()
  const selectedIds = new Set(uniqueIds)
  current
    .filter((recording) => selectedIds.has(recording.id))
    .forEach((recording) => deleteAudio(recording.audioPath))
  uniqueIds.forEach((id) => uni.removeStorageSync(localRecordingCurveKey(id)))
  uni.setStorageSync(LOCAL_RECORDING_INDEX_KEY, removeRecordings(current, uniqueIds))
}

export async function renameRecording(id: string, name: string) {
  const normalizedName = name.trim()
  if (!normalizedName) return

  const current = readLocalRecordingIndex()
  uni.setStorageSync(LOCAL_RECORDING_INDEX_KEY, renameRecordingEntry(current, id, normalizedName))
}

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`
}

export function recordingBaseName(name: string, fallback: string) {
  const normalized = name.replace(RECORDING_SEQUENCE_SUFFIX, '').trim()
  return normalized || fallback
}

export function formatSequentialRecordingName(baseName: string, sequence: number) {
  return `${baseName} (${sequence})`
}

export function recordingDisplayName(recording: Pick<Recording, 'name'>, fallback: string) {
  return recording.name.trim() || fallback
}

export function nextRecordingName(
  recordings: Recording[],
  baseName: string,
  recordingType?: RecordingType
) {
  const matchingRecordings = recordings.filter((recording) => {
    if (recordingType) {
      return recording.recordingType === recordingType
    }
    return recordingBaseName(recording.name, baseName) === baseName
  })
  const highestStoredSequence = matchingRecordings.reduce((highest, recording) => {
    const sequence = Number(recording.name.match(RECORDING_SEQUENCE_SUFFIX)?.[1] ?? 0)
    return Math.max(highest, sequence)
  }, 0)
  return formatSequentialRecordingName(baseName, highestStoredSequence + 1)
}

function readLocalRecordingIndex(): LocalRecordingIndexEntry[] {
  const stored = uni.getStorageSync(LOCAL_RECORDING_INDEX_KEY)
  return Array.isArray(stored) ? stored : []
}

function readLocalRecordingCurve(id: string): StoredPitchPoint[] {
  return decodeRecordingCurve(uni.getStorageSync(localRecordingCurveKey(id)))
}

function localRecordingCurveKey(id: string) {
  return `${LOCAL_RECORDING_CURVE_KEY_PREFIX}${id}`
}
