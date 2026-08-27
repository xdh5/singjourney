<template>
  <view class="page">
    <app-navbar title-key="home.appTitle" />
    <view
      class="pitch-stage"
      :style="{ height: `${canvasHeight}px` }"
      @touchstart="startPitchDrag"
      @touchmove.stop.prevent="movePitchDrag"
      @touchend="endPitchDrag"
      @touchcancel="endPitchDrag"
      @mousedown="startPitchDrag"
      @mousemove.stop.prevent="movePitchDrag"
      @mouseup="endPitchDrag"
      @mouseleave="endPitchDrag"
    >
      <canvas
        id="pitchCanvas"
        canvas-id="pitchCanvas"
        type="2d"
        class="pitch-canvas"
        disable-scroll
        :style="{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }"
      />

      <recording-mode-tag :label="recordingModeLabel" />
    </view>

    <view class="time-bar">{{ timeLabel }}</view>

    <recording-toolbar
      :height="toolbarHeight"
      :safe-bottom="safeBottom"
      :clear-label="t('record.clear')"
      :play-label="isPlaying ? t('record.pause') : t('record.play')"
      :record-label="recordLabel"
      :save-label="saving ? t('record.saving') : t('record.save')"
      :share-label="sharing ? t('record.generating') : t('record.share')"
      :is-playing="isPlaying"
      :is-recording="isRecording"
      :clear-disabled="toolbarState.clearDisabled"
      :playback-disabled="toolbarState.playbackDisabled"
      :record-disabled="toolbarState.recordDisabled"
      :save-disabled="toolbarState.saveDisabled"
      :share-disabled="toolbarState.shareDisabled"
      :show-record="toolbarState.showRecord"
      :show-clear="toolbarState.showClear"
      :show-save="toolbarState.showSave"
      :show-share="toolbarState.showShare"
      :detail-mode="recordingDetailMode"
      @clear="clearRecording"
      @play="togglePlayback"
      @record="toggleRecording"
      @save="saveRecording"
      @share="shareRecording"
    />
    <voiceprint-consent-sheet
      :visible="voiceprintConsentVisible"
      @agree="acceptVoiceprintConsent"
      @decline="declineVoiceprintConsent"
      @open="openVoiceprintAgreement"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { onHide, onLoad, onReady, onShow, onUnload } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import AppNavbar from '../../components/app-navbar.vue'
import RecordingToolbar from '../../components/recording-toolbar.vue'
import RecordingModeTag from '../../components/recording-mode-tag.vue'
import VoiceprintConsentSheet from '../../components/voiceprint-consent-sheet.vue'
import {
  MAX_RECORDING_DURATION_SECONDS,
  RECORDING_DURATION_WARNING_AT_SECONDS,
  type StoredPitchPoint
} from '@singjourney/contracts'
import {
  formatTime,
  getPlaybackSource,
  getRecording,
  listRecordings,
  nextRecordingName,
  recordingDisplayName,
  RECORDING_TYPE,
  storeRecording
} from '../../utils/recording/storage'
import {
  createAudioExportSession,
  hidePageShareMenu
} from '../../utils/share'
import { createAudibleAudioPlayer } from '../../utils/audio/player'
import { createPitchCanvasSurface } from '../../utils/pitch/canvas'
import { createPcmPreview, deleteTemporaryAudio } from '../../utils/audio/files'
import { createPcmBuffer } from '../../utils/audio/pcm-buffer'
import { getWindowMetrics } from '../../utils/window-metrics'
import { createLivePitchAnalysis } from '../../utils/pitch/live-analysis'
import {
  calculateLivePitchCanvasLayout,
  LIVE_PITCH_AXIS_WIDTH,
  LIVE_PITCH_DIRECT_RENDER_INTERVAL_MS,
  LIVE_PITCH_COMMAND_RENDER_INTERVAL_MS,
  LIVE_PITCH_PCM_RENDER_INTERVAL_MS,
  LIVE_PITCH_ROW_HEIGHT,
  LIVE_PITCH_PIXELS_PER_SECOND
} from '../../utils/pitch/layout'
import {
  createLivePitchVisualClock,
  drawLivePitchCurve,
  drawLivePitchPlayhead,
  LIVE_PITCH_PLAYHEAD_RATIO,
  LIVE_PITCH_RENDER_DELAY_SECONDS,
  PLAYBACK_OUTPUT_DELAY_SECONDS
} from '../../utils/pitch/live-curve'
import { setPageTitle } from '../../i18n'
import {
  drawPitchAxis,
  drawPitchGrid,
  PITCH_MAXIMUM_MIDI,
  PITCH_MINIMUM_MIDI
} from '../../utils/pitch/renderer'
import { createRecordingToolbarState } from '../../utils/recording/toolbar-state'
import {
  canReuseRecordingPlaybackSource,
  createRecordingPlaybackSourceSession,
  invalidateRecordingPlaybackSource,
  markRecordingPlaybackSourceLoaded
} from '../../utils/recording/playback-session'
import {
  connectRecorder,
  createPausedRecorderPreview,
  pauseRecorder,
  recorderAnalysisConfig,
  recorderCapabilities,
  requestMicrophonePermission,
  resumeRecorder,
  startRecorder,
  stopRecorder
} from '../../utils/audio/recorder'
import {
  keepScreenAwakeWhilePageOpen,
  keepScreenAwakeWhileRecording,
  releasePageScreenAwake,
  releaseRecordingScreenAwake
} from '../../utils/recording/screen-awake'
import {
  hasVoiceprintConsent,
  setVoiceprintConsent
} from '../../utils/recording/voiceprint-consent'
import {
  captureClientError,
  createTelemetryId,
  TELEMETRY_EVENT,
  trackTelemetry
} from '../../utils/telemetry'
import {
  createPracticeEventId,
  recordCompletedPractice
} from '../../services/practice/statistics'

const SAMPLE_RATE = recorderAnalysisConfig.sampleRate
const BUFFER_SIZE = recorderAnalysisConfig.frameSize
const MIN_MIDI = PITCH_MINIMUM_MIDI
const MAX_MIDI = PITCH_MAXIMUM_MIDI
const ROW_HEIGHT = LIVE_PITCH_ROW_HEIGHT
const AXIS_WIDTH = LIVE_PITCH_AXIS_WIDTH
const PIXELS_PER_SECOND = LIVE_PITCH_PIXELS_PER_SECOND
const DIRECT_RENDER_INTERVAL_MS = LIVE_PITCH_DIRECT_RENDER_INTERVAL_MS
const PCM_RENDER_INTERVAL_MS = LIVE_PITCH_PCM_RENDER_INTERVAL_MS
const COMMAND_CANVAS_RENDER_INTERVAL_MS = LIVE_PITCH_COMMAND_RENDER_INTERVAL_MS
const EXTERNAL_ACTION_PLAYER_EVENT_GUARD_MS = 1500

