import {
  appendTemporaryAudio,
  createTemporaryMp3,
  createTemporaryMp3Preview,
  deleteTemporaryAudio
} from './files'

type WorkerPort = {
  postMessage: (message: unknown) => void
}

type EncoderOptions = {
  enabled: () => boolean
  worker: () => WorkerPort | null
  requestTimeoutMs?: number
}

type EncoderMessage = {
  type?: string
  sessionId?: number
  requestId?: number
  buffer?: ArrayBuffer
}

export function createRecordingAudioEncoder(options: EncoderOptions) {
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000
  let path = ''
  let sessionId = 0
  let active = false
  let failed = false
  let writeQueue = Promise.resolve()
  let requestId = 0
  let previewRevision = 0
  const requests = new Map<
    number,
    {
      resolve: (success: boolean) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()

  function handles(message: EncoderMessage) {
    return typeof message.type === 'string' && message.type.startsWith('mp3-')
  }

  function handleMessage(message: EncoderMessage) {
    if (!handles(message)) return false
    if (message.type === 'mp3-chunk') queueChunk(message)
    if (message.type === 'mp3-ready' && message.sessionId === sessionId) active = true
    if (message.type === 'mp3-drained' || message.type === 'mp3-finalized')
      void settleRequest(message)
    if (message.type === 'mp3-error') {
      fail(message.sessionId)
      if (message.requestId) resolveRequest(message.requestId, false)
    }
    return true
  }

  async function start() {
    if (!options.enabled() || !options.worker()) return false
    discard()
    const nextSessionId = ++sessionId
    try {
      path = await createTemporaryMp3(String(nextSessionId))
      active = true
      failed = false
      writeQueue = Promise.resolve()
      options.worker()?.postMessage({ type: 'start-recording', sessionId: nextSessionId })
      return true
    } catch {
      fail(nextSessionId)
      return false
    }
  }

  function needsFallbackPcm() {
    return !active || failed
  }

  async function createPreview() {
    if (!options.enabled() || !active || !path) return null
    const drained = await request('drain-mp3')
    if (!drained) return null
    return createTemporaryMp3Preview(path, `${sessionId}-${++previewRevision}`)
  }

  async function finalize(fallbackPath: string) {
    if (!options.enabled() || !active || !path) {
      discard()
      return fallbackPath
    }
    const finalized = await request('finalize-mp3')
    if (!finalized) {
      discard()
      return fallbackPath
    }
    const encodedPath = path
    path = ''
    active = false
    deleteTemporaryAudio(fallbackPath)
    return encodedPath
  }

  function release(filePath: string) {
    if (filePath === path) path = ''
  }

  function fail(currentSessionId?: number) {
    if (!options.enabled() || (currentSessionId && currentSessionId !== sessionId)) return
    failed = true
    active = false
    try {
      options.worker()?.postMessage({ type: 'disable-mp3', sessionId })
    } catch {
      // Worker 不可用时，保留录音器原生停止文件作为回退。
    }
    for (const id of requests.keys()) resolveRequest(id, false)
  }

  function discard() {
    if (!options.enabled()) return
    for (const id of requests.keys()) resolveRequest(id, false)
    const discardedPath = path
    const pendingWrites = writeQueue
    path = ''
    active = false
    failed = false
    writeQueue = Promise.resolve()
    if (discardedPath) void pendingWrites.finally(() => deleteTemporaryAudio(discardedPath))
  }

  function queueChunk(message: EncoderMessage) {
    if (
      !active ||
      failed ||
      message.sessionId !== sessionId ||
      !(message.buffer instanceof ArrayBuffer) ||
      !path
    )
      return
    const targetPath = path
    writeQueue = writeQueue
      .then(() => appendTemporaryAudio(targetPath, message.buffer as ArrayBuffer))
      .catch(() => fail(message.sessionId))
  }

  async function settleRequest(message: EncoderMessage) {
    if (message.sessionId !== sessionId || !message.requestId) return
    await writeQueue
    resolveRequest(message.requestId, !failed)
  }

  function request(type: 'drain-mp3' | 'finalize-mp3') {
    const worker = options.worker()
    if (!active || failed || !worker) return Promise.resolve(false)
    const nextRequestId = ++requestId
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        requests.delete(nextRequestId)
        fail(sessionId)
        resolve(false)
      }, requestTimeoutMs)
      requests.set(nextRequestId, { resolve, timer })
      try {
        worker.postMessage({ type, requestId: nextRequestId, sessionId })
      } catch {
        resolveRequest(nextRequestId, false)
        fail(sessionId)
      }
    })
  }

  function resolveRequest(id: number, success: boolean) {
    const pending = requests.get(id)
    if (!pending) return
    clearTimeout(pending.timer)
    requests.delete(id)
    pending.resolve(success)
  }

  return { createPreview, discard, fail, finalize, handleMessage, needsFallbackPcm, release, start }
}
