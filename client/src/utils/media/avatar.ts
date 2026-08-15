const AVATAR_QUALITY = 72

export async function avatarFileToDataUrl(sourcePath: string) {
  const compressedPath = await compressAvatar(sourcePath)
  const base64 = await readFileAsBase64(compressedPath)
  return `data:${resolveMimeType(compressedPath)};base64,${base64}`
}

function compressAvatar(sourcePath: string) {
  return new Promise<string>((resolve) => {
    uni.compressImage({
      src: sourcePath,
      quality: AVATAR_QUALITY,
      success: (result) => resolve(result.tempFilePath),
      fail: () => resolve(sourcePath)
    })
  })
}

function readFileAsBase64(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const fileSystem = uni.getFileSystemManager?.()
    if (!fileSystem) {
      reject(new Error('File system is unavailable'))
      return
    }
    fileSystem.readFile({
      filePath,
      encoding: 'base64',
      success: (result) =>
        typeof result.data === 'string'
          ? resolve(result.data)
          : reject(new Error('Avatar encoding failed')),
      fail: reject
    })
  })
}

function resolveMimeType(filePath: string) {
  const normalized = filePath.toLowerCase()
  if (normalized.endsWith('.png')) return 'image/png'
  if (normalized.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}