const canvasWidth = ref(375)
const canvasHeight = ref(500)
const toolbarHeight = ref(72)
const safeBottom = ref(0)
const isRecording = ref(false)
const hasStarted = ref(false)
const saving = ref(false)
const sharing = ref(false)
const isPlaying = ref(false)
const voiceprintConsentVisible = ref(false)
const playablePath = ref('')
const timeLabel = ref('00:00')
const playbackPosition = ref(0)
const recordingDetailMode = ref(false)

const points: StoredPitchPoint[] = []
const player = createAudibleAudioPlayer()
const instance = getCurrentInstance()
const { t } = useI18n()
const recordingModeLabel = computed(() =>
  recordingDetailMode.value ? t('record.playbackMode') : t('record.freeRecordingMode')
)
const defaultRecordingName = computed(() => t('record.defaultName'))
const toolbarState = computed(() =>
  createRecordingToolbarState({
    detailMode: recordingDetailMode.value,
    isRecording: isRecording.value,
    hasStarted: hasStarted.value,
    hasPlayableAudio: Boolean(playablePath.value),
    isSaving: saving.value,
    isSharing: sharing.value
  })
)

let context: any = null
const audioExportSession = createAudioExportSession()
let directCanvas = false
let canvasNode: any = null
let commitCanvas = () => {}
let canvasInitialized = false
let canvasDrawQueued = false
let startedAt = 0
let practiceStatisticsRecorded = false
let pausedDuration = 0
let pauseStartedAt = 0
let elapsed = 0
let timer: ReturnType<typeof setInterval> | undefined
let renderTimer: ReturnType<typeof setInterval> | undefined
const visualClock = createLivePitchVisualClock()
const viewportCenterMidi = ref(60)
let viewportTargetMidi = 60
let viewportAnimationAt = 0
let viewportAnimationTimer: ReturnType<typeof setInterval> | undefined
let dragStartY = 0
let dragStartX = 0
let dragStartCenterMidi = 60
let dragStartPlaybackPosition = 0
let isDraggingPitch = false
let dragMode: 'pending' | 'pitch' | 'time' = 'pending'
let playbackAnchorPosition = 0
let playbackAnchorAt = 0
let playbackHasStarted = false
let hasManualSeek = false
let seekAnimationTimer: ReturnType<typeof setInterval> | undefined
let seekAnimationResolve: (() => void) | undefined
let playbackRequestId = 0
let pendingPlayerSeek: number | null = null
let awaitingPlayerSeek: number | null = null
const playbackSourceSession = createRecordingPlaybackSourceSession()
const RECORD_SCREEN_AWAKE_OWNER = 'record-page'
let ignoreEndedBefore = 0
let ignorePlaybackErrorBefore = 0
let playbackStarting = false
let playbackStartPosition = 0
let playbackAudioOffset = 0
let externalActionPlaybackPosition: number | null = null
let recordingClockPosition = 0
let recordingClockAt = 0
let lastDetectedMidi = 60
let pendingAction: 'save' | 'stop' | null = null
let tempFilePath = ''
let tempBlob: Blob | undefined
let discardStop = false
let currentRecordingName = ''
const pcmBuffer = createPcmBuffer()
let recordedPcmByteLength = 0
let previewAudioPath = ''
let pausedPreviewRequestId = 0
let currentRecordingId = ''
let durationWarningShown = false
let durationLimitHandled = false
let telemetryRecordingId = ''
let recordingCompletionTracked = false
let pageDisposed = false
const pitchAnalysis = createLivePitchAnalysis({
  diagnosticLabel: '自由练声',
  points,
  sampleRate: SAMPLE_RATE,
  frameSize: BUFFER_SIZE,
  capturesPcmFrames: recorderCapabilities.capturesPcmFrames,
  isActive: () => isRecording.value,
  currentTime: currentElapsed,
  onPcmFrame: (buffer) => {
    recordedPcmByteLength += buffer.byteLength
    pcmBuffer.append(buffer)
    recordingClockPosition = recordedPcmByteLength / (SAMPLE_RATE * 2)
    recordingClockAt = Date.now()
  },
  onResult: (result) => {
    elapsed = Math.max(elapsed, result.time)
  },
  onVoiced: (midi) => {
    lastDetectedMidi = midi
    followRecordedPitch(midi)
  }
})

const recordLabel = computed(() => {
  if (isRecording.value) return recorderCapabilities.pause ? t('record.pause') : t('record.stop')
  if (hasStarted.value && recorderCapabilities.pause && !tempFilePath) return t('record.continue')
  if (hasStarted.value && tempFilePath) return t('record.stopped')
  return t('record.record')
})

const disconnectRecorder = connectRecorder({
  onStart: () => {
    isRecording.value = true
    hasStarted.value = true
  },
  onFrame: handleFrame,
  onStop: handleStop,
  onError: () => {
    captureClientError('recorder.failed', 'record', telemetryRecordingId)
    isRecording.value = false
    saving.value = false
    clearTimer()
    clearRenderTimer()
    void releaseRecordingScreenAwake()
    uni.showToast({ title: t('record.recordingStartFailed'), icon: 'none' })
  }
})

