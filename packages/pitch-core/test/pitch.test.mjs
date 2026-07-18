import assert from 'node:assert/strict'
import test from 'node:test'
import { PitchEngine, frequencyToMidi, midiToFrequency } from '../dist/index.js'

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
