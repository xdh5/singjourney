import { AudioFrameAccumulator, PitchEngine, pcm16ToFloat32 } from '@singjourney/pitch-core'
import { Mp3Encoder } from '@breezystack/lamejs'

const SAMPLE_RATE = 16000
const FRAME_SIZE = 1024
const PRIMARY_DETECTOR = 'yin'
const MP3_CHANNEL_COUNT = 1
const MP3_BIT_RATE_KBPS = 32
const MP3_EMIT_THRESHOLD_BYTES = 16 * 1024

let engine = createEngine()
const accumulator = new AudioFrameAccumulator(FRAME_SIZE)
let mp3Encoder = null
let mp3Chunks = []
let mp3ByteLength = 0
let recordingSessionId = 0

function createEngine() {
  return new PitchEngine({
    sampleRate: SAMPLE_RATE,
    bufferSize: FRAME_SIZE,
    primaryDetector: PRIMARY_DETECTOR,
    fallbackDetector: true
  })
}

worker.onMessage((message) => {
  if (message.type === 'reset') {
    resetProcessor()
    worker.postMessage({ type: 'reset' })
    return
  }
  if (message.type === 'start-recording') {
    resetProcessor()
    recordingSessionId = message.sessionId
    try {
      mp3Encoder = new Mp3Encoder(MP3_CHANNEL_COUNT, SAMPLE_RATE, MP3_BIT_RATE_KBPS)
      worker.postMessage({ type: 'mp3-ready', sessionId: recordingSessionId })
    } catch {
      mp3Encoder = null
      worker.postMessage({ type: 'mp3-error', sessionId: recordingSessionId })
    }
    return
  }
  if (message.type === 'drain-mp3') {
    emitMp3Chunks()
    worker.postMessage({
      type: 'mp3-drained',
      sessionId: recordingSessionId,
      requestId: message.requestId
    })
    return
  }
  if (message.type === 'disable-mp3') {
    mp3Encoder = null
    mp3Chunks = []
    mp3ByteLength = 0
    return
  }
  if (message.type === 'finalize-mp3') {
    try {
      if (mp3Encoder) queueMp3Chunk(mp3Encoder.flush())
      emitMp3Chunks()
      mp3Encoder = null
      worker.postMessage({
        type: 'mp3-finalized',
        sessionId: recordingSessionId,
        requestId: message.requestId
      })
    } catch {
      mp3Encoder = null
      worker.postMessage({
        type: 'mp3-error',
        sessionId: recordingSessionId,
        requestId: message.requestId
      })
    }
    return
  }
  if (message.type !== 'analyze' || !message.buffer) return

  const pcm = new Int16Array(message.buffer)
  if (mp3Encoder) {
    try {
      queueMp3Chunk(mp3Encoder.encodeBuffer(pcm))
    } catch {
      mp3Encoder = null
      mp3Chunks = []
      mp3ByteLength = 0
      worker.postMessage({ type: 'mp3-error', sessionId: recordingSessionId })
    }
  }
  let result = null
  accumulator.push(pcm16ToFloat32(message.buffer), (frame) => {
    result = engine.analyze(frame, message.time)
  })
  worker.postMessage({
    type: 'pitch-result',
    result: result ?? {
      time: message.time,
      frequency: null,
      midi: null,
      confidence: 0,
      voiced: false
    }
  })
})

function resetProcessor() {
  engine.reset()
  accumulator.reset()
  mp3Encoder = null
  mp3Chunks = []
  mp3ByteLength = 0
  recordingSessionId = 0
}

function queueMp3Chunk(chunk) {
  if (!chunk?.byteLength) return
  const copy = new Uint8Array(chunk)
  mp3Chunks.push(copy)
  mp3ByteLength += copy.byteLength
  if (mp3ByteLength >= MP3_EMIT_THRESHOLD_BYTES) emitMp3Chunks()
}

function emitMp3Chunks() {
  if (mp3ByteLength === 0) return
  const output = new Uint8Array(mp3ByteLength)
  let offset = 0
  for (const chunk of mp3Chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  mp3Chunks = []
  mp3ByteLength = 0
  worker.postMessage({ type: 'mp3-chunk', sessionId: recordingSessionId, buffer: output.buffer })
}