player.onTimeUpdate(syncPlaybackPosition)
player.onCanplay(() => {
  if (!playbackStarting || pendingPlayerSeek === null) return
  const position = pendingPlayerSeek
  pendingPlayerSeek = null
  const sourcePosition = playbackTimeToSourceTime(position)
  if (sourcePosition <= 0.01) {
    startPreparedPlayback(position)
    return
  }
  awaitingPlayerSeek = position
  player.seek(sourcePosition)
})
player.onPlay(() => {
  if (externalActionPlaybackPosition !== null) {
    player.pause()
    return
  }
  if (!playbackStarting) return
  playbackStarting = false
  isPlaying.value = true
  playbackHasStarted = true
  const actualTime = sourceTimeToPlaybackTime(Number((player as any).currentTime))
  const position =
    Number.isFinite(actualTime) && Math.abs(actualTime - playbackStartPosition) < 0.5
      ? actualTime
      : playbackStartPosition
  playbackPosition.value = position
  playbackAnchorPosition = position
  playbackAnchorAt = Date.now()
  clearTimer()
  timer = setInterval(updateClock, 100)
  clearViewportAnimationTimer()
  startRenderTimer()
  updateClock()
  draw()
})
player.onSeeked(() => {
  if (externalActionPlaybackPosition !== null) return
  if (awaitingPlayerSeek === null) return
  const position = awaitingPlayerSeek
  awaitingPlayerSeek = null
  startPreparedPlayback(position)
})
player.onEnded(() => {
  if (externalActionPlaybackPosition !== null) return
  if (Date.now() < ignoreEndedBefore) return
  const predictedTime = currentPlaybackPosition()
  isPlaying.value = false
  playbackStarting = false
  pendingPlayerSeek = null
  awaitingPlayerSeek = null
  const actualTime = sourceTimeToPlaybackTime(Number((player as any).currentTime))
  playbackPosition.value =
    Number.isFinite(actualTime) && Math.abs(actualTime - predictedTime) < 0.5
      ? clamp(actualTime, 0, elapsed)
      : predictedTime
  playbackHasStarted = false
  hasManualSeek = false
  clearTimer()
  clearRenderTimer()
  cancelSeekAnimation()
  updateClock()
  draw()
})
player.onError((error) => {
  if (externalActionPlaybackPosition !== null) return
  if (Date.now() < ignorePlaybackErrorBefore) return
  isPlaying.value = false
  playbackStarting = false
  pendingPlayerSeek = null
  awaitingPlayerSeek = null
  clearTimer()
  clearRenderTimer()
  captureClientError('playback.local_failed', 'record', telemetryRecordingId)
  trackTelemetry(TELEMETRY_EVENT.RECORDING_PLAY_FAILED, {
    sourcePage: 'record',
    recordingId: telemetryRecordingId,
    errorCode: 'local_audio'
  })
  uni.showToast({ title: t('record.playFailed'), icon: 'none' })
})

onReady(initCanvas)
onMounted(async () => {
  await nextTick(initCanvas)
})
onLoad(loadRecordingDetail)
onShow(() => {
  if (pageDisposed) {
    uni.navigateBack({ delta: 1 })
    return
  }
  void keepScreenAwakeWhilePageOpen(RECORD_SCREEN_AWAKE_OWNER)
})
onHide(() => {
  pausePageActivity()
  void releasePageScreenAwake(RECORD_SCREEN_AWAKE_OWNER)
})
onUnload(disposePage)

function pausePageActivity() {
  if (pageDisposed) return
  if (isRecording.value) {
    void pauseActiveRecording(false)
    return
  }
  if (isPlaying.value) pausePlayback()
  else if (playbackStarting) stopPlayback()
}

function disposePage() {
  if (pageDisposed) return
  pageDisposed = true
  void releasePageScreenAwake(RECORD_SCREEN_AWAKE_OWNER)
  invalidatePausedPreview()
  clearTimer()
  clearRenderTimer()
  clearViewportAnimationTimer()
  cancelSeekAnimation()
  void releaseRecordingScreenAwake()
  if (hasStarted.value && !tempFilePath) {
    discardStop = true
    stopRecorder()
  }
  disconnectRecorder()
  pitchAnalysis.terminate()
  deleteTemporaryAudio(previewAudioPath)
  deleteTemporaryAudio(tempFilePath)
  player.destroy()
}

async function loadRecordingDetail(options: Record<string, string | undefined> = {}) {
  hidePageShareMenu()
  const id = options?.id ? decodeURIComponent(options.id) : ''
  setPageTitle('app.name')
  if (!id) return
  recordingDetailMode.value = true
  currentRecordingId = id
  telemetryRecordingId = id
  try {
    const recording = await getRecording(id)
    if (!recording) throw new Error('recording not found')
    points.splice(0, points.length, ...(Array.isArray(recording.points) ? recording.points : []))
    elapsed = Math.max(0, recording.duration || 0)
    playbackAudioOffset = Math.max(0, recording.audioOffset || 0)
    playbackPosition.value = elapsed
    playbackHasStarted = false
    hasManualSeek = false
    playablePath.value = await getPlaybackSource(recording)
    currentRecordingName = recordingDisplayName(recording, defaultRecordingName.value)
    const lastVoicedPoint = findLastVoicedPoint()
    if (lastVoicedPoint && lastVoicedPoint.midi !== null) {
      const center = clampViewportCenter(lastVoicedPoint.midi)
      viewportTargetMidi = center
      viewportCenterMidi.value = center
    }
    updateClock()
    await nextTick()
    draw()
  } catch {
    uni.showToast({ title: t('record.notFound'), icon: 'none' })
    setTimeout(() => uni.navigateBack(), 500)
  }
}

async function initCanvas() {
  if (canvasInitialized) return
  canvasInitialized = true
  const metrics = getWindowMetrics()
  const layout = calculateLivePitchCanvasLayout(metrics)
  safeBottom.value = layout.safeBottom
  toolbarHeight.value = layout.toolbarHeight
  canvasWidth.value = layout.canvasWidth
  canvasHeight.value = layout.canvasHeight
  await nextTick()
  const surface = await createPitchCanvasSurface({
    id: 'pitchCanvas',
    width: canvasWidth.value,
    height: canvasHeight.value,
    pixelRatio: metrics.pixelRatio,
    component: instance?.proxy
  })
  context = surface.context
  directCanvas = surface.direct
  canvasNode = surface.node
  commitCanvas = surface.commit
  pitchAnalysis.initWorker()
  draw()
}

