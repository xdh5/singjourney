import { PitchEngine } from '@singjourney/pitch-core'

const FRAME_SIZE = 2048

let engineSampleRate = 0
let engine: PitchEngine | null = null

function getEngine(sampleRate: number) {
  if (!engine || engineSampleRate !== sampleRate) {
    engineSampleRate = sampleRate
    engine = new PitchEngine({ sampleRate, bufferSize: FRAME_SIZE })
  }
  return engine
}

globalThis.onmessage = (event: MessageEvent) => {
  const message = event.data
  if (message?.type === 'reset') {
    engine?.reset()
    globalThis.postMessage({ type: 'reset' })
    return
  }
  if (message?.type !== 'analyze' || !(message.buffer instanceof Float32Array)) return

  const result = getEngine(message.sampleRate).analyze(message.buffer, message.time)
  globalThis.postMessage(result)
}

