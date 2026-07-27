export function wrapPcmAsWav(pcm: ArrayBuffer, sampleRate: number) {
  const wav = new ArrayBuffer(44 + pcm.byteLength)
  const view = new DataView(wav)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.byteLength, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcm.byteLength, true)
  new Uint8Array(wav, 44).set(new Uint8Array(pcm))
  return wav
}

const WAV_RIFF = 'RIFF'
const WAV_FORMAT = 'WAVE'
const WAV_FORMAT_CHUNK = 'fmt '
const WAV_DATA_CHUNK = 'data'
const PCM_FORMAT = 1
const PCM_8_BIT = 8
const PCM_16_BIT = 16
const PCM_8_BIT_MIDPOINT = 128
const PCM_16_BIT_MAXIMUM = 32768
const WAV_HEADER_SIZE = 44

export function createLowBitrateWav(samples: Float32Array, sourceSampleRate: number, targetSampleRate: number) {
  const sampleCount = Math.max(1, Math.floor(samples.length * targetSampleRate / sourceSampleRate))
  const pcm = new Int16Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    const sourceIndex = Math.min(samples.length - 1, Math.floor(index * sourceSampleRate / targetSampleRate))
    const sample = Math.max(-1, Math.min(1, samples[sourceIndex] ?? 0))
    pcm[index] = Math.round(sample * (PCM_16_BIT_MAXIMUM - 1))
  }
  return wrapPcmAsWav(pcm.buffer, targetSampleRate)
}

export function readMonoSamplesFromWav(wav: ArrayBuffer) {
  const view = new DataView(wav)
  if (view.byteLength < WAV_HEADER_SIZE || readAscii(view, 0, 4) !== WAV_RIFF || readAscii(view, 8, 4) !== WAV_FORMAT) {
    throw new Error('Unsupported WAV payload')
  }

  let offset = 12
  let sampleRate = 0
  let channelCount = 0
  let bitDepth = 0
  let dataOffset = 0
  let dataSize = 0
  while (offset + 8 <= view.byteLength) {
    const chunkId = readAscii(view, offset, 4)
    const chunkSize = view.getUint32(offset + 4, true)
    const chunkDataOffset = offset + 8
    if (chunkDataOffset + chunkSize > view.byteLength) break
    if (chunkId === WAV_FORMAT_CHUNK && chunkSize >= 16) {
      if (view.getUint16(chunkDataOffset, true) !== PCM_FORMAT) throw new Error('Unsupported WAV codec')
      channelCount = view.getUint16(chunkDataOffset + 2, true)
      sampleRate = view.getUint32(chunkDataOffset + 4, true)
      bitDepth = view.getUint16(chunkDataOffset + 14, true)
    }
    if (chunkId === WAV_DATA_CHUNK) {
      dataOffset = chunkDataOffset
      dataSize = chunkSize
      break
    }
    offset = chunkDataOffset + chunkSize + (chunkSize % 2)
  }
  if (!sampleRate || !channelCount || !dataOffset || !dataSize || (bitDepth !== PCM_8_BIT && bitDepth !== PCM_16_BIT)) {
    throw new Error('Incomplete WAV payload')
  }

  const bytesPerSample = bitDepth / PCM_8_BIT
  const frameSize = bytesPerSample * channelCount
  const frameCount = Math.floor(dataSize / frameSize)
  const samples = new Float32Array(frameCount)
  for (let frame = 0; frame < frameCount; frame += 1) {
    const sampleOffset = dataOffset + frame * frameSize
    samples[frame] = bitDepth === PCM_8_BIT
      ? (view.getUint8(sampleOffset) - PCM_8_BIT_MIDPOINT) / PCM_8_BIT_MIDPOINT
      : view.getInt16(sampleOffset, true) / PCM_16_BIT_MAXIMUM
  }
  return { samples, sampleRate }
}

function readAscii(view: DataView, offset: number, length: number) {
  let value = ''
  for (let index = 0; index < length; index += 1) value += String.fromCharCode(view.getUint8(offset + index))
  return value
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