async function toggleRecording() {
  if (recordingDetailMode.value) return
  if (!hasStarted.value && !hasVoiceprintConsent()) {
    voiceprintConsentVisible.value = true
    return
  }
  const playbackStateBeforeRecordingAction = {
    isPlaying: isPlaying.value,
    playbackStarting,
    loadedPreviewPath: playbackSourceSession.loadedSourcePath
  }
  stopPlayback()
  if (isRecording.value) {
    await pauseActiveRecording(true)
    return
  }

  if (hasStarted.value && tempFilePath) {
    uni.showToast({ title: t('record.saveOrClearFirst'), icon: 'none' })
    return
  }

  if (hasStarted.value && elapsed >= MAX_RECORDING_DURATION_SECONDS) {
    uni.showToast({ title: t('record.durationLimitReached'), icon: 'none' })
    return
  }

  if (!hasStarted.value) {
    let startStage = 'requestMicrophonePermission'
    try {
      await requestMicrophonePermission()
      startStage = 'resetAnalysis'
      resetAnalysis()
      telemetryRecordingId = createTelemetryId()
      recordingCompletionTracked = false
      startedAt = Date.now()
      practiceStatisticsRecorded = false
      startStage = 'startRecorder'
      await startRecorder()
      currentRecordingName = ''
      startStage = 'keepScreenAwakeWhileRecording'
      await keepScreenAwakeWhileRecording()
      trackTelemetry(TELEMETRY_EVENT.RECORDING_STARTED, {
        sourcePage: 'record',
        recordingId: telemetryRecordingId
      })
      uni.showToast({ title: t('record.durationLimitNotice'), icon: 'none', duration: 2500 })
    } catch (error) {
      console.error('[录音错误] 自由录音启动流程失败', {
        stage: startStage,
        rawError: error
      })
      uni.showModal({
        title: t('record.microphonePermissionTitle'),
        content: t('record.recordingStartFailed'),
        showCancel: false
      })
      return
    }
  } else {
    console.info('[录音诊断] 自由练声从暂停或回放切回继续录音', {
      ...playbackStateBeforeRecordingAction
    })
    invalidatePausedPreview()
    pausedDuration += Date.now() - pauseStartedAt
    retirePreviewAudio(
      previewAudioPath,
      playbackStateBeforeRecordingAction.loadedPreviewPath === previewAudioPath
    )
    previewAudioPath = ''
    playablePath.value = ''
    pitchAnalysis.initWorker()
    setViewportTarget(lastDetectedMidi)
    draw()
    resumeRecorder()
    void keepScreenAwakeWhileRecording()
    trackTelemetry(TELEMETRY_EVENT.RECORDING_RESUMED, {
      sourcePage: 'record',
      recordingId: telemetryRecordingId,
      durationSeconds: elapsed
    })
  }

  isRecording.value = true
  hasStarted.value = true
  clearTimer()
  timer = setInterval(updateClock, 100)
  startRenderTimer()
}

function acceptVoiceprintConsent() {
  setVoiceprintConsent(true)
  voiceprintConsentVisible.value = false
  void toggleRecording()
}

function declineVoiceprintConsent() {
  setVoiceprintConsent(false)
  voiceprintConsentVisible.value = false
}

function openVoiceprintAgreement() {
  uni.navigateTo({
    url: '/pages/voiceprint-agreement/index?returnTo=%2Fpages%2Frecord%2Findex'
  })
}

async function pauseActiveRecording(trackPause: boolean) {
  if (!isRecording.value) return
  if (recorderCapabilities.pause) {
    const diagnosticPauseStartedAt = Date.now()
    console.info('[录音诊断] 自由练声开始暂停')
    elapsed = Math.max(elapsed, currentElapsed())
    pauseRecorder()
    void releaseRecordingScreenAwake()
    pauseStartedAt = Date.now()
    isRecording.value = false
    playbackPosition.value = elapsed
    playbackHasStarted = false
    hasManualSeek = false
    clearTimer()
    clearRenderTimer()
    updateClock()
    draw()
    await refreshPausedPlayback()
    console.info('[录音诊断] 自由练声暂停全部完成', {
      elapsedMs: Date.now() - diagnosticPauseStartedAt
    })
    if (trackPause) {
      trackTelemetry(TELEMETRY_EVENT.RECORDING_PAUSED, {
        sourcePage: 'record',
        recordingId: telemetryRecordingId,
        durationSeconds: elapsed
      })
    }
    return
  }
  pendingAction = 'stop'
  isRecording.value = false
  elapsed = Math.max(elapsed, (Date.now() - startedAt - pausedDuration) / 1000)
  clearTimer()
  clearRenderTimer()
  void releaseRecordingScreenAwake()
  stopRecorder()
}

function handleFrame(buffer: ArrayBuffer | Float32Array, sourceSampleRate = SAMPLE_RATE) {
  pitchAnalysis.analyze(buffer, sourceSampleRate)
}

function followRecordedPitch(midi: number) {
  if (!isRecording.value) return
  followViewportToPitch(midi)
}

function followViewportToPitch(midi: number) {
  const halfVisibleRows = canvasHeight.value / (2 * ROW_HEIGHT)
  const deadZone = Math.max(3, Math.min(5, halfVisibleRows - 4))
  if (Math.abs(midi - viewportTargetMidi) > deadZone) setViewportTarget(midi)
}

async function handleStop(result: { tempFilePath: string; blob?: Blob }) {
  void releaseRecordingScreenAwake()
  if (discardStop) {
    discardStop = false
    deleteTemporaryAudio(result.tempFilePath)
    resetPcm()
    recordedPcmByteLength = 0
    return
  }
  let completedAudioPath = ''
  if (
    recorderCapabilities.capturesPcmFrames &&
    pcmBuffer.byteLength > 0 &&
    pcmBuffer.byteLength === recordedPcmByteLength
  ) {
    completedAudioPath = await createPcmPreview(pcmChunks(), pcmBuffer.byteLength)
    deleteTemporaryAudio(result.tempFilePath)
  }
  tempFilePath = completedAudioPath || result.tempFilePath
  tempBlob = result.blob
  playablePath.value =
    recorderCapabilities.capturesPcmFrames
      ? tempFilePath
      : recorderCapabilities.realtimeFrames
        ? ''
        : tempFilePath
  isRecording.value = false
  clearTimer()
  clearRenderTimer()
  elapsed =
    recorderCapabilities.capturesPcmFrames && recordedPcmByteLength > 0
      ? recordedPcmByteLength / (SAMPLE_RATE * 2)
      : Math.max(elapsed, (Date.now() - startedAt - pausedDuration) / 1000)
  if (recorderCapabilities.capturesPcmFrames) resetPcm()
  if (elapsed >= MAX_RECORDING_DURATION_SECONDS - 0.5) {
    elapsed = Math.min(elapsed, MAX_RECORDING_DURATION_SECONDS)
    notifyDurationLimitReached()
  }
  playbackPosition.value = elapsed
  playbackHasStarted = false
  hasManualSeek = false
  recordingClockPosition = 0
  recordingClockAt = 0
  updateClock()
  draw()
  if (!recordingCompletionTracked) {
    recordingCompletionTracked = true
    trackTelemetry(TELEMETRY_EVENT.RECORDING_COMPLETED, {
      sourcePage: 'record',
      recordingId: telemetryRecordingId,
      durationSeconds: elapsed
    })
  }
  if (!recordingDetailMode.value && !practiceStatisticsRecorded && elapsed >= 1) {
    practiceStatisticsRecorded = true
    void recordCompletedPractice({
      clientEventId: createPracticeEventId(),
      exerciseKey: 'free-practice',
      durationSeconds: elapsed,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      title: t('practiceStats.freePractice'),
      primaryCategoryKey: 'natural',
      primaryCategoryName: t('practice.categories.natural')
    }).catch(() => {
      // 事件已经保存在本地，网络恢复或登录后继续同步。
    })
  }
  if (pendingAction === 'save') await persistCurrentRecording()
  pendingAction = null
}

