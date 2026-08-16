import { PitchEngine, pcm16ToFloat32 } from '@singjourney/pitch-core'

const SAMPLE_RATE = 16000
// 512 点在 16kHz 下覆盖约 32ms，最低 C3 仍包含约 4 个完整周期。
// 相比 1024 点可显著降低 YIN 的计算量，避免实时曲线等待 Worker。
const FRAME_SIZE = 512

let engine = createEngine()
const analysisWindow = new Float32Array(FRAME_SIZE)
let analysisWindowLength = 0

function createEngine() {
  return new PitchEngine({
    sampleRate: SAMPLE_RATE,
    bufferSize: FRAME_SIZE,
    primaryDetector: 'yin',
    fallbackDetector: true
  })
}

worker.onMessage((message) => {
  if (message.type === 'reset') {
    engine.reset()
    analysisWindow.fill(0)
    analysisWindowLength = 0
    worker.postMessage({ type: 'reset' })
    return
  }
  if (message.type !== 'analyze' || !message.buffer) return

  const receivedAt = Date.now()
  const samples = pcm16ToFloat32(message.buffer)
  appendLatestSamples(samples)
  // 音高代表整个分析窗口，时间应落在窗口中心，而不是 Worker 返回时刻。
  const analysisTime = Math.max(0, message.time - FRAME_SIZE / SAMPLE_RATE / 2)
  const result =
    analysisWindowLength === FRAME_SIZE ? engine.analyze(analysisWindow, analysisTime) : null
  const finishedAt = Date.now()
  worker.postMessage({
    type: 'pitch-result',
    result: result ?? {
      time: analysisTime,
      frequency: null,
      midi: null,
      confidence: 0,
      voiced: false
    },
    timing: {
      requestId: message.requestId,
      sentAt: message.sentAt,
      dispatchedAt: message.dispatchedAt,
      receivedAt,
      finishedAt,
      bufferByteLength: message.buffer.byteLength
    }
  })
})

function appendLatestSamples(samples) {
  if (samples.length >= FRAME_SIZE) {
    analysisWindow.set(samples.subarray(samples.length - FRAME_SIZE))
    analysisWindowLength = FRAME_SIZE
    return
  }

  const overflow = Math.max(0, analysisWindowLength + samples.length - FRAME_SIZE)
  if (overflow > 0) {
    analysisWindow.copyWithin(0, overflow, analysisWindowLength)
    analysisWindowLength -= overflow
  }
  analysisWindow.set(samples, analysisWindowLength)
  analysisWindowLength += samples.length
}
