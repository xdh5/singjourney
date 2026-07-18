export type WxRecording = {
  id: string
  name: string
  duration: number
  audioPath: string
  pointsPath: string
  createdAt: string
  pointCount: number
  size: number
}

const STORAGE_KEY = 'tone-recordings-v1'

export function listRecordings(): WxRecording[] {
  const value = wx.getStorageSync(STORAGE_KEY)
  return Array.isArray(value) ? value : []
}

export function addRecording(recording: WxRecording) {
  wx.setStorageSync(STORAGE_KEY, [recording, ...listRecordings()])
}

export function removeRecording(id: string) {
  const target = listRecordings().find(item => item.id === id)
  if (target) {
    const fs = wx.getFileSystemManager()
    fs.unlink({ filePath: target.audioPath, fail: () => {} })
    fs.unlink({ filePath: target.pointsPath, fail: () => {} })
  }
  wx.setStorageSync(STORAGE_KEY, listRecordings().filter(item => item.id !== id))
}

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}