async function saveRecording() {
  if (recordingDetailMode.value) return
  if (!hasStarted.value || saving.value) return
  saving.value = true
  if (!tempFilePath) {
    pendingAction = 'save'
    isRecording.value = false
    clearTimer()
    stopRecorder()
    return
  }
  await persistCurrentRecording()
}

async function persistCurrentRecording() {
  try {
    const sourceTempFilePath = tempFilePath
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const date = new Date()
    const recordingName = await resolveCurrentRecordingName()
    const stored = await storeRecording({
      tempFilePath: sourceTempFilePath,
      blob: tempBlob,
      recording: {
        id,
        name: recordingName,
        duration: elapsed,
        audioOffset: 0,
        createdAt: date.toISOString(),
        pointCount: points.length,
        points: [...points],
        recordingType: RECORDING_TYPE.FREE_RECORDING
      }
    })
    deleteTemporaryAudio(sourceTempFilePath)
    deleteTemporaryAudio(previewAudioPath)
    previewAudioPath = ''
    playablePath.value = await getPlaybackSource(stored)
    currentRecordingName = stored.name
    currentRecordingId = stored.id
    tempFilePath = ''
    tempBlob = undefined
    hasStarted.value = false
    playbackPosition.value = 0
    playbackStartPosition = 0
    playbackAnchorPosition = 0
    playbackAnchorAt = Date.now()
    playbackHasStarted = false
    hasManualSeek = false
    saving.value = false
    updateClock()
    draw()
    trackTelemetry(TELEMETRY_EVENT.RECORDING_SAVED, {
      sourcePage: 'record',
      recordingId: telemetryRecordingId,
      durationSeconds: elapsed
    })
    uni.showToast({ title: t('record.saved'), icon: 'success' })
  } catch {
    saving.value = false
    trackTelemetry(TELEMETRY_EVENT.RECORDING_SAVE_FAILED, {
      sourcePage: 'record',
      recordingId: telemetryRecordingId,
      durationSeconds: elapsed,
      errorCode: 'local_persistence'
    })
    uni.showToast({ title: t('record.saveFailed'), icon: 'none' })
  }
}

async function clearRecording() {
  invalidatePausedPreview()
  void releaseRecordingScreenAwake()
  stopPlayback()
  clearTimer()
  clearRenderTimer()
  pendingAction = null
  if (isRecording.value || (hasStarted.value && !tempFilePath)) {
    discardStop = true
    stopRecorder()
  }
  resetAnalysis()
  isRecording.value = false
  hasStarted.value = false
  saving.value = false
  playablePath.value = ''
  deleteTemporaryAudio(tempFilePath)
  tempFilePath = ''
  tempBlob = undefined
  currentRecordingName = ''
  deleteTemporaryAudio(previewAudioPath)
  previewAudioPath = ''
  timeLabel.value = '00:00'
  draw()
}

function resetAnalysis() {
  elapsed = 0
  playbackPosition.value = 0
  playbackHasStarted = false
  hasManualSeek = false
  recordingClockPosition = 0
  recordingClockAt = 0
  pausedDuration = 0
  durationWarningShown = false
  durationLimitHandled = false
  viewportCenterMidi.value = 60
  viewportTargetMidi = 60
  viewportAnimationAt = 0
  lastDetectedMidi = 60
  pitchAnalysis.reset()
  resetPcm()
  recordedPcmByteLength = 0
}

function resetPcm() {
  pcmBuffer.reset()
}

function pcmChunks() {
  return pcmBuffer.chunks()
}

async function refreshPausedPlayback() {
  const requestId = ++pausedPreviewRequestId
  try {
    const preview = recorderCapabilities.capturesPcmFrames
      ? pcmBuffer.byteLength > 0 && pcmBuffer.byteLength === recordedPcmByteLength
        ? { tempFilePath: await createPcmPreview(pcmChunks(), pcmBuffer.byteLength) }
        : null
      : await createPausedRecorderPreview()
    if (!preview) throw new Error('paused preview unavailable')
    if (requestId !== pausedPreviewRequestId || isRecording.value) {
      deleteTemporaryAudio(preview.tempFilePath)
      console.info('[录音诊断] 丢弃已经过期的自由练声暂停预览', { requestId })
      return
    }
    deleteTemporaryAudio(previewAudioPath)
    previewAudioPath = preview.tempFilePath
    playablePath.value = preview.tempFilePath
  } catch {
    if (requestId !== pausedPreviewRequestId || isRecording.value) return
    uni.showToast({ title: t('record.previewFailed'), icon: 'none' })
  }
}

function invalidatePausedPreview() {
  pausedPreviewRequestId += 1
}

async function togglePlayback() {
  if (!playablePath.value) return
  if (isPlaying.value) {
    pausePlayback()
    return
  }
  if (playbackStarting) {
    stopPlayback()
    return
  }
  const requestId = ++playbackRequestId
  if (!playbackHasStarted && !hasManualSeek) {
    await animatePlaybackPosition(0)
    if (requestId !== playbackRequestId) return
  }
  playbackPosition.value = clamp(playbackPosition.value, 0, elapsed)
  playbackStartPosition = playbackPosition.value
  playbackStarting = true
  pendingPlayerSeek = playbackPosition.value
  awaitingPlayerSeek = null
  const canReuseLoadedSource = canReuseRecordingPlaybackSource(
    playbackSourceSession,
    playablePath.value
  )
  if (playbackSourceSession.loadedSourcePath) {
    ignoreEndedBefore = Date.now() + 500
    player.stop()
  }
  if (canReuseLoadedSource) {
    const position = playbackPosition.value
    pendingPlayerSeek = null
    if (playbackTimeToSourceTime(position) <= 0.01) startPreparedPlayback(position)
    else {
      awaitingPlayerSeek = position
      player.seek(playbackTimeToSourceTime(position))
    }
    return
  }
  player.src = playablePath.value
  markRecordingPlaybackSourceLoaded(playbackSourceSession, playablePath.value)
  ;(player as any).startTime = playbackTimeToSourceTime(playbackPosition.value)
  // 已准备好的本地预览不一定触发 canplay，直接开始并让其在内部完成加载，
  // 否则第一次点击只会设置 src，第二次点击才真正播放。
  pendingPlayerSeek = null
  startPreparedPlayback(playbackPosition.value)
}

