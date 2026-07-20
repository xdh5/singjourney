type ExportAudioInput = {
  filePath: string
  name: string
}

export async function exportAudio(input: ExportAudioInput) {
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
  return
  // #endif

  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  await new Promise<void>((resolve, reject) => {
    wxApi.shareFileMessage({
      filePath: input.filePath,
      fileName: `${safeFileName(input.name)}${extensionFromPath(input.filePath)}`,
      success: () => resolve(),
      fail: reject
    })
  })
  return
  // #endif

  // #ifdef APP-PLUS
  await new Promise<void>((resolve, reject) => {
    ;(uni as any).shareWithSystem({
      type: 'audio',
      audioPaths: [input.filePath],
      success: () => resolve(),
      fail: reject
    })
  })
  // #endif
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
  return value.replace(/[\\/:*?"<>|]/g, '-').trim() || '声迹录音'
}
