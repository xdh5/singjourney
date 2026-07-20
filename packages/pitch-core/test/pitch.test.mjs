import assert from 'node:assert/strict'
import test from 'node:test'
import { PitchEngine, frequencyToMidi, midiToFrequency, pcm16ToFloat32 } from '../dist/index.js'

test('frequency and midi conversion round trips', () => {
  assert.ok(Math.abs(frequencyToMidi(440) - 69) < 0.0001)
  assert.ok(Math.abs(midiToFrequency(69) - 440) < 0.0001)
})

test('detects a 440 Hz sine wave', () => {
  const sampleRate = 48000
  const size = 2048
  const samples = Float32Array.from({ length: size }, (_, index) => Math.sin(2 * Math.PI * 440 * index / sampleRate) * 0.5)
  const point = new PitchEngine({ sampleRate, bufferSize: size }).analyze(samples, 0)
  assert.equal(point.voiced, true)
  assert.ok(point.midi !== null && Math.abs(point.midi - 69) < 0.2)
})

test('Macleod primary detector finds a C5 fundamental', () => {
  const sampleRate = 48000
  const size = 2048
  const frequency = 523.251
  const samples = Float32Array.from({ length: size }, (_, index) => {
    const phase = 2 * Math.PI * frequency * index / sampleRate
    return Math.sin(phase) * 0.55 + Math.sin(phase * 2) * 0.3 + Math.sin(phase * 3) * 0.15
  })
  const point = new PitchEngine({
    sampleRate,
    bufferSize: size,
    primaryDetector: 'macleod',
    fallbackDetector: false
  }).analyze(samples, 0)
  assert.equal(point.voiced, true)
  assert.ok(point.midi !== null && Math.abs(point.midi - 72) < 0.2)
})

test('shared YIN-first WeChat worker configuration finds C5 at 16 kHz', () => {
  const sampleRate = 16000
  const size = 1024
  const frequency = 523.251
  const pcm = new ArrayBuffer(size * 2)
  const view = new DataView(pcm)
  for (let index = 0; index < size; index += 1) {
    const phase = 2 * Math.PI * frequency * index / sampleRate
    const sample = Math.sin(phase) * 0.55 + Math.sin(phase * 2) * 0.3 + Math.sin(phase * 3) * 0.15
    view.setInt16(index * 2, Math.round(sample * 32767), true)
  }
  const point = new PitchEngine({
    sampleRate,
    bufferSize: size,
    primaryDetector: 'yin',
    fallbackDetector: true
  }).analyze(pcm16ToFloat32(pcm), 0)
  assert.equal(point.voiced, true)
  assert.ok(point.midi !== null && Math.abs(point.midi - 72) < 0.2)
})
