export type ShareAudioPayload = {
  body: ArrayBuffer | Blob
  byteSize: number
  filename: string
  mimeType: string
}

const MIME_BY_SUFFIX: Record<string, string> = {
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  webm: 'audio/webm'
}

export async function prepareShareAudio(filePath: string, preferredBlob?: Blob): Promise<ShareAudioPayload> {
  const filename = fileNameFromPath(filePath)

  // #ifdef H5
  const webBlob: Blob = preferredBlob ?? await fetch(filePath).then(response => response.blob())
  return {
    body: webBlob,
    byteSize: webBlob.size,
    filename,
    mimeType: webBlob.type || mimeTypeFromPath(filename)
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
  return { body: weixinBody, byteSize: weixinBody.byteLength, filename, mimeType: mimeTypeFromPath(filename) }
  // #endif

  // #ifdef APP-PLUS
  const appBody = await readAppFile(filePath)
  return { body: appBody, byteSize: appBody.byteLength, filename, mimeType: mimeTypeFromPath(filename) }
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

function fileNameFromPath(filePath: string) {
  const cleanPath = filePath.split(/[?#]/)[0]
  const candidate = cleanPath.split('/').pop() || 'recording.wav'
  return candidate.includes('.') ? candidate : `${candidate}.wav`
}

function mimeTypeFromPath(filename: string) {
  const suffix = filename.split('.').pop()?.toLowerCase() || 'wav'
  return MIME_BY_SUFFIX[suffix] || 'audio/wav'
}

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
