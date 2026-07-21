import { wrapPcmAsWav } from '../shared/wav'

export async function persistAudio(tempFilePath: string, id: string) {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  const fs = wxApi.getFileSystemManager()
  const pcm = await new Promise<ArrayBuffer>((resolve, reject) => {
    fs.readFile({ filePath: tempFilePath, success: (result: { data: ArrayBuffer }) => resolve(result.data), fail: reject })
  })
  const filePath = `${wxApi.env.USER_DATA_PATH}/singjourney-${id}.wav`
  await new Promise<void>((resolve, reject) => {
    fs.writeFile({ filePath, data: wrapPcmAsWav(pcm, 16000), success: () => resolve(), fail: reject })
  })
  return filePath
  // #endif

  // #ifndef MP-WEIXIN
  const result = await uni.saveFile({ tempFilePath })
  return result.savedFilePath
  // #endif
}

export async function createPcmPreview(pcm: ArrayBuffer) {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  const filePath = `${wxApi.env.USER_DATA_PATH}/singjourney-preview-${Date.now()}.wav`
  await new Promise<void>((resolve, reject) => {
    wxApi.getFileSystemManager().writeFile({
      filePath,
      data: wrapPcmAsWav(pcm, 16000),
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
