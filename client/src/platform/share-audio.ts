export type ShareAudioPayload = {
  body: ArrayBuffer | Blob
  byteSize: number
  filename: string
  mimeType: string
}

const SHARE_SAMPLE_RATE = 8000
const SHARE_AUDIO_FILENAME = 'share-preview.wav'
const SHARE_AUDIO_MIME_TYPE = 'audio/wav'

export async function prepareShareAudio(filePath: string, preferredBlob?: Blob): Promise<ShareAudioPayload> {
  // #ifdef H5
  const webBlob: Blob = preferredBlob ?? await fetch(filePath).then(response => response.blob())
  const compressed = await compressWebAudio(webBlob)
  return {
    body: compressed,
    byteSize: compressed.byteLength,
    filename: SHARE_AUDIO_FILENAME,
    mimeType: SHARE_AUDIO_MIME_TYPE
  }
  // #endif

  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  const weixinBody = await new Promise<ArrayBuffer>((resolve, reject) => {
    wxApi.getFileSystemManager().readFile({
      filePath,
      success: (result: { data: ArrayBuffer }) => resolve(result.data),
      fail: reject
    })
  })
  return createCompressedSharePayload(weixinBody)
  // #endif

  // #ifdef APP-PLUS
  const appBody = await readAppFile(filePath)
  return createCompressedSharePayload(appBody)
  // #endif

  throw new Error('当前平台不支持上传分享录音')
}

export async function uploadShareAudio(url: string, headers: Record<string, string>, payload: ShareAudioPayload) {
  // #ifdef H5
  const response = await fetch(url, { method: 'PUT', headers, body: payload.body })
  if (!response.ok) throw new Error(`R2 upload failed: ${response.status}`)
  return undefined
  // #endif

  await new Promise<void>((resolve, reject) => {
    uni.request({
      url,
      method: 'PUT',
      header: headers,
      data: payload.body as ArrayBuffer,
      timeout: 120000,
      success: result => {
        if (result.statusCode >= 200 && result.statusCode < 300) resolve()
        else reject(new Error(`R2 upload failed: ${result.statusCode}`))
      },
      fail: reject
    })
  })
}

function createCompressedSharePayload(wav: ArrayBuffer): ShareAudioPayload {
  const { samples, sampleRate } = readShareSamples(wav)
  const body = createLowBitrateWav(samples, sampleRate, SHARE_SAMPLE_RATE)
  return { body, byteSize: body.byteLength, filename: SHARE_AUDIO_FILENAME, mimeType: SHARE_AUDIO_MIME_TYPE }
}

function readShareSamples(source: ArrayBuffer) {
  try {
    return readMonoSamplesFromWav(source)
  } catch {
    // 微信录音在尚未落盘为 WAV 时会提供原始 16-bit PCM；分享预览同样可直接降采样。
    const pcm = new Int16Array(source)
    const samples = new Float32Array(pcm.length)
    for (let index = 0; index < pcm.length; index += 1) samples[index] = pcm[index] / 32768
    return { samples, sampleRate: 16000 }
  }
}

// #ifdef H5
async function compressWebAudio(source: Blob) {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await source.arrayBuffer())
    return createLowBitrateWav(decoded.getChannelData(0), decoded.sampleRate, SHARE_SAMPLE_RATE)
  } finally {
    await context.close()
  }
}
// #endif

// #ifdef APP-PLUS
function readAppFile(filePath: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const plusApi = (globalThis as any).plus
    plusApi.io.resolveLocalFileSystemURL(filePath, (entry: any) => {
      entry.file((file: any) => {
        const reader = new plusApi.io.FileReader()
        reader.onloadend = (event: { target: { result: string } }) => {
          const base64 = event.target.result.split(',')[1] || ''
          resolve(uni.base64ToArrayBuffer(base64))
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      }, reject)
    }, reject)
  })
}
// #endif
import { createLowBitrateWav, readMonoSamplesFromWav } from '../shared/wav'