function stopPlayback() {
  playbackRequestId += 1
  cancelSeekAnimation()
  pendingPlayerSeek = null
  awaitingPlayerSeek = null
  playbackStarting = false
  isPlaying.value = false
  if (playbackSourceSession.loadedSourcePath) {
    const stopStartedAt = Date.now()
    ignoreEndedBefore = Date.now() + 500
    player.stop()
    invalidateRecordingPlaybackSource(playbackSourceSession)
    console.info('[录音诊断] 自由练声播放器停止完成', {
      elapsedMs: Date.now() - stopStartedAt
    })
  }
  clearTimer()
  clearRenderTimer()
}

function retirePreviewAudio(filePath: string, waitForNativePlayer: boolean) {
  if (!filePath) return
  if (!waitForNativePlayer) {
    deleteTemporaryAudio(filePath)
    return
  }
  // 微信原生播放器的 stop() 返回早于底层文件句柄释放，立即 unlink 会阻塞音频线程。
  setTimeout(() => deleteTemporaryAudio(filePath), 500)
}

function pausePlayback() {
  playbackRequestId += 1
  cancelSeekAnimation()
  playbackPosition.value = currentPlaybackPosition()
  player.pause()
  isPlaying.value = false
  clearTimer()
  clearRenderTimer()
  updateClock()
  draw()
}

function syncPlaybackPosition() {
  if (externalActionPlaybackPosition !== null) return
  if (!isPlaying.value || pendingPlayerSeek !== null) return
  const currentTime = sourceTimeToPlaybackTime(Number((player as any).currentTime))
  if (!Number.isFinite(currentTime)) return
  if (awaitingPlayerSeek !== null) {
    if (Math.abs(currentTime - awaitingPlayerSeek) > 0.35) return
    awaitingPlayerSeek = null
  }
  const predicted = currentPlaybackPosition()
  const correction = clamp(currentTime - predicted, -0.05, 0.05)
  playbackPosition.value = clamp(predicted + correction, 0, elapsed)
  playbackAnchorPosition = playbackPosition.value
  playbackAnchorAt = Date.now()
  updateClock()
}

function startPreparedPlayback(position: number) {
  if (!playbackStarting) return
  playbackStartPosition = clamp(position, 0, elapsed)
  playbackPosition.value = playbackStartPosition
  playbackAnchorPosition = playbackStartPosition
  playbackAnchorAt = Date.now()
  player.play()
}

function currentPlaybackPosition() {
  if (!isPlaying.value) return playbackPosition.value
  return clamp(playbackAnchorPosition + (Date.now() - playbackAnchorAt) / 1000, 0, elapsed)
}

function playbackTimeToSourceTime(position: number) {
  return Math.max(0, position + playbackAudioOffset)
}

function sourceTimeToPlaybackTime(position: number) {
  return Number.isFinite(position) ? Math.max(0, position - playbackAudioOffset) : position
}

function animatePlaybackPosition(target: number) {
  cancelSeekAnimation()
  const from = playbackPosition.value
  const destination = clamp(target, 0, elapsed)
  if (Math.abs(destination - from) < 0.02) {
    playbackPosition.value = destination
    updateClock()
    draw()
    return Promise.resolve()
  }
  const duration = clamp(Math.abs(destination - from) * 24, 220, 420)
  const started = Date.now()
  return new Promise<void>((resolve) => {
    seekAnimationResolve = resolve
    seekAnimationTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      playbackPosition.value = from + (destination - from) * eased
      updateClock()
      draw()
      if (progress >= 1) finishSeekAnimation()
    }, DIRECT_RENDER_INTERVAL_MS)
  })
}

function finishSeekAnimation() {
  if (seekAnimationTimer !== undefined) clearInterval(seekAnimationTimer)
  seekAnimationTimer = undefined
  const resolve = seekAnimationResolve
  seekAnimationResolve = undefined
  resolve?.()
}

function cancelSeekAnimation() {
  finishSeekAnimation()
}

function startPitchDrag(event: any) {
  if (isRecording.value) return
  const pointer = getDragPointer(event)
  if (!pointer) return
  playbackRequestId += 1
  cancelSeekAnimation()
  if (isPlaying.value) pausePlayback()
  dragStartX = pointer.x
  dragStartY = pointer.y
  dragStartCenterMidi = viewportCenterMidi.value
  dragStartPlaybackPosition = playbackPosition.value
  dragMode = 'pending'
  isDraggingPitch = true
}

function movePitchDrag(event: any) {
  if (!isDraggingPitch) return
  const pointer = getDragPointer(event)
  if (!pointer) return
  const currentX = pointer.x
  const currentY = pointer.y
  const deltaX = currentX - dragStartX
  const deltaY = currentY - dragStartY
  if (dragMode === 'pending') {
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return
    dragMode = Math.abs(deltaX) >= Math.abs(deltaY) ? 'time' : 'pitch'
  }
  if (dragMode === 'time') {
    playbackPosition.value = clamp(
      dragStartPlaybackPosition - deltaX / PIXELS_PER_SECOND,
      0,
      elapsed
    )
    hasManualSeek = true
    playbackHasStarted = false
    updateClock()
  } else {
    const nextCenter = clampViewportCenter(dragStartCenterMidi + deltaY / ROW_HEIGHT)
    viewportTargetMidi = nextCenter
    viewportCenterMidi.value = nextCenter
    viewportAnimationAt = Date.now()
  }
  draw()
}

function endPitchDrag() {
  isDraggingPitch = false
  dragMode = 'pending'
}

