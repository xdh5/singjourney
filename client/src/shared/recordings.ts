import type { StoredPitchPoint } from '@singjourney/contracts'
import { deleteAudio, persistAudio } from '../platform/audio-files'

export type Recording = {
  id: string
  name: string
  duration: number
  audioPath: string
  createdAt: string
  pointCount: number
  points: StoredPitchPoint[]
}

type StoredWebRecording = Recording & { audio: Blob }

const STORAGE_KEY = 'singjourney-recordings-v2'
const WEB_DB_NAME = 'singjourney-unified-recordings'
const WEB_STORE = 'recordings'
let webPlatform = false

// #ifdef H5
webPlatform = true
// #endif

export async function listRecordings(): Promise<Recording[]> {
  if (webPlatform) {
    const records = await webGetAll()
    return records.map(({ audio: _audio, ...recording }) => recording)
  }
  const value = uni.getStorageSync(STORAGE_KEY)
  return Array.isArray(value) ? value : []
}

export async function getRecording(id: string) {
  const recordings = await listRecordings()
  return recordings.find(recording => recording.id === id)
}

export async function storeRecording(input: {
  recording: Omit<Recording, 'audioPath'>
  tempFilePath: string
  blob?: Blob
}) {
  if (webPlatform) {
    if (!input.blob) throw new Error('录音数据不存在')
    const recording: Recording = { ...input.recording, audioPath: `indexeddb:${input.recording.id}` }
    await webPut({ ...recording, audio: input.blob })
    return recording
  }
  const audioPath = await persistAudio(input.tempFilePath, input.recording.id)
  const recording: Recording = { ...input.recording, audioPath }
  const current = await listRecordings()
  uni.setStorageSync(STORAGE_KEY, [recording, ...current])
  return recording
}

export async function getPlaybackSource(recording: Recording) {
  if (!webPlatform) return recording.audioPath
  const stored = await webGet(recording.id)
  if (!stored) throw new Error('录音不存在')
  return URL.createObjectURL(stored.audio)
}

export async function removeRecording(id: string) {
  if (webPlatform) {
    await webDelete(id)
    return
  }
  const current = await listRecordings()
  const target = current.find(item => item.id === id)
  if (target) deleteAudio(target.audioPath)
  uni.setStorageSync(STORAGE_KEY, current.filter(item => item.id !== id))
}

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

export function formatRecordingName(date: Date, prefix: string) {
  return `${prefix} ${formatRecordingTimestamp(date)}`
}

export function formatRecordingTimestamp(date: Date) {
  const part = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}`
}

function openWebDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(WEB_DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(WEB_STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('无法打开本地录音库'))
  })
}

async function webGetAll() {
  const database = await openWebDatabase()
  const value = await requestResult(database.transaction(WEB_STORE).objectStore(WEB_STORE).getAll()) as StoredWebRecording[]
  database.close()
  return value.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

async function webGet(id: string) {
  const database = await openWebDatabase()
  const value = await requestResult(database.transaction(WEB_STORE).objectStore(WEB_STORE).get(id)) as StoredWebRecording | undefined
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

async function webDelete(id: string) {
  const database = await openWebDatabase()
  const transaction = database.transaction(WEB_STORE, 'readwrite')
  transaction.objectStore(WEB_STORE).delete(id)
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
