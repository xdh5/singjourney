import Pitchfinder from 'pitchfinder'

export type PitchPoint = {
  time: number
  frequency: number | null
  midi: number | null
  confidence: number
  voiced: boolean
}

export type PitchEngineConfig = {
  sampleRate: number
  bufferSize?: number
  minMidi?: number
  maxMidi?: number
  minRms?: number
  maxMidiJump?: number
  smoothing?: number
  releaseFrames?: number
}

const DEFAULTS = {
  bufferSize: 2048,
  minMidi: 36,
  maxMidi: 84,
  minRms: 0.0008,
  maxMidiJump: 10,
  smoothing: 0.78,
  releaseFrames: 4
}

export class PitchEngine {
  readonly config: Required<PitchEngineConfig>
  private readonly yin: (buffer: Float32Array) => number | null
  private readonly macleod: (buffer: Float32Array) => { probability: number; freq: number }
  private readonly processed: Float32Array
  private lastMidi: number | null = null
  private missedFrames = 0

  constructor(config: PitchEngineConfig) {
    this.config = { ...DEFAULTS, ...config }
    this.processed = new Float32Array(this.config.bufferSize)
    this.yin = Pitchfinder.YIN({
      sampleRate: this.config.sampleRate,
      threshold: 0.18,
      probabilityThreshold: 0.02
    })
    this.macleod = Pitchfinder.Macleod({
      sampleRate: this.config.sampleRate,
      bufferSize: this.config.bufferSize,
      cutoff: 0.82
    })
  }

  reset() {
    this.lastMidi = null
    this.missedFrames = 0
  }

  analyze(samples: Float32Array, time: number): PitchPoint {
    if (samples.length !== this.config.bufferSize) {
      throw new RangeError(`Expected ${this.config.bufferSize} samples, received ${samples.length}`)
    }

    prepareAudioBuffer(samples, this.processed)
    const rms = getRms(this.processed)
    if (rms < this.config.minRms) return this.release(time)

    let frequency = this.yin(this.processed)
    let confidence = frequency ? 1 : 0
    if (!isFrequencyInRange(frequency, this.config.minMidi, this.config.maxMidi)) {
      const result = this.macleod(this.processed)
      frequency = result?.probability >= 0.55 ? result.freq : null
      confidence = result?.probability || 0
    }

    if (!isFrequencyInRange(frequency, this.config.minMidi, this.config.maxMidi) || !frequency) {
      return this.release(time)
    }

    const midi = frequencyToMidi(frequency)
    if (this.lastMidi !== null && Math.abs(midi - this.lastMidi) > this.config.maxMidiJump) {
      return this.release(time, false)
    }

    this.missedFrames = 0
    const smoothedMidi = this.lastMidi === null
      ? midi
      : this.lastMidi * this.config.smoothing + midi * (1 - this.config.smoothing)
    this.lastMidi = smoothedMidi
    return { time, frequency, midi: smoothedMidi, confidence, voiced: true }
  }

  private release(time: number, emitGap = true): PitchPoint {
    this.missedFrames += 1
    if (this.missedFrames >= this.config.releaseFrames) this.lastMidi = null
    return {
      time,
      frequency: null,
      midi: null,
      confidence: 0,
      voiced: false
    }
  }
}

export class AudioFrameAccumulator {
  private readonly buffer: Float32Array
  private length = 0

  constructor(readonly frameSize = 2048) {
    this.buffer = new Float32Array(frameSize)
  }

  push(chunk: Float32Array, onFrame: (frame: Float32Array) => void) {
    let offset = 0
    while (offset < chunk.length) {
      const count = Math.min(this.frameSize - this.length, chunk.length - offset)
      this.buffer.set(chunk.subarray(offset, offset + count), this.length)
      this.length += count
      offset += count
      if (this.length === this.frameSize) {
        onFrame(this.buffer.slice())
        this.length = 0
      }
    }
  }

  reset() {
    this.length = 0
  }
}

export function prepareAudioBuffer(
  source: Float32Array<ArrayBufferLike>,
  target: Float32Array<ArrayBufferLike> = new Float32Array(source.length)
) {
  let mean = 0
  for (const sample of source) mean += sample
  mean /= source.length
  for (let index = 0; index < source.length; index += 1) {
    const centered = source[index] - mean
    target[index] = Math.abs(centered) < 0.002 ? centered * 0.35 : centered
  }
  return target
}

export function getRms(buffer: Float32Array) {
  let sum = 0
  for (const sample of buffer) sum += sample * sample
  return Math.sqrt(sum / buffer.length)
}

export function frequencyToMidi(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440)
}

export function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function midiToPitchClass(midi: number) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return names[((Math.round(midi) % 12) + 12) % 12]
}

export function midiToNoteName(midi: number) {
  const rounded = Math.round(midi)
  return `${midiToPitchClass(rounded)}${Math.floor(rounded / 12) - 1}`
}

function isFrequencyInRange(frequency: number | null | undefined, minMidi: number, maxMidi: number) {
  if (!frequency || !Number.isFinite(frequency)) return false
  const midi = frequencyToMidi(frequency)
  return midi >= minMidi && midi <= maxMidi
}
