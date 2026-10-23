import { MAX_RECORDING_DURATION_SECONDS } from '@singjourney/contracts'

export type RecorderStopResult = {
  tempFilePath: string
}

export type RecorderEvents = {
  onStart?: () => void
  onFrame?: (buffer: ArrayBuffer | Float32Array, sampleRate?: number) => void
  onStop?: (result: RecorderStopResult) => void
  onError?: (message: string, error?: unknown) => void
}

let events: RecorderEvents = {}

const manager = (uni as any).getRecorderManager()
let recorderResumeRequestedAt = 0
let lastRecorderCommand = '初始化'
let lastRecorderCommandAt = Date.now()

manager?.onStart(() => events.onStart?.())
manager?.onFrameRecorded?.((result: { frameBuffer: ArrayBuffer }) => {
  if (recorderResumeRequestedAt) {
    console.info('[录音诊断] RecorderManager.resume 后收到首帧 PCM', {
      elapsedMs: Date.now() - recorderResumeRequestedAt,
      byteLength: result.frameBuffer.byteLength
    })
    recorderResumeRequestedAt = 0
  }
  events.onFrame?.(result.frameBuffer)
})
manager?.onStop((result: RecorderStopResult) => events.onStop?.(result))
manager?.onError((error: { errMsg?: string; [key: string]: unknown }) => {
  const message = error?.errMsg || '录音失败'
  if (lastRecorderCommand === 'pause' && message.toLowerCase().includes('not recording')) {
    console.warn('[录音诊断] 忽略切后台后的重复暂停错误', {
      message,
      elapsedSinceCommandMs: Date.now() - lastRecorderCommandAt,
      rawError: error
    })
    return
  }
  console.error('[录音错误] RecorderManager.onError', {
    message,
    lastCommand: lastRecorderCommand,
    elapsedSinceCommandMs: Date.now() - lastRecorderCommandAt,
    rawError: error
  })
  events.onError?.(message, error)
})

const ANALYSIS_SAMPLE_RATE = 16000
const DEFAULT_ANALYSIS_FRAME_SIZE = 1024
const MAX_RECORDING_DURATION_MS = MAX_RECORDING_DURATION_SECONDS * 1000

export const recorderAnalysisConfig = {
  sampleRate: ANALYSIS_SAMPLE_RATE,
  frameSize: DEFAULT_ANALYSIS_FRAME_SIZE
}

export const recorderCapabilities = {
  realtimeFrames: true,
  pause: true,
  capturesPcmFrames: true
}

export function connectRecorder(nextEvents: RecorderEvents) {
  events = nextEvents
  return () => {
    events = {}
  }
}

export async function requestMicrophonePermission() {
  await uni.authorize({ scope: 'scope.record' })
}

export async function startRecorder() {
  markRecorderCommand('start')
  manager.start({
    duration: MAX_RECORDING_DURATION_MS,
    sampleRate: 16000,
    numberOfChannels: 1,
    encodeBitRate: 96000,
    format: 'PCM',
    frameSize: 1,
    // 自动选择手机、线控耳机或蓝牙耳机麦克风，禁止固定到机身麦克风。
    audioSource: 'auto'
  })
}

export function pauseRecorder() {
  console.info('[录音诊断] 调用 RecorderManager.pause')
  markRecorderCommand('pause')
  manager.pause()
}

export function resumeRecorder() {
  recorderResumeRequestedAt = Date.now()
  console.info('[录音诊断] 调用 RecorderManager.resume')
  markRecorderCommand('resume')
  manager.resume()
  setTimeout(() => {
    if (recorderResumeRequestedAt)
      console.warn('[录音诊断] RecorderManager.resume 500ms 后仍未收到 PCM 首帧')
  }, 500)
  setTimeout(() => {
    if (recorderResumeRequestedAt)
      console.error('[录音诊断] RecorderManager.resume 1500ms 后仍未收到 PCM 首帧')
  }, 1500)
}

export function stopRecorder() {
  markRecorderCommand('stop')
  manager.stop()
}

function markRecorderCommand(command: string) {
  lastRecorderCommand = command
  lastRecorderCommandAt = Date.now()
}
