export const RECORDING_TOOL = {
  CLEAR: 'clear',
  PLAY: 'play',
  RECORD: 'record',
  SAVE: 'save',
  SHARE: 'share'
} as const

export type RecordingTool = (typeof RECORDING_TOOL)[keyof typeof RECORDING_TOOL]

export type RecordingToolbarInput = {
  detailMode: boolean
  isRecording: boolean
  hasStarted: boolean
  hasPlayableAudio: boolean
  isSaving: boolean
  isSharing: boolean
}

export type RecordingToolbarState = {
  visibleTools: RecordingTool[]
  clearDisabled: boolean
  playbackDisabled: boolean
  recordDisabled: boolean
  saveDisabled: boolean
  shareDisabled: boolean
  showClear: boolean
  showRecord: boolean
  showSave: boolean
  showShare: boolean
}

/**
 * Keeps every recording toolbar action on one state policy so impossible or
 * concurrent actions cannot be re-enabled by individual pages accidentally.
 */
export function createRecordingToolbarState(input: RecordingToolbarInput): RecordingToolbarState {
  const busy = input.isSaving || input.isSharing
  const showClear = !input.detailMode
  const showRecord = !input.detailMode
  const showSave = !input.detailMode
  const showShare = true
  const visibleTools = [
    showClear && RECORDING_TOOL.CLEAR,
    RECORDING_TOOL.PLAY,
    showRecord && RECORDING_TOOL.RECORD,
    showSave && RECORDING_TOOL.SAVE,
    showShare && RECORDING_TOOL.SHARE
  ].filter((tool): tool is RecordingTool => Boolean(tool))

  return {
    visibleTools,
    clearDisabled: busy || input.isRecording || !input.hasStarted,
    playbackDisabled: busy || input.isRecording || !input.hasPlayableAudio,
    recordDisabled: busy,
    saveDisabled: busy || input.isRecording || !input.hasStarted,
    shareDisabled: busy || input.isRecording || !input.hasPlayableAudio,
    showClear,
    showRecord,
    showSave,
    showShare
  }
}
