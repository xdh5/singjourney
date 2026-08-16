import { wrapPcmAsWav, wrapPcmChunksAsWav } from './wav'

const WAV_FILE_EXTENSION = '.wav'

export async function persistAudio(tempFilePath: string, id: string) {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  const fs = wxApi.getFileSystemManager()
  if (tempFilePath.toLowerCase().endsWith(WAV_FILE_EXTENSION)) {
    const filePath = `${wxApi.env.USER_DATA_PATH}/singjourney-${id}${WAV_FILE_EXTENSION}`
    await new Promise<void>((resolve, reject) => {
      fs.copyFile({
        srcPath: tempFilePath,
        destPath: filePath,
        success: () => resolve(),
        fail: reject
      })
    })
    return filePath
  }
  const pcm = await new Promise<ArrayBuffer>((resolve, reject) => {
    fs.readFile({
      filePath: tempFilePath,
      success: (result: { data: ArrayBuffer }) => resolve(result.data),
      fail: reject
    })
  })
  const filePath = `${wxApi.env.USER_DATA_PATH}/singjourney-${id}.wav`
  await new Promise<void>((resolve, reject) => {
    fs.writeFile({
      filePath,
      data: wrapPcmAsWav(pcm, 16000),
      success: () => resolve(),
      fail: reject
    })
  })
  return filePath
  // #endif

  // #ifndef MP-WEIXIN
  const result = await uni.saveFile({ tempFilePath })
  return result.savedFilePath
  // #endif
}

export async function createPcmPreview(
  pcm: ArrayBuffer | readonly Uint8Array[],
  pcmByteLength?: number
) {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  const filePath = `${wxApi.env.USER_DATA_PATH}/singjourney-preview-${Date.now()}.wav`
  const chunks = pcm instanceof ArrayBuffer ? [new Uint8Array(pcm)] : pcm
  const totalByteLength =
    pcmByteLength ?? (pcm instanceof ArrayBuffer ? pcm.byteLength : sumChunkByteLength(pcm))
  const wrapStartedAt = Date.now()
  const wav = wrapPcmChunksAsWav(chunks, totalByteLength, 16000)
  console.info('[录音诊断] PCM 包装 WAV 完成', {
    elapsedMs: Date.now() - wrapStartedAt,
    pcmByteLength: totalByteLength
  })
  const writeStartedAt = Date.now()
  await new Promise<void>((resolve, reject) => {
    wxApi.getFileSystemManager().writeFile({
      filePath,
      data: wav,
      success: () => resolve(),
      fail: reject
    })
  })
  console.info('[录音诊断] WAV 临时文件写入完成', {
    elapsedMs: Date.now() - writeStartedAt,
    byteLength: wav.byteLength
  })
  return filePath
  // #endif

  // #ifndef MP-WEIXIN
  throw new Error('当前平台不使用 PCM 临时试听')
  // #endif
}

function sumChunkByteLength(chunks: readonly Uint8Array[]) {
  return chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
}

export function deleteTemporaryAudio(filePath: string) {
  if (!filePath) return
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  wxApi.getFileSystemManager().unlink({ filePath, fail: () => {} })
  // #endif

  // #ifdef H5
  if (filePath.startsWith('blob:')) URL.revokeObjectURL(filePath)
  // #endif
}

export function deleteAudio(filePath: string) {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  wxApi.getFileSystemManager().unlink({ filePath, fail: () => {} })
  // #endif

  // #ifndef MP-WEIXIN
  uni.removeSavedFile({ filePath, fail: () => {} })
  // #endif
}
