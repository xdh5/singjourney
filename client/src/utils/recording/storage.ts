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
  audioPath: string
  createdAt: string
  pointCount: number
  points: StoredPitchPoint[]
  recordingType?: RecordingType
}

export const RECORDING_TYPE = {
  FREE_RECORDING: 'free-recording',
  ACCOMPANIED_PRACTICE: 'accompanied-practice'
} as const

export type RecordingType = (typeof RECORDING_TYPE)[keyof typeof RECORDING_TYPE]

type StoredWebRecording = Recording & { audio: Blob }

type LocalRecordingIndexEntry = Omit<Recording, 'points'>
const LEGACY_STORAGE_KEY = 'singjourney-recordings-v2'
const LEGACY_LOCAL_RECORDING_INDEX_KEY = 'singjourney-recordings-v3.index'
const LOCAL_RECORDING_INDEX_KEY = 'singjourney-recordings-v4.index'
const LOCAL_RECORDING_CURVE_KEY_PREFIX = 'singjourney-recordings-v3.curve.'
const WEB_DATABASE_VERSION = 2
const WEB_DB_NAME = 'singjourney-unified-recordings'
const WEB_STORE = 'recordings'
const RECORDING_SEQUENCE_SUFFIX = /\s+\((\d+)\)$/
const LEGACY_RECORDING_TIMESTAMP_SUFFIX = /\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/
let webPlatform = false

// #ifdef H5
webPlatform = true
// #endif

export async function listRecordings(): Promise<Recording[]> {
  if (webPlatform) {
    const records = await webGetAll()
    return records.map(({ audio: _audio, ...recording }) => recording)
  }
  return readLocalRecordingIndex().map((recording) => ({ ...recording, points: [] }))
}

export async function getRecording(id: string) {
  if (!webPlatform) {
    const recording = readLocalRecordingIndex().find((item) => item.id === id)
    if (!recording) return undefined
    return { ...recording, points: readLocalRecordingCurve(id) }
  }
  const recordings = await listRecordings()
  return recordings.find((recording) => recording.id === id)
}

export async function storeRecording(input: {
  recording: Omit<Recording, 'audioPath'>
  tempFilePath: string
  blob?: Blob
}) {
  if (webPlatform) {
    if (!input.blob) throw new Error('录音数据不存在')
    const recording: Recording = {
      ...input.recording,
      audioPath: `indexeddb:${input.recording.id}`
    }
    await webPut({ ...recording, audio: input.blob })
    return recording
  }
  const audioPath = await persistAudio(input.tempFilePath, input.recording.id)
  const recording: Recording = { ...input.recording, audioPath }
  const { points, ...indexEntry } = recording
  const current = readLocalRecordingIndex()
  uni.setStorageSync(localRecordingCurveKey(recording.id), encodeRecordingCurve(points))
  uni.setStorageSync(LOCAL_RECORDING_INDEX_KEY, prependRecording(current, indexEntry))
  return recording
}

export async function getPlaybackSource(recording: Recording) {
  if (!webPlatform) return recording.audioPath
  const stored = await webGet(recording.id)
  if (!stored) throw new Error('录音不存在')
  return URL.createObjectURL(stored.audio)
}

export async function removeRecording(ids: string | readonly string[]) {
  const requestedIds = typeof ids === 'string' ? [ids] : ids
  const uniqueIds = [...new Set(requestedIds)]
  if (uniqueIds.length === 0) return
  if (webPlatform) {
    await webDeleteMany(uniqueIds)
    return
  }
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
  if (webPlatform) {
    const recording = await webGet(id)
    if (!recording) return
    await webPut({ ...recording, name: normalizedName })
    return
  }
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
  const normalized = name
    .replace(RECORDING_SEQUENCE_SUFFIX, '')
    .replace(LEGACY_RECORDING_TIMESTAMP_SUFFIX, '')
    .trim()
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
      const storedType = recording.recordingType ?? RECORDING_TYPE.FREE_RECORDING
      return storedType === recordingType
    }
    return recordingBaseName(recording.name, baseName) === baseName
  })
  const highestStoredSequence = matchingRecordings.reduce((highest, recording) => {
    const sequence = Number(recording.name.match(RECORDING_SEQUENCE_SUFFIX)?.[1] ?? 0)
    return Math.max(highest, sequence)
  }, 0)
  return formatSequentialRecordingName(baseName, highestStoredSequence + 1)
}

function openWebDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(WEB_DB_NAME, WEB_DATABASE_VERSION)
    request.onupgradeneeded = (event) => {
      const database = request.result
      const store = database.objectStoreNames.contains(WEB_STORE)
        ? request.transaction!.objectStore(WEB_STORE)
        : database.createObjectStore(WEB_STORE, { keyPath: 'id' })
      if ((event.oldVersion || 0) < WEB_DATABASE_VERSION) migrateWebRecordingNames(store)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('无法打开本地录音库'))
  })
}

async function webGetAll() {
  const database = await openWebDatabase()
  const value = (await requestResult(
    database.transaction(WEB_STORE).objectStore(WEB_STORE).getAll()
  )) as StoredWebRecording[]
  database.close()
  return value.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

async function webGet(id: string) {
  const database = await openWebDatabase()
  const value = (await requestResult(
    database.transaction(WEB_STORE).objectStore(WEB_STORE).get(id)
  )) as StoredWebRecording | undefined
  database.close()
  return value
}

async function webPut(recording: StoredWebRecording) {
  const database = await openWebDatabase()
  const transaction = database.transaction(WEB_STORE, 'readwrite')
  transaction.objectStore(WEB_STORE).put(recording)
  await transactionDone(transaction)
  database.close()
}

async function webDeleteMany(ids: readonly string[]) {
  const database = await openWebDatabase()
  const transaction = database.transaction(WEB_STORE, 'readwrite')
  const store = transaction.objectStore(WEB_STORE)
  ids.forEach((id) => store.delete(id))
  await transactionDone(transaction)
  database.close()
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('本地存储操作失败'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('本地存储操作失败'))
    transaction.onabort = () => reject(transaction.error || new Error('本地存储操作已取消'))
  })
}

function readLocalRecordingIndex(): LocalRecordingIndexEntry[] {
  const stored = uni.getStorageSync(LOCAL_RECORDING_INDEX_KEY)
  if (Array.isArray(stored)) return stored
  const previousIndex = uni.getStorageSync(LEGACY_LOCAL_RECORDING_INDEX_KEY)
  if (Array.isArray(previousIndex)) {
    const migrated = previousIndex.map(migrateStoredRecordingName) as LocalRecordingIndexEntry[]
    uni.setStorageSync(LOCAL_RECORDING_INDEX_KEY, migrated)
    uni.removeStorageSync(LEGACY_LOCAL_RECORDING_INDEX_KEY)
    return migrated
  }
  return migrateLegacyLocalRecordings()
}

function migrateLegacyLocalRecordings(): LocalRecordingIndexEntry[] {
  const legacy = uni.getStorageSync(LEGACY_STORAGE_KEY)
  if (!Array.isArray(legacy)) {
    uni.setStorageSync(LOCAL_RECORDING_INDEX_KEY, [])
    return []
  }
  const index = legacy.map((recording: Recording) => {
    const points = Array.isArray(recording.points) ? recording.points : []
    uni.setStorageSync(localRecordingCurveKey(recording.id), encodeRecordingCurve(points))
    const { points: _points, ...entry } = recording
    return migrateStoredRecordingName(entry) as LocalRecordingIndexEntry
  })
  uni.setStorageSync(LOCAL_RECORDING_INDEX_KEY, index)
  uni.removeStorageSync(LEGACY_STORAGE_KEY)
  return index
}

function migrateStoredRecordingName(recording: Record<string, unknown>) {
  const legacyCustomName =
    typeof recording.customName === 'string' ? recording.customName.trim() : ''
  const storedName = typeof recording.name === 'string' ? recording.name.trim() : ''
  const { customName: _legacyCustomName, ...current } = recording
  return { ...current, name: legacyCustomName || storedName }
}

function migrateWebRecordingNames(store: IDBObjectStore) {
  const request = store.openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    cursor.update(migrateStoredRecordingName(cursor.value as Record<string, unknown>))
    cursor.continue()
  }
}

function readLocalRecordingCurve(id: string): StoredPitchPoint[] {
  return decodeRecordingCurve(uni.getStorageSync(localRecordingCurveKey(id)))
}

function localRecordingCurveKey(id: string) {
  return `${LOCAL_RECORDING_CURVE_KEY_PREFIX}${id}`
}