function getDragPointer(event: any) {
  const pointer = event.touches?.[0] ?? event.changedTouches?.[0] ?? event
  const x = pointer?.clientX ?? pointer?.pageX
  const y = pointer?.clientY ?? pointer?.pageY
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

async function downloadRecording() {
  if (!playablePath.value) return
  const sourcePath = playablePath.value
  let heldPlaybackPosition: number | null = null
  trackTelemetry(TELEMETRY_EVENT.RECORDING_SHARE_CLICKED, {
    sourcePage: 'record',
    recordingId: telemetryRecordingId,
    durationSeconds: elapsed
  })
  try {
    const exportKey = sourcePath
    const exportPrepared = audioExportSession.isPrepared(exportKey)
    const recordingName = exportPrepared
      ? currentRecordingName || defaultRecordingName.value
      : await resolveCurrentRecordingName()
    heldPlaybackPosition = holdPlaybackForExternalAction()
    if (!exportPrepared) await pitchAnalysis.releaseWorkerSlot()
    const result = await audioExportSession.run({
      key: exportKey,
      filePath: sourcePath,
      name: recordingName
    })
    if (result === 'cancelled') return
    trackTelemetry(TELEMETRY_EVENT.RECORDING_SHARE_SUCCEEDED, {
      sourcePage: 'record',
      recordingId: telemetryRecordingId,
      durationSeconds: elapsed
    })
  } catch (error) {
    console.error('[音频导出] 自由练声分享失败', error)
    trackTelemetry(TELEMETRY_EVENT.RECORDING_SHARE_FAILED, {
      sourcePage: 'record',
      recordingId: telemetryRecordingId,
      durationSeconds: elapsed,
      errorCode: 'file_message'
    })
    uni.showToast({ title: t('record.exportFailed'), icon: 'none' })
  } finally {
    if (heldPlaybackPosition !== null) resetPlaybackAfterExternalAction()
  }
}

function holdPlaybackForExternalAction() {
  const predictedPosition = currentPlaybackPosition()
  const playerPosition = sourceTimeToPlaybackTime(Number((player as any).currentTime))
  const position =
    Number.isFinite(playerPosition) && Math.abs(playerPosition - predictedPosition) < 0.5
      ? clamp(playerPosition, 0, elapsed)
      : predictedPosition
  externalActionPlaybackPosition = position
  playbackRequestId += 1
  cancelSeekAnimation()
  pendingPlayerSeek = null
  awaitingPlayerSeek = null
  playbackStarting = false
  isPlaying.value = false
  ignoreEndedBefore = Date.now() + EXTERNAL_ACTION_PLAYER_EVENT_GUARD_MS
  if (playbackSourceSession.loadedSourcePath) player.pause()
  clearTimer()
  clearRenderTimer()
  playbackPosition.value = position
  playbackAnchorPosition = position
  playbackAnchorAt = Date.now()
  updateClock()
  draw()
  return position
}

function resetPlaybackAfterExternalAction() {
  playbackPosition.value = 0
  playbackAnchorPosition = 0
  playbackAnchorAt = Date.now()
  playbackHasStarted = false
  hasManualSeek = false
  playbackStarting = false
  isPlaying.value = false
  pendingPlayerSeek = null
  awaitingPlayerSeek = null
  const ignorePlayerEventsBefore = Date.now() + EXTERNAL_ACTION_PLAYER_EVENT_GUARD_MS
  ignoreEndedBefore = ignorePlayerEventsBefore
  ignorePlaybackErrorBefore = ignorePlayerEventsBefore
  if (playbackSourceSession.loadedSourcePath) player.stop()
  invalidateRecordingPlaybackSource(playbackSourceSession)
  externalActionPlaybackPosition = null
  updateClock()
  draw()
}

async function shareRecording() {
  if (!playablePath.value || sharing.value) return
  sharing.value = true
  try {
    await downloadRecording()
  } finally {
    sharing.value = false
  }
}

async function resolveCurrentRecordingName() {
  const resolvedName = currentRecordingName.trim()
  if (resolvedName) return resolvedName
  currentRecordingName = nextRecordingName(
    await listRecordings(),
    defaultRecordingName.value,
    RECORDING_TYPE.FREE_RECORDING
  )
  return currentRecordingName
}

function updateClock() {
  if (isRecording.value) {
    const position = currentRecordingPosition()
    if (!durationWarningShown && position >= RECORDING_DURATION_WARNING_AT_SECONDS) {
      durationWarningShown = true
      uni.showToast({ title: t('record.durationWarning'), icon: 'none', duration: 3000 })
    }
    if (position >= MAX_RECORDING_DURATION_SECONDS) {
      finishRecordingAtDurationLimit()
      return
    }
    timeLabel.value = formatTime(position)
    return
  }
  if (hasStarted.value || playablePath.value) {
    timeLabel.value = `${formatTime(currentPlaybackPosition())} / ${formatTime(elapsed)}`
    return
  }
  timeLabel.value = '00:00'
}

function finishRecordingAtDurationLimit() {
  if (durationLimitHandled || !isRecording.value) return
  elapsed = MAX_RECORDING_DURATION_SECONDS
  playbackPosition.value = elapsed
  isRecording.value = false
  pendingAction = 'stop'
  clearTimer()
  clearRenderTimer()
  void releaseRecordingScreenAwake()
  stopRecorder()
  notifyDurationLimitReached()
  timeLabel.value = formatTime(elapsed)
  draw()
}

function notifyDurationLimitReached() {
  if (durationLimitHandled) return
  durationLimitHandled = true
  uni.showToast({ title: t('record.durationLimitReached'), icon: 'none', duration: 3000 })
}

function clearTimer() {
  if (timer) clearInterval(timer)
  timer = undefined
}

function startRenderTimer() {
  clearRenderTimer()
  clearViewportAnimationTimer()
  visualClock.reset(isRecording.value ? currentRecordingPosition() : currentPlaybackPosition())
  renderTimer = setInterval(draw, activeRenderInterval())
}

function clearRenderTimer() {
  if (renderTimer !== undefined) clearInterval(renderTimer)
  renderTimer = undefined
  ensureViewportAnimationTimer()
}

function currentElapsed() {
  if (recorderCapabilities.capturesPcmFrames && hasStarted.value) {
    return Math.max(elapsed, recordedPcmByteLength / (SAMPLE_RATE * 2))
  }
  if (!startedAt) return elapsed
  return Math.max(elapsed, (Date.now() - startedAt - pausedDuration) / 1000)
}

function currentRecordingPosition() {
  const exactPosition = currentElapsed()
  if (!recorderCapabilities.capturesPcmFrames || !isRecording.value || !recordingClockAt)
    return exactPosition
  const interpolation = clamp((Date.now() - recordingClockAt) / 1000, 0, 0.035)
  return Math.max(recordingClockPosition, exactPosition) + interpolation
}

function setViewportTarget(midi: number) {
  viewportTargetMidi = clampViewportCenter(midi)
  viewportAnimationAt = Date.now()
  ensureViewportAnimationTimer()
}

function updateViewportAnimation() {
  const difference = viewportTargetMidi - viewportCenterMidi.value
  if (Math.abs(difference) < 0.015) {
    viewportCenterMidi.value = viewportTargetMidi
    viewportAnimationAt = Date.now()
    return false
  }
  const now = Date.now()
  const frameDuration = viewportAnimationAt ? clamp(now - viewportAnimationAt, 8, 50) : 16
  viewportAnimationAt = now
  const blend = 1 - Math.exp(-frameDuration / 75)
  viewportCenterMidi.value += difference * blend
  return true
}

function ensureViewportAnimationTimer() {
  if (renderTimer !== undefined || viewportAnimationTimer !== undefined) return
  if (Math.abs(viewportTargetMidi - viewportCenterMidi.value) < 0.015) return
  viewportAnimationTimer = setInterval(() => {
    draw()
    if (Math.abs(viewportTargetMidi - viewportCenterMidi.value) < 0.015)
      clearViewportAnimationTimer()
  }, activeRenderInterval())
}

function activeRenderInterval() {
  if (recorderCapabilities.capturesPcmFrames) return PCM_RENDER_INTERVAL_MS
  return directCanvas ? DIRECT_RENDER_INTERVAL_MS : COMMAND_CANVAS_RENDER_INTERVAL_MS
}

function clearViewportAnimationTimer() {
  if (viewportAnimationTimer !== undefined) clearInterval(viewportAnimationTimer)
  viewportAnimationTimer = undefined
}

function pitchAtTime(time: number) {
  let low = 0
  let high = points.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (points[middle].time <= time) low = middle + 1
    else high = middle
  }
  const left = points[low - 1]
  const right = points[low]
  if (!left || left.midi === null) return null
  if (right && right.midi !== null && right.time - left.time <= 0.25) {
    const progress = clamp((time - left.time) / Math.max(0.001, right.time - left.time), 0, 1)
    return left.midi + (right.midi - left.midi) * progress
  }
  return time - left.time <= 0.15 ? left.midi : null
}

