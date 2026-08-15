import { wrapPcmAsWav, wrapPcmChunksAsWav } from './wav'

const MP3_FILE_EXTENSION = '.mp3'
const TEMPORARY_MP3_FILE_PREFIX = 'singjourney-recording'
const TEMPORARY_MP3_PREVIEW_PREFIX = 'singjourney-preview'

export async function persistAudio(tempFilePath: string, id: string) {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  const fs = wxApi.getFileSystemManager()
  if (tempFilePath.toLowerCase().endsWith(MP3_FILE_EXTENSION)) {
    const filePath = `${wxApi.env.USER_DATA_PATH}/singjourney-${id}${MP3_FILE_EXTENSION}`
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

export async function createTemporaryMp3(sessionId: string) {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  const filePath = `${wxApi.env.USER_DATA_PATH}/${TEMPORARY_MP3_FILE_PREFIX}-${sessionId}${MP3_FILE_EXTENSION}`
  await new Promise<void>((resolve, reject) => {
    wxApi
      .getFileSystemManager()
      .writeFile({ filePath, data: new ArrayBuffer(0), success: () => resolve(), fail: reject })
  })
  return filePath
  // #endif

  // #ifndef MP-WEIXIN
  throw new Error('当前平台不使用微信 MP3 临时文件')
  // #endif
}

export async function appendTemporaryAudio(filePath: string, data: ArrayBuffer) {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  await new Promise<void>((resolve, reject) => {
    wxApi
      .getFileSystemManager()
      .appendFile({ filePath, data, success: () => resolve(), fail: reject })
  })
  return
  // #endif

  // #ifndef MP-WEIXIN
  void filePath
  void data
  throw new Error('当前平台不使用微信音频分块写入')
  // #endif
}

export async function createTemporaryMp3Preview(sourcePath: string, previewId: string) {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  const filePath = `${wxApi.env.USER_DATA_PATH}/${TEMPORARY_MP3_PREVIEW_PREFIX}-${previewId}${MP3_FILE_EXTENSION}`
  await new Promise<void>((resolve, reject) => {
    wxApi
      .getFileSystemManager()
      .copyFile({ srcPath: sourcePath, destPath: filePath, success: () => resolve(), fail: reject })
  })
  return filePath
  // #endif

  // #ifndef MP-WEIXIN
  void sourcePath
  void previewId
  throw new Error('当前平台不使用微信 MP3 试听快照')
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
  await new Promise<void>((resolve, reject) => {
    wxApi.getFileSystemManager().writeFile({
      filePath,
      data: wrapPcmChunksAsWav(chunks, totalByteLength, 16000),
      success: () => resolve(),
      fail: reject
    })
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
