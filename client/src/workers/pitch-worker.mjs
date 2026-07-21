import { AudioFrameAccumulator, PitchEngine, pcm16ToFloat32 } from '@singjourney/pitch-core'

const SAMPLE_RATE = 16000
const FRAME_SIZE = 1024
const PRIMARY_DETECTOR = 'yin'

let engine = createEngine()
const accumulator = new AudioFrameAccumulator(FRAME_SIZE)

function createEngine() {
  return new PitchEngine({
    sampleRate: SAMPLE_RATE,
    bufferSize: FRAME_SIZE,
    primaryDetector: PRIMARY_DETECTOR,
    fallbackDetector: true
  })
}

worker.onMessage(message => {
  if (message.type === 'reset') {
    engine.reset()
    accumulator.reset()
    worker.postMessage({ type: 'reset' })
    return
  }
  if (message.type !== 'analyze' || !message.buffer) return

  let result = null
  accumulator.push(pcm16ToFloat32(message.buffer), frame => {
    result = engine.analyze(frame, message.time)
  })
  worker.postMessage(result ?? {
    time: message.time,
    frequency: null,
    midi: null,
    confidence: 0,
    voiced: false
  })
})
