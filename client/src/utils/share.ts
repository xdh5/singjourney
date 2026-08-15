type ExportAudioInput = {
  filePath: string
  name: string
}

export type ExportAudioResult = 'exported' | 'cancelled'

export async function exportAudio(input: ExportAudioInput): Promise<ExportAudioResult> {
  // #ifdef H5
  const response = await fetch(input.filePath)
  const blob = await response.blob()
  const extension = extensionForMimeType(blob.type)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFileName(input.name)}.${extension}`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'exported' as const
  // #endif

  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  return await new Promise<ExportAudioResult>((resolve, reject) => {
    wxApi.shareFileMessage({
      filePath: input.filePath,
      fileName: `${safeFileName(input.name)}${extensionFromPath(input.filePath)}`,
      success: () => resolve('exported'),
      fail: (error: unknown) => {
        if (isExportCancellation(error)) resolve('cancelled')
        else reject(error)
      }
    })
  })
  // #endif

  // #ifdef APP-PLUS
  return await new Promise<ExportAudioResult>((resolve, reject) => {
    ;(uni as any).shareWithSystem({
      type: 'audio',
      audioPaths: [input.filePath],
      success: () => resolve('exported'),
      fail: (error: unknown) => {
        if (isExportCancellation(error)) resolve('cancelled')
        else reject(error)
      }
    })
  })
  // #endif
}

export function isExportCancellation(error: unknown) {
  if (!error) return false
  if (typeof error === 'object' && (error as any).name === 'AbortError') return true
  const detail =
    typeof error === 'string'
      ? error
      : [(error as any).errMsg, (error as any).message, (error as any).reason, (error as any).code]
          .filter(Boolean)
          .join(' ')
  const normalized = detail.toLowerCase()
  return normalized.includes('cancel') || normalized.includes('取消')
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes('mp4') || mimeType.includes('aac')) return 'm4a'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

function extensionFromPath(filePath: string) {
  const match = filePath.match(/\.[a-z0-9]+$/i)
  return match?.[0] || '.wav'
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').trim() || '声刻度录音'
}

export function hidePageShareMenu() {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  wxApi?.hideShareMenu?.({ menus: ['shareAppMessage', 'shareTimeline'] })
  // #endif
}
