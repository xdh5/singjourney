export type RecorderStopResult = {
  tempFilePath: string
  blob?: Blob
}

export type RecorderEvents = {
  onStart?: () => void
  onFrame?: (buffer: ArrayBuffer | Float32Array, sampleRate?: number) => void
  onStop?: (result: RecorderStopResult) => void
  onError?: (message: string) => void
}

let events: RecorderEvents = {}
let appPlatform = false
let webPlatform = false

// #ifdef APP-PLUS
appPlatform = true
// #endif

// #ifdef H5
webPlatform = true
// #endif

const manager = webPlatform ? null : (uni as any).getRecorderManager()

manager?.onStart(() => events.onStart?.())
manager?.onFrameRecorded?.((result: { frameBuffer: ArrayBuffer }) => events.onFrame?.(result.frameBuffer))
manager?.onStop((result: RecorderStopResult) => events.onStop?.(result))
manager?.onError((error: { errMsg?: string }) => events.onError?.(error.errMsg || '录音失败'))

let webStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let webAudioContext: AudioContext | null = null
let webAudioSource: MediaStreamAudioSourceNode | null = null
let webAnalyser: AnalyserNode | null = null
let webFrameRequest = 0
let lastWebAnalysisAt = 0
let webChunks: Blob[] = []

const WEB_RECORDING_SLICE_MS = 250
const WEB_ANALYSIS_INTERVAL_MS = 90
const ANALYSIS_SAMPLE_RATE = 16000
const DEFAULT_ANALYSIS_FRAME_SIZE = 1024
const WEB_ANALYSIS_FRAME_SIZE = 2048

export const recorderAnalysisConfig = {
  sampleRate: ANALYSIS_SAMPLE_RATE,
  frameSize: webPlatform ? WEB_ANALYSIS_FRAME_SIZE : DEFAULT_ANALYSIS_FRAME_SIZE
}

export const recorderCapabilities = {
  realtimeFrames: !appPlatform,
  pause: !appPlatform
}

export function connectRecorder(nextEvents: RecorderEvents) {
  events = nextEvents
  return () => { events = {} }
}

export async function requestMicrophonePermission() {
  if (webPlatform) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('web microphone unavailable')
    webStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    })
    return
  }
  // #ifdef MP-WEIXIN
  await uni.authorize({ scope: 'scope.record' })
  // #endif
}

export async function startRecorder() {
  if (webPlatform) {
    await startWebRecorder()
    return
  }
  if (appPlatform) {
    manager.start({ duration: 600000, sampleRate: 16000, format: 'wav' })
    return
  }
  manager.start({
    duration: 600000,
    sampleRate: 16000,
    numberOfChannels: 1,
    encodeBitRate: 96000,
    format: 'PCM',
    frameSize: 1
  })
}

export function pauseRecorder() {
  if (webPlatform) {
    mediaRecorder?.pause()
    stopWebFrames()
    return
  }
  manager.pause()
}

export async function createPausedRecorderPreview(): Promise<RecorderStopResult | null> {
  if (!webPlatform || !mediaRecorder) return null
  if (mediaRecorder.state === 'recording') await waitForWebRecorderPause(mediaRecorder)
  if (mediaRecorder.state !== 'paused') return null
  await flushWebRecorderData()
  const mimeType = mediaRecorder.mimeType || 'audio/webm'
  const blob = new Blob(webChunks, { type: mimeType })
  if (blob.size === 0) return null
  return { tempFilePath: URL.createObjectURL(blob), blob }
}

export function resumeRecorder() {
  if (webPlatform) {
    mediaRecorder?.resume()
    startWebFrames()
    return
  }
  manager.resume()
}

export function stopRecorder() {
  if (webPlatform) {
    stopWebFrames()
    mediaRecorder?.stop()
    return
  }
  manager.stop()
}

async function startWebRecorder() {
  if (!webStream) await requestMicrophonePermission()
  if (!webStream) throw new Error('无法打开麦克风')
  webChunks = []
  const mimeType = chooseMimeType()
  mediaRecorder = mimeType ? new MediaRecorder(webStream, { mimeType }) : new MediaRecorder(webStream)
  mediaRecorder.ondataavailable = event => {
    if (event.data.size > 0) webChunks.push(event.data)
  }
  mediaRecorder.onerror = () => events.onError?.('录音失败')
  mediaRecorder.onstop = () => {
    const blob = new Blob(webChunks, { type: mediaRecorder?.mimeType || mimeType || 'audio/webm' })
    stopWebAudio()
    events.onStop?.({ tempFilePath: URL.createObjectURL(blob), blob })
  }
  webAudioContext = new AudioContext()
  if (webAudioContext.state === 'suspended') await webAudioContext.resume()
  webAudioSource = webAudioContext.createMediaStreamSource(webStream)
  webAnalyser = webAudioContext.createAnalyser()
  webAnalyser.fftSize = WEB_ANALYSIS_FRAME_SIZE
  webAnalyser.smoothingTimeConstant = 0
  webAudioSource.connect(webAnalyser)
  mediaRecorder.start(WEB_RECORDING_SLICE_MS)
  startWebFrames()
  events.onStart?.()
}

function startWebFrames() {
  stopWebFrames()
  if (!webAnalyser || !webAudioContext) return
  const samples = new Float32Array(webAnalyser.fftSize)
  const analyzeFrame = (timestamp: number) => {
    if (!webAnalyser || !webAudioContext) {
      webFrameRequest = 0
      return
    }
    if (timestamp - lastWebAnalysisAt >= WEB_ANALYSIS_INTERVAL_MS) {
      lastWebAnalysisAt = timestamp
      webAnalyser.getFloatTimeDomainData(samples)
      events.onFrame?.(samples, webAudioContext.sampleRate)
    }
    webFrameRequest = requestAnimationFrame(analyzeFrame)
  }
  webFrameRequest = requestAnimationFrame(analyzeFrame)
}

function stopWebFrames() {
  if (webFrameRequest) cancelAnimationFrame(webFrameRequest)
  webFrameRequest = 0
  lastWebAnalysisAt = 0
}

function stopWebAudio() {
  stopWebFrames()
  webAudioContext?.close()
  webAudioContext = null
  webAudioSource = null
  webAnalyser = null
  webStream?.getTracks().forEach(track => track.stop())
  webStream = null
  mediaRecorder = null
}

function flushWebRecorderData() {
  return new Promise<void>(resolve => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve()
      return
    }
    const recorder = mediaRecorder
    const handleData = () => {
      recorder.removeEventListener('dataavailable', handleData)
      resolve()
    }
    recorder.addEventListener('dataavailable', handleData)
    recorder.requestData()
  })
}

function waitForWebRecorderPause(recorder: MediaRecorder) {
  if (recorder.state === 'paused') return Promise.resolve()
  return new Promise<void>(resolve => {
    const handlePause = () => {
      recorder.removeEventListener('pause', handlePause)
      resolve()
    }
    recorder.addEventListener('pause', handlePause)
  })
}

function chooseMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || ''
}
