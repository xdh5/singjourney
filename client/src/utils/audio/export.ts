type AudioExportWorker = {
  postMessage: (message: unknown) => void
  onMessage: (callback: (message: AudioExportMessage) => void) => void
  onError?: (callback: () => void) => void
  terminate?: () => void
}

type AudioExportMessage = {
  type?: string
  requestId?: number
  buffer?: ArrayBuffer
  error?: string
}

let activeRequest: Promise<string> | null = null
let nextRequestId = 0
const MP3_EXPORT_TIMEOUT_MS = 3_000

export class AudioExportTimeoutError extends Error {
  constructor() {
    super('MP3 生成超过 3 秒')
    this.name = 'AudioExportTimeoutError'
  }
}

export async function createMp3ExportFile(sourcePath: string) {
  // #ifdef MP-WEIXIN
  if (sourcePath.toLowerCase().endsWith('.mp3')) return sourcePath
  if (activeRequest) return activeRequest
  activeRequest = encodeWavToMp3(sourcePath)
  try {
    return await activeRequest
  } finally {
    activeRequest = null
  }
  // #endif

  // #ifndef MP-WEIXIN
  return sourcePath
  // #endif
}

async function encodeWavToMp3(sourcePath: string) {
  const wxApi = (globalThis as any).wx
  const deadline = Date.now() + MP3_EXPORT_TIMEOUT_MS
  const source = await readFile(sourcePath)
  assertBeforeDeadline(deadline)
  const encoded = await encodeWithWorker(source, deadline)
  assertBeforeDeadline(deadline)
  const targetPath = `${wxApi.env.USER_DATA_PATH}/singjourney-export-${Date.now()}.mp3`
  await new Promise<void>((resolve, reject) => {
    wxApi.getFileSystemManager().writeFile({
      filePath: targetPath,
      data: encoded,
      success: () => resolve(),
      fail: reject
    })
  })
  assertBeforeDeadline(deadline)
  return targetPath
}

function readFile(filePath: string) {
  const wxApi = (globalThis as any).wx
  return new Promise<ArrayBuffer>((resolve, reject) => {
    wxApi.getFileSystemManager().readFile({
      filePath,
      success: (result: { data: ArrayBuffer }) => resolve(result.data),
      fail: reject
    })
  })
}

async function encodeWithWorker(source: ArrayBuffer, deadline: number) {
  const worker = await createExportWorker(deadline)
  const requestId = ++nextRequestId
  return new Promise<ArrayBuffer>((resolve, reject) => {
    let settled = false
    // 总计时包含文件读取和 Worker 槽位等待，超时立即销毁 Worker。
    const remainingTime = Math.max(0, deadline - Date.now())
    const timer = setTimeout(
      () => finish(() => reject(new AudioExportTimeoutError())),
      remainingTime
    )
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate?.()
      callback()
    }
    worker.onMessage((message) => {
      if (message.requestId !== requestId) return
      if (message.type === 'mp3-exported' && message.buffer) finish(() => resolve(message.buffer!))
      else finish(() => reject(new Error(message.error || '导出音频失败')))
    })
    worker.onError?.(() => finish(() => reject(new Error('导出 Worker 运行失败'))))
    worker.postMessage({ type: 'encode-wav-to-mp3', requestId, buffer: source })
  })
}

async function createExportWorker(deadline: number) {
  const wxApi = (globalThis as any).wx
  if (!wxApi?.createWorker) throw new Error('当前设备不支持音频导出')
  const retryDelays = [0, 100, 200, 400, 800]
  let lastError: unknown
  for (const delay of retryDelays) {
    assertBeforeDeadline(deadline)
    if (delay) await wait(Math.min(delay, Math.max(0, deadline - Date.now())))
    assertBeforeDeadline(deadline)
    try {
      return wxApi.createWorker('static/workers/audio-export.js') as AudioExportWorker
    } catch (error) {
      lastError = error
      if (!isWorkerLimitError(error)) throw error
    }
  }
  throw lastError || new Error('导出 Worker 创建失败')
}

function assertBeforeDeadline(deadline: number) {
  if (Date.now() >= deadline) throw new AudioExportTimeoutError()
}

function isWorkerLimitError(error: unknown) {
  const detail =
    typeof error === 'string'
      ? error
      : [(error as any)?.errMsg, (error as any)?.message].filter(Boolean).join(' ')
  return detail.toLowerCase().includes('max concurrent workers')
}

function wait(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}
