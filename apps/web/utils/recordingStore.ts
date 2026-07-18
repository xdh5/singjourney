import type { RecordingMetadata, StoredPitchPoint } from '@tone/contracts'

type RecordingPayload = {
  id: string
  audio: Blob
  points: StoredPitchPoint[]
}

export type LocalRecording = RecordingMetadata & Omit<RecordingPayload, 'id'>

const DB_NAME = 'tone-local'
const DB_VERSION = 1
const META_STORE = 'recordings'
const PAYLOAD_STORE = 'recording-data'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
      if (!db.objectStoreNames.contains(PAYLOAD_STORE)) {
        db.createObjectStore(PAYLOAD_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('无法打开本地录音库'))
  })
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
    transaction.onerror = () => reject(transaction.error || new Error('本地存储事务失败'))
    transaction.onabort = () => reject(transaction.error || new Error('本地存储事务已取消'))
  })
}

export async function saveLocalRecording(input: {
  name: string
  duration: number
  mimeType: string
  audio: Blob
  points: StoredPitchPoint[]
}) {
  const db = await openDatabase()
  const now = new Date().toISOString()
  const metadata: RecordingMetadata = {
    id: crypto.randomUUID(),
    name: input.name,
    duration: input.duration,
    mimeType: input.mimeType,
    size: input.audio.size,
    createdAt: now,
    updatedAt: now,
    pointCount: input.points.length
  }
  const transaction = db.transaction([META_STORE, PAYLOAD_STORE], 'readwrite')
  transaction.objectStore(META_STORE).put(metadata)
  transaction.objectStore(PAYLOAD_STORE).put({ id: metadata.id, audio: input.audio, points: input.points })
  await transactionDone(transaction)
  db.close()
  return metadata
}

export async function listLocalRecordings() {
  const db = await openDatabase()
  const items = await requestResult(db.transaction(META_STORE).objectStore(META_STORE).getAll()) as RecordingMetadata[]
  db.close()
  return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export async function getLocalRecording(id: string): Promise<LocalRecording | null> {
  const db = await openDatabase()
  const transaction = db.transaction([META_STORE, PAYLOAD_STORE])
  const metadataPromise = requestResult(transaction.objectStore(META_STORE).get(id)) as Promise<RecordingMetadata | undefined>
  const payloadPromise = requestResult(transaction.objectStore(PAYLOAD_STORE).get(id)) as Promise<RecordingPayload | undefined>
  const [metadata, payload] = await Promise.all([metadataPromise, payloadPromise])
  db.close()
  if (!metadata || !payload) return null
  return { ...metadata, audio: payload.audio, points: payload.points }
}

export async function renameLocalRecording(id: string, name: string) {
  const db = await openDatabase()
  const transaction = db.transaction(META_STORE, 'readwrite')
  const store = transaction.objectStore(META_STORE)
  const metadata = await requestResult(store.get(id)) as RecordingMetadata | undefined
  if (!metadata) {
    transaction.abort()
    db.close()
    throw new Error('录音不存在')
  }
  const updated = { ...metadata, name, updatedAt: new Date().toISOString() }
  store.put(updated)
  await transactionDone(transaction)
  db.close()
  return updated
}

export async function deleteLocalRecording(id: string) {
  const db = await openDatabase()
  const transaction = db.transaction([META_STORE, PAYLOAD_STORE], 'readwrite')
  transaction.objectStore(META_STORE).delete(id)
  transaction.objectStore(PAYLOAD_STORE).delete(id)
  await transactionDone(transaction)
  db.close()
}
