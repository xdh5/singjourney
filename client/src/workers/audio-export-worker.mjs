import { createMp3Encoder } from 'wasm-media-encoders'

const MP3_BIT_RATE_KBPS = 32
const PCM_CHUNK_SIZE = 1152

worker.onMessage(async (message) => {
  if (message?.type !== 'encode-wav-to-mp3' || !message.buffer) return
  try {
    const { samples, sampleRate } = readMonoPcmWav(message.buffer)
    ensureWeixinWasmRuntime()
    const encoder = await createMp3Encoder()
    encoder.configure({
      channels: 1,
      sampleRate,
      outputSampleRate: sampleRate,
      bitrate: MP3_BIT_RATE_KBPS
    })
    const chunks = []
    let totalByteLength = 0
    for (let offset = 0; offset < samples.length; offset += PCM_CHUNK_SIZE) {
      const encoded = encoder.encode([samples.subarray(offset, offset + PCM_CHUNK_SIZE)])
      if (!encoded.byteLength) continue
      const copied = new Uint8Array(encoded)
      chunks.push(copied)
      totalByteLength += copied.byteLength
    }
    const finalChunk = encoder.finalize()
    if (finalChunk.byteLength) {
      const copied = new Uint8Array(finalChunk)
      chunks.push(copied)
      totalByteLength += copied.byteLength
    }
    const output = new Uint8Array(totalByteLength)
    let outputOffset = 0
    for (const chunk of chunks) {
      output.set(chunk, outputOffset)
      outputOffset += chunk.byteLength
    }
    worker.postMessage({ type: 'mp3-exported', requestId: message.requestId, buffer: output.buffer })
  } catch (error) {
    worker.postMessage({
      type: 'mp3-export-failed',
      requestId: message.requestId,
      error: serializeError(error)
    })
  }
})

function ensureWeixinWasmRuntime() {
  const wasmRuntime = globalThis.WebAssembly || globalThis.WXWebAssembly
  if (!wasmRuntime) throw new Error('当前微信基础库不支持 WXWebAssembly')
  if (globalThis.WebAssembly?.__singjourneyWeixinAdapter) return

  // wasm-media-encoders 传入内存 ArrayBuffer，而 WXWebAssembly 只接受代码包内文件路径。
  // 保留微信运行时的其他能力，仅把 instantiate 适配到已提取的 MP3 WASM 文件。
  const adapter = Object.create(wasmRuntime)
  adapter.instantiate = async (_binary, imports) => {
    const candidatePaths = [
      'static/wasm/mp3-encoder.wasm',
      '/static/wasm/mp3-encoder.wasm'
    ]
    let lastError
    for (const path of candidatePaths) {
      try {
        return await wasmRuntime.instantiate(path, imports)
      } catch (error) {
        lastError = error
      }
    }
    throw new Error(
      `WXWebAssembly 加载失败，已尝试 ${candidatePaths.join('、')}；${serializeError(lastError)}`
    )
  }
  adapter.instantiateStreaming = undefined
  adapter.__singjourneyWeixinAdapter = true
  globalThis.WebAssembly = adapter
  // 依赖会先经过 fetch 分支再调用 instantiate，这里的内容会被适配器忽略。
  if (typeof globalThis.fetch !== 'function')
    globalThis.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(0) })
}

function serializeError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error || '未知错误')
}

function readMonoPcmWav(buffer) {
  const view = new DataView(buffer)
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE')
    throw new Error('不是 WAV 文件')
  let offset = 12
  let sampleRate = 0
  let dataOffset = 0
  let dataSize = 0
  while (offset + 8 <= view.byteLength) {
    const chunkId = readAscii(view, offset, 4)
    const chunkSize = view.getUint32(offset + 4, true)
    const chunkDataOffset = offset + 8
    if (chunkDataOffset + chunkSize > view.byteLength) break
    if (chunkId === 'fmt ') {
      if (
        view.getUint16(chunkDataOffset, true) !== 1 ||
        view.getUint16(chunkDataOffset + 2, true) !== 1 ||
        view.getUint16(chunkDataOffset + 14, true) !== 16
      )
        throw new Error('不支持的 WAV 格式')
      sampleRate = view.getUint32(chunkDataOffset + 4, true)
    }
    if (chunkId === 'data') {
      dataOffset = chunkDataOffset
      dataSize = chunkSize
      break
    }
    offset = chunkDataOffset + chunkSize + (chunkSize % 2)
  }
  if (!sampleRate || !dataOffset || !dataSize) throw new Error('WAV 数据不完整')
  const sampleCount = Math.floor(dataSize / 2)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1)
    samples[index] = view.getInt16(dataOffset + index * 2, true) / 32768
  return { samples, sampleRate }
}

function readAscii(view, offset, length) {
  let value = ''
  for (let index = 0; index < length; index += 1)
    value += String.fromCharCode(view.getUint8(offset + index))
  return value
}
