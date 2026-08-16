import { i18n } from '../i18n'
import { AudioExportTimeoutError, createMp3ExportFile } from './audio/export'

export type ExportAudioInput = {
  filePath: string
  name: string
}

export type ExportAudioResult = 'exported' | 'cancelled'

export type PreparedAudioExport = {
  sourcePath: string
  filePath: string
  fileName: string
  format: 'mp3' | 'wav' | 'source'
}

export function createAudioExportSession() {
  let preparedKey = ''
  let prepared: PreparedAudioExport | null = null
  return {
    isPrepared(key: string) {
      return Boolean(prepared && preparedKey === key)
    },
    async run(
      input: ExportAudioInput & { key: string }
    ): Promise<ExportAudioResult> {
      if (!prepared || preparedKey !== input.key) {
        prepared = await prepareAudioExport(input)
        preparedKey = input.key
      }
      return await confirmAudioExport(prepared)
    },
    reset() {
      preparedKey = ''
      prepared = null
    }
  }
}

export async function prepareAudioExport(
  input: ExportAudioInput
): Promise<PreparedAudioExport> {
  let exportPath = input.filePath
  let format: PreparedAudioExport['format'] = 'source'

  // #ifdef MP-WEIXIN
  try {
    exportPath = await createMp3ExportFile(input.filePath)
    format = exportPath.toLowerCase().endsWith('.mp3') ? 'mp3' : 'source'
  } catch (error) {
    if (!(error instanceof AudioExportTimeoutError)) throw error
    // 3 秒仍未完成时不再等待，直接使用录音产生的原始 WAV。
    exportPath = input.filePath
    format = 'wav'
  }
  // #endif

  return {
    sourcePath: input.filePath,
    filePath: exportPath,
    fileName: `${safeFileName(input.name)}${format === 'mp3' ? '.mp3' : extensionFromPath(input.filePath)}`,
    format
  }
}

function confirmAudioExport(prepared: PreparedAudioExport): Promise<ExportAudioResult> {
  const action = exportAction()
  const actionName = i18n.global.t(`record.${action === 'share' ? 'startShare' : 'startDownload'}`)
  const contentKey = prepared.format === 'wav' ? 'record.exportReadyWav' : 'record.exportReady'
  // 小程序端在工具函数中调用全局 i18n 时不会稳定处理命名插值，显式替换避免显示占位符。
  const content = i18n.global.t(contentKey).replace('{action}', actionName)

  return new Promise<ExportAudioResult>((resolve, reject) => {
    uni.showModal({
      title: i18n.global.t('record.exportReadyTitle'),
      content,
      confirmText: actionName,
      cancelText: i18n.global.t('account.cancel'),
      success: (result) => {
        if (!result.confirm) {
          resolve('cancelled')
          return
        }
        // 系统分享必须由确认按钮直接触发，这里不能在调用前再 await。
        performPreparedAudioExport(prepared).then(resolve).catch(reject)
      },
      fail: reject
    })
  })
}

function exportAction(): 'share' | 'download' {
  // #ifdef H5
  return 'download'
  // #endif

  // #ifndef H5
  return 'share'
  // #endif
}

function performPreparedAudioExport(
  prepared: PreparedAudioExport
): Promise<ExportAudioResult> {
  // #ifdef H5
  const link = document.createElement('a')
  link.href = prepared.filePath
  link.download = prepared.fileName
  link.click()
  return Promise.resolve('exported')
  // #endif

  // #ifdef MP-WEIXIN
  return sharePreparedAudio(prepared)
  // #endif

  // #ifdef APP-PLUS
  return new Promise<ExportAudioResult>((resolve, reject) => {
    ;(uni as any).shareWithSystem({
      type: 'audio',
      audioPaths: [prepared.filePath],
      success: () => resolve('exported'),
      fail: (error: unknown) => {
        if (isExportCancellation(error)) resolve('cancelled')
        else reject(error)
      }
    })
  })
  // #endif
}

export function sharePreparedAudio(prepared: PreparedAudioExport): Promise<ExportAudioResult> {
  const wxApi = (globalThis as any).wx
  return new Promise<ExportAudioResult>((resolve, reject) => {
    // shareFileMessage 必须在用户点击回调内立即调用，调用前不能再等待转码。
    wxApi.shareFileMessage({
      filePath: prepared.filePath,
      fileName: prepared.fileName,
      success: () => resolve('exported'),
      fail: (error: unknown) => {
        if (isExportCancellation(error)) resolve('cancelled')
        else reject(error)
      }
    })
  })
}

export async function exportAudio(input: ExportAudioInput): Promise<ExportAudioResult> {
  return await confirmAudioExport(await prepareAudioExport(input))
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
