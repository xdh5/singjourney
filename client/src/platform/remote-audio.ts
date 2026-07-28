export async function downloadRemoteAudioForPlayback(url: string) {
  // #ifdef H5
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Remote audio download failed: ${response.status}`)
  return URL.createObjectURL(await response.blob())
  // #endif

  // #ifndef H5
  const result = await uni.downloadFile({ url })
  if (result.statusCode < 200 || result.statusCode >= 300 || !result.tempFilePath) {
    throw new Error(`Remote audio download failed: ${result.statusCode}`)
  }
  return result.tempFilePath
  // #endif
}