function findLastVoicedPoint() {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].midi !== null) return points[index]
  }
  return undefined
}

function draw() {
  const targetCursorTime = isRecording.value
    ? Math.max(0, currentRecordingPosition() - LIVE_PITCH_RENDER_DELAY_SECONDS)
    : isPlaying.value
      ? Math.max(0, currentPlaybackPosition() - PLAYBACK_OUTPUT_DELAY_SECONDS)
      : currentPlaybackPosition()
  const cursorTime =
    dragMode === 'time'
      ? visualClock.reset(targetCursorTime)
      : visualClock.update(targetCursorTime, isRecording.value || isPlaying.value)
  if (isRecording.value || dragMode === 'time') {
    const cursorMidi = pitchAtTime(cursorTime)
    if (cursorMidi !== null) followViewportToPitch(cursorMidi)
  }
  updateViewportAnimation()
  if (!context || canvasDrawQueued) return
  canvasDrawQueued = true
  void nextTick(() => {
    canvasDrawQueued = false
    drawCanvas(cursorTime)
  })
}

function drawCanvas(cursorTime: number) {
  const ctx = context
  if (!ctx) return
  const width = canvasWidth.value
  const height = canvasHeight.value
  const plotWidth = Math.max(1, width - AXIS_WIDTH)
  const viewportMaxMidi = viewportCenterMidi.value + height / (2 * ROW_HEIGHT) - 0.5
  ctx.clearRect(0, 0, width, height)
  const pitchLayer = {
    context: ctx,
    direct: directCanvas,
    width,
    height,
    axisWidth: AXIS_WIDTH,
    viewportMaxMidi,
    rowHeight: ROW_HEIGHT,
    minimumMidi: MIN_MIDI,
    maximumMidi: MAX_MIDI
  }
  drawPitchGrid(pitchLayer)
  const playheadX = plotWidth * LIVE_PITCH_PLAYHEAD_RATIO
  const startTime = cursorTime - playheadX / PIXELS_PER_SECOND
  const endTime = startTime + plotWidth / PIXELS_PER_SECOND
  drawLivePitchCurve({
    context: ctx,
    direct: directCanvas,
    points,
    startTime,
    endTime,
    width: plotWidth,
    pixelsPerSecond: PIXELS_PER_SECOND,
    maximumMidi: viewportMaxMidi,
    rowHeight: ROW_HEIGHT,
    showLatestPoint: isRecording.value,
    liveTime: isRecording.value ? cursorTime : undefined
  })

  drawLivePitchPlayhead({ context: ctx, direct: directCanvas, x: playheadX, height })
  // 将音高轴保持为画布最上层，避免曲线或播放头覆盖、清除右侧 C1-C8 标签。
  drawPitchAxis(pitchLayer)
  commitCanvas()
}

function setCanvasFill(ctx: any, color: string) {
  if (directCanvas) ctx.fillStyle = color
  else ctx.setFillStyle(color)
}

function setCanvasStroke(ctx: any, color: string, width: number) {
  if (directCanvas) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
  } else {
    ctx.setStrokeStyle(color)
    ctx.setLineWidth(width)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function clampViewportCenter(value: number) {
  const halfVisibleRows = canvasHeight.value / (2 * ROW_HEIGHT)
  const minimum = MIN_MIDI + halfVisibleRows - 0.5
  const maximum = MAX_MIDI - halfVisibleRows + 0.5
  if (minimum > maximum) return (MIN_MIDI + MAX_MIDI) / 2
  return clamp(value, minimum, maximum)
}
</script>

<style scoped lang="scss">
.page {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  flex-direction: column;
  background: #fff;
}
.pitch-stage {
  position: relative;
  width: 100%;
  flex: none;
  overflow: hidden;
  background: #fff;
  cursor: grab;
  user-select: none;
}
.pitch-stage:active {
  cursor: grabbing;
}
.pitch-canvas {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  display: block;
  background: transparent;
}
.time-bar {
  display: flex;
  flex: 0 0 38rpx;
  width: 100%;
  height: 38rpx;
  align-items: center;
  justify-content: center;
  background: #356b5b;
  color: #fff;
  font-size: 23rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.share-button::after {
  border: 0;
}
</style>
