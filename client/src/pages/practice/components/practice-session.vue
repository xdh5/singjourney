<template>
  <view class="session-page">
    <app-navbar
      title-key="nav.practice"
      intercept-back
      @back="closeSession"
    />

    <view
      class="canvas-stage"
      :style="{ height: `${canvasHeight}px` }"
    >
      <canvas
        id="practiceCanvas"
        canvas-id="practiceCanvas"
        type="2d"
        class="canvas"
        :style="canvasStyle"
      />
      <recording-mode-tag :label="exerciseTitle" />
    </view>

    <view class="session-status">
      <text>{{ statusLabel }}</text>
      <text class="session-time">{{ timeLabel }}</text>
    </view>

    <recording-toolbar
      :height="toolbarHeight"
      :safe-bottom="safeBottom"
      :clear-label="t('record.clear')"
      :play-label="status === 'playing' ? t('record.pause') : t('record.play')"
      :record-label="practiceRecordLabel"
      :save-label="t('record.save')"
      :share-label="sharing ? t('record.generating') : t('record.share')"
      :is-playing="status === 'playing'"
      :is-recording="isPractising"
      :playback-disabled="!canReplay"
      :record-disabled="!canStartOrStop"
      :clear-disabled="!canUseCompletedRecording"
      :save-disabled="!canUseCompletedRecording || saving || Boolean(savedRecordingId)"
      :share-disabled="!canUseCompletedRecording || sharing"
      :show-share="true"
      @clear="clearPractice"
      @play="toggleReplay"
      @record="togglePracticeRecording"
      @save="savePractice"
      @share="sharePractice"
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
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import type { StoredPitchPoint } from '@singjourney/contracts'
import { createPitchCanvasSurface } from '../../../utils/pitch/canvas'
import { createPcmPreview, deleteTemporaryAudio } from '../../../utils/audio/files'
import { configureHeadphonesAudioMode } from '../../../utils/audio/player'
import { createPcmBuffer } from '../../../utils/audio/pcm-buffer'
import { createLivePitchAnalysis } from '../../../utils/pitch/live-analysis'
import {
  calculateLivePitchCanvasLayout,
  LIVE_PITCH_AXIS_WIDTH,
  LIVE_PITCH_DIRECT_RENDER_INTERVAL_MS,
  LIVE_PITCH_COMMAND_RENDER_INTERVAL_MS,
  LIVE_PITCH_PCM_RENDER_INTERVAL_MS,
  LIVE_PITCH_ROW_HEIGHT,
  LIVE_PITCH_PIXELS_PER_SECOND
} from '../../../utils/pitch/layout'
import { createAudioExportSession } from '../../../utils/share'
import { getWindowMetrics } from '../../../utils/window-metrics'
import RecordingToolbar from '../../../components/recording-toolbar.vue'
import AppNavbar from '../../../components/app-navbar.vue'
import RecordingModeTag from '../../../components/recording-mode-tag.vue'
import VoiceprintConsentSheet from '../../../components/voiceprint-consent-sheet.vue'
import { createPracticeAudioTransport } from '../../../utils/practice/audio-transport'
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
} from '../../../utils/audio/recorder'
import {
  keepScreenAwakeWhileRecording,
  releaseRecordingScreenAwake
} from '../../../utils/recording/screen-awake'
import type { PracticeManifest } from '../../../utils/practice/types'
import { RECORDING_TYPE, storeRecording } from '../../../utils/recording/storage'
import {
  hasVoiceprintConsent,
  setVoiceprintConsent
} from '../../../utils/recording/voiceprint-consent'
import {
  createPracticeEventId,
  type CompletedPracticeEvent
} from '../../../services/practice/statistics'
import { drawPitchAxis, drawPitchGrid } from '../../../utils/pitch/renderer'
import {
  createLivePitchVisualClock,
  drawLivePitchCurve,
  drawLivePitchPlayhead,
  LIVE_PITCH_PLAYHEAD_RATIO,
  LIVE_PITCH_RENDER_DELAY_SECONDS,
  PLAYBACK_OUTPUT_DELAY_SECONDS
} from '../../../utils/pitch/live-curve'

const props = defineProps<{
  manifest: PracticeManifest
  exerciseTitle: string
  includeAccompanimentOnReplay: boolean
}>()
const emit = defineEmits<{ close: []; completed: [event: CompletedPracticeEvent] }>()
const { t } = useI18n()
const instance = getCurrentInstance()

type SessionStatus =
  | 'ready'
  | 'preparing'
  | 'recording'
  | 'recordingPaused'
  | 'finishing'
  | 'completed'
  | 'playing'
  | 'playbackPaused'

const AXIS_WIDTH = LIVE_PITCH_AXIS_WIDTH
const ROW_PADDING = 2
const ROW_HEIGHT = LIVE_PITCH_ROW_HEIGHT
const PIXELS_PER_SECOND = LIVE_PITCH_PIXELS_PER_SECOND
const USER_PITCH_VIEW_PADDING = 2
const USER_PITCH_MAXIMUM_EXPANSION = 12
let viewportMaximumMidi: number | null = null
const DIRECT_RENDER_INTERVAL_MS = LIVE_PITCH_DIRECT_RENDER_INTERVAL_MS
const PCM_RENDER_INTERVAL_MS = LIVE_PITCH_PCM_RENDER_INTERVAL_MS
const COMMAND_CANVAS_RENDER_INTERVAL_MS = LIVE_PITCH_COMMAND_RENDER_INTERVAL_MS

const status = ref<SessionStatus>('ready')
const position = ref(0)
const canvasWidth = ref(375)
const canvasHeight = ref(480)
const toolbarHeight = ref(72)
const safeBottom = ref(0)
const saving = ref(false)
const sharing = ref(false)
const userPoints: StoredPitchPoint[] = []
const audioTransport = createPracticeAudioTransport()
let context: any = null
const audioExportSession = createAudioExportSession()
let directCanvas = false
let commitCanvas = () => {}
let canvasDrawQueued = false
let lastCanvasDiagnosticAt = 0
let renderTimer: ReturnType<typeof setInterval> | undefined
const visualClock = createLivePitchVisualClock()
const pcmBuffer = createPcmBuffer()
let recordedPcmByteLength = 0
let initialPreRollPcmByteLength = 0
let replayVoiceOffsetSeconds = 0
let initialRecordingGateOpened = false
const recordingPath = ref('')
let recordingBlob: Blob | undefined
let temporaryPcmPreview = ''
let pausedPreviewRequestId = 0
let discardPendingRecording = false
let recordingPausedAt = 0
let replayReturnStatus: 'recordingPaused' | 'completed' = 'completed'
let resumeRecorderOnGate = false
let recordingSessionOpen = false
let completedEventSent = false
let practiceEventId = ''
let practiceStartedAt = ''
let sessionDisposed = false
let pageVisible = true
const savedRecordingId = ref('')
const recordingCompleted = ref(false)
const voiceprintConsentVisible = ref(false)
const pitchAnalysis = createLivePitchAnalysis({
  diagnosticLabel: '伴奏练声',
  points: userPoints,
  sampleRate: recorderAnalysisConfig.sampleRate,
  frameSize: recorderAnalysisConfig.frameSize,
  capturesPcmFrames: recorderCapabilities.capturesPcmFrames,
  isActive: () => status.value === 'recording',
  shouldCapture: () => status.value === 'preparing',
  currentTime: currentCapturedPcmPosition,
  onPcmFrame: (buffer) => {
    recordedPcmByteLength += buffer.byteLength
    if (!initialRecordingGateOpened && status.value === 'preparing')
      initialPreRollPcmByteLength += buffer.byteLength
    pcmBuffer.append(buffer)
  }
})

const canvasStyle = computed(() => `width:${canvasWidth.value}px;height:${canvasHeight.value}px`)
const timeLabel = computed(
  () => `${formatTime(position.value)} / ${formatTime(props.manifest.duration)}`
)
const statusLabel = computed(() => t(`practice.sessionStatus.${status.value}`))
const isPractising = computed(() => status.value === 'preparing' || status.value === 'recording')
const canReplay = computed(
  () =>
    Boolean(recordingPath.value) &&
    ['recordingPaused', 'completed', 'playing', 'playbackPaused'].includes(status.value)
)
const canUseCompletedRecording = computed(
  () => Boolean(recordingPath.value) && recordingCompleted.value
)

function currentCapturedPcmPosition() {
  if (!recorderCapabilities.capturesPcmFrames) return currentPosition()
  const capturedByteLength = Math.max(
    0,
    recordedPcmByteLength - initialPreRollPcmByteLength
  )
  return (
    capturedByteLength /
    (recorderAnalysisConfig.sampleRate * Int16Array.BYTES_PER_ELEMENT)
  )
}
const canStartOrStop = computed(
  () =>
    ['ready', 'recording', 'recordingPaused'].includes(status.value) ||
    (status.value === 'playbackPaused' && replayReturnStatus === 'recordingPaused')
)
const practiceRecordLabel = computed(() => {
  if (status.value === 'recording') return t('record.pause')
  if (
    status.value === 'recordingPaused' ||
    (status.value === 'playbackPaused' && replayReturnStatus === 'recordingPaused')
  )
    return t('record.continue')
  if (
    status.value === 'completed' ||
    status.value === 'playing' ||
    status.value === 'playbackPaused'
  )
    return t('record.stopped')
  return t('record.record')
})

const disconnectRecorder = connectRecorder({
  onStart: () => {
    if (pageVisible) void startAccompaniment()
  },
  onFrame: analyzeFrame,
  onStop: finishRecording,
  onError: () => {
    audioTransport.stop()
    status.value = 'ready'
    stopRenderTimer()
    void releaseRecordingScreenAwake()
    uni.showToast({ title: t('record.recordingStartFailed'), icon: 'none' })
  }
})

onMounted(initCanvas)
onShow(() => {
  pageVisible = true
})
onHide(pausePageActivity)
onUnload(cleanup)
onUnmounted(cleanup)

function pausePageActivity() {
  pageVisible = false
  if (sessionDisposed) return
  if (status.value === 'recording') {
    void pausePracticeSession()
    return
  }
  if (status.value === 'playing') {
    pausePracticeReplay()
    return
  }
  if (status.value !== 'preparing') return

  void releaseRecordingScreenAwake()
  stopRenderTimer()
  if (recordingSessionOpen || resumeRecorderOnGate || !recordingPath.value) {
    recordingPausedAt = currentPosition()
    position.value = recordingPausedAt
    audioTransport.pausePractice()
    if (recordingSessionOpen) pauseRecorder()
    status.value = 'recordingPaused'
    draw()
    void refreshPausedPreview()
    return
  }
  audioTransport.pauseReplay()
  status.value = 'playbackPaused'
  draw()
}

async function initCanvas() {
  const metrics = getWindowMetrics()
  const layout = calculateLivePitchCanvasLayout(metrics)
  canvasWidth.value = layout.canvasWidth
  canvasHeight.value = layout.canvasHeight
  safeBottom.value = layout.safeBottom
  toolbarHeight.value = layout.toolbarHeight
  await nextTick()
  const surface = await createPitchCanvasSurface({
    id: 'practiceCanvas',
    width: canvasWidth.value,
    height: canvasHeight.value,
    pixelRatio: metrics.pixelRatio,
    component: instance?.proxy
  })
  context = surface.context
  directCanvas = surface.direct
  commitCanvas = surface.commit
  pitchAnalysis.initWorker()
  draw()
}

async function startPractice() {
  if (status.value !== 'ready') return
  if (!hasVoiceprintConsent()) {
    voiceprintConsentVisible.value = true
    return
  }
  invalidatePausedPreview()
  savedRecordingId.value = ''
  recordingCompleted.value = false
  status.value = 'preparing'
  position.value = 0
  pcmBuffer.reset()
  recordedPcmByteLength = 0
  initialPreRollPcmByteLength = 0
  replayVoiceOffsetSeconds = 0
  initialRecordingGateOpened = false
  pitchAnalysis.reset()
  let startStage = 'configureHeadphonesAudioMode'
  try {
    // 微信在 RecorderManager 启动时会重新协商音频路由，开始录音前再次应用耳机模式。
    await configureHeadphonesAudioMode(props.includeAccompanimentOnReplay)
    startStage = 'prepareAccompaniment'
    await audioTransport.prepare(
      props.manifest.audioPath,
      props.manifest.audioOffset,
      props.manifest.duration,
      props.manifest.audioSegments
    )
    startStage = 'requestMicrophonePermission'
    await requestMicrophonePermission()
    resumeRecorderOnGate = recorderCapabilities.startsPausedForAudioGate
    startStage = 'startRecorder'
    await startRecorder({ startPaused: recorderCapabilities.startsPausedForAudioGate })
    recordingSessionOpen = true
    if (!pageVisible) {
      recordingPausedAt = 0
      position.value = 0
      pauseRecorder()
      status.value = 'recordingPaused'
    }
  } catch (error) {
    console.error('[录音错误] 伴奏练声启动流程失败', {
      stage: startStage,
      rawError: error
    })
    status.value = 'ready'
    uni.showModal({
      title: t('record.microphonePermissionTitle'),
      content: t('record.recordingStartFailed'),
      showCancel: false
    })
  }
}

function acceptVoiceprintConsent() {
  setVoiceprintConsent(true)
  voiceprintConsentVisible.value = false
  void startPractice()
}

function declineVoiceprintConsent() {
  setVoiceprintConsent(false)
  voiceprintConsentVisible.value = false
}

function openVoiceprintAgreement() {
  uni.navigateTo({
    url: '/pages/voiceprint-agreement/index?returnTo=%2Fpages%2Fpractice%2Findex'
  })
}

async function startAccompaniment() {
  if (status.value !== 'preparing') return
  try {
    await audioTransport.startPractice({
      onStarted: openRecordingGate,
      onEnded: endPractice,
      onError: failTransport
    })
  } catch {
    failTransport()
  }
}

function openRecordingGate() {
  if (status.value !== 'preparing') return
  console.info('[录音诊断] 伴奏已开始，准备打开录音门', {
    resumeRecorderOnGate,
    position: currentPosition()
  })
  if (!initialRecordingGateOpened) {
    replayVoiceOffsetSeconds =
      initialPreRollPcmByteLength / (recorderAnalysisConfig.sampleRate * Int16Array.BYTES_PER_ELEMENT)
    initialRecordingGateOpened = true
  }
  if (!practiceEventId) {
    practiceEventId = createPracticeEventId()
    practiceStartedAt = new Date().toISOString()
  }
  if (resumeRecorderOnGate) resumeRecorder()
  resumeRecorderOnGate = false
  status.value = 'recording'
  void keepScreenAwakeWhileRecording()
  position.value = currentPosition()
  startRenderTimer()
}

function failTransport() {
  audioTransport.stop()
  void releaseRecordingScreenAwake()
  if (recordingSessionOpen) {
    discardPendingRecording = true
    stopRecorder()
  }
  status.value = 'ready'
  stopRenderTimer()
  uni.showToast({ title: t('record.recordingStartFailed'), icon: 'none' })
}

function togglePracticeRecording() {
  if (status.value === 'ready') {
    void startPractice()
    return
  }
  if (status.value === 'recording') {
    void pausePracticeSession()
    return
  }
  if (
    status.value === 'recordingPaused' ||
    (status.value === 'playbackPaused' && replayReturnStatus === 'recordingPaused')
  ) {
    resumePracticeSession()
  }
}

async function pausePracticeSession() {
  if (status.value !== 'recording') return
  const pauseStartedAt = Date.now()
  console.info('[录音诊断] 伴奏练声开始暂停')
  recordingPausedAt = currentPosition()
  position.value = recordingPausedAt
  audioTransport.pausePractice()
  pauseRecorder()
  void releaseRecordingScreenAwake()
  status.value = 'recordingPaused'
  stopRenderTimer()
  draw()
  await refreshPausedPreview()
  console.info('[录音诊断] 伴奏练声暂停全部完成', {
    elapsedMs: Date.now() - pauseStartedAt
  })
}

function resumePracticeSession() {
  if (status.value !== 'recordingPaused' && status.value !== 'playbackPaused') return
  invalidatePausedPreview()
  console.info('[录音诊断] 从暂停或回放切回继续录音', { status: status.value })
  audioTransport.stop()
  status.value = 'preparing'
  position.value = recordingPausedAt
  resumeRecorderOnGate = true
  void audioTransport
    .startPractice(
      {
        onStarted: openRecordingGate,
        onEnded: endPractice,
        onError: failTransport
      },
      recordingPausedAt
    )
    .catch(failTransport)
}

async function refreshPausedPreview() {
  const requestId = ++pausedPreviewRequestId
  try {
    let previewPath = ''
    let previewBlob: Blob | undefined
    if (
      recorderCapabilities.capturesPcmFrames &&
      pcmBuffer.byteLength > 0 &&
      pcmBuffer.byteLength === recordedPcmByteLength
    ) {
      previewPath = await createPcmPreview(pcmBuffer.chunks(), pcmBuffer.byteLength)
    } else if (recorderCapabilities.startsPausedForAudioGate) {
      const preview = await createPausedRecorderPreview()
      previewPath = preview?.tempFilePath || ''
      previewBlob = preview?.blob
    }
    if (
      !previewPath ||
      requestId !== pausedPreviewRequestId ||
      status.value !== 'recordingPaused'
    ) {
      deleteTemporaryAudio(previewPath)
      if (previewPath)
        console.info('[录音诊断] 丢弃已经过期的伴奏练声暂停预览', { requestId })
      return
    }
    deleteTemporaryAudio(temporaryPcmPreview)
    temporaryPcmPreview = previewPath
    recordingPath.value = previewPath
    recordingBlob = previewBlob
    void audioTransport.prepareReplay(previewPath).catch(() => {})
  } catch {
    if (requestId !== pausedPreviewRequestId || status.value !== 'recordingPaused') return
    uni.showToast({ title: t('record.previewFailed'), icon: 'none' })
  }
}

function invalidatePausedPreview() {
  pausedPreviewRequestId += 1
}

function analyzeFrame(
  buffer: ArrayBuffer | Float32Array,
  sampleRate = recorderAnalysisConfig.sampleRate
) {
  pitchAnalysis.analyze(buffer, sampleRate)
}

function endPractice() {
  if (status.value !== 'recording' && status.value !== 'preparing') return
  invalidatePausedPreview()
  position.value = Math.min(props.manifest.duration, currentPosition())
  audioTransport.stop()
  status.value = 'finishing'
  stopRenderTimer()
  void releaseRecordingScreenAwake()
  stopRecorder()
}

async function finishRecording(result: { tempFilePath: string; blob?: Blob }) {
  recordingSessionOpen = false
  if (discardPendingRecording) {
    discardPendingRecording = false
    deleteTemporaryAudio(result.tempFilePath)
    pcmBuffer.reset()
    recordedPcmByteLength = 0
    return
  }
  if (temporaryPcmPreview && temporaryPcmPreview !== result.tempFilePath)
    deleteTemporaryAudio(temporaryPcmPreview)
  temporaryPcmPreview = ''
  let fallbackPath = ''
  if (
    recorderCapabilities.capturesPcmFrames &&
    pcmBuffer.byteLength > 0 &&
    pcmBuffer.byteLength === recordedPcmByteLength
  ) {
    fallbackPath = await createPcmPreview(pcmBuffer.chunks(), pcmBuffer.byteLength)
    deleteTemporaryAudio(result.tempFilePath)
  }
  recordingPath.value = fallbackPath || result.tempFilePath
  recordingBlob = result.blob
  pcmBuffer.reset()
  recordedPcmByteLength = 0
  status.value = 'completed'
  recordingCompleted.value = true
  void audioTransport.prepareReplay(recordingPath.value).catch(() => {})
  position.value = props.manifest.duration
  draw()
  if (!completedEventSent && practiceEventId && practiceStartedAt) {
    completedEventSent = true
    emit('completed', {
      clientEventId: practiceEventId,
      exerciseKey: props.manifest.exerciseKey,
      durationSeconds: props.manifest.duration,
      startedAt: practiceStartedAt,
      endedAt: new Date().toISOString()
    })
  }
  void recordingBlob
}

function toggleReplay() {
  if (!canReplay.value) return
  console.info('[录音诊断] 点击回放按钮', { status: status.value })
  if (status.value === 'playing') {
    pausePracticeReplay()
    return
  }
  if (status.value === 'playbackPaused') {
    audioTransport.resumeReplay()
    return
  }
  replayReturnStatus = status.value === 'recordingPaused' ? 'recordingPaused' : 'completed'
  const replayEnd =
    replayReturnStatus === 'recordingPaused' ? recordingPausedAt : props.manifest.duration
  position.value = 0
  status.value = 'preparing'
  draw()
  void audioTransport
    .startReplay(
      recordingPath.value,
      {
        onStarted: () => {
          status.value = 'playing'
          startRenderTimer()
        },
        onEnded: completeReplay,
        onError: failReplay
      },
      replayEnd,
      replayVoiceOffsetSeconds,
      props.includeAccompanimentOnReplay
    )
    .catch(failReplay)
}

function pausePracticeReplay() {
  if (status.value !== 'playing') return
  position.value = currentPosition()
  audioTransport.pauseReplay()
  status.value = 'playbackPaused'
  stopRenderTimer()
  draw()
}

function completeReplay() {
  status.value = replayReturnStatus
  position.value =
    replayReturnStatus === 'recordingPaused' ? recordingPausedAt : props.manifest.duration
  stopRenderTimer()
  draw()
}

function failReplay() {
  audioTransport.stop()
  status.value = replayReturnStatus
  stopRenderTimer()
  uni.showToast({ title: t('record.previewFailed'), icon: 'none' })
}

function clearPractice() {
  if (!canUseCompletedRecording.value) return
  invalidatePausedPreview()
  void releaseRecordingScreenAwake()
  audioTransport.stop()
  stopRenderTimer()
  if (recordingSessionOpen) {
    discardPendingRecording = true
    stopRecorder()
  }
  deleteTemporaryAudio(temporaryPcmPreview)
  temporaryPcmPreview = ''
  recordingPath.value = ''
  recordingBlob = undefined
  position.value = 0
  userPoints.splice(0)
  pcmBuffer.reset()
  recordedPcmByteLength = 0
  pitchAnalysis.reset()
  status.value = 'ready'
  completedEventSent = false
  practiceEventId = ''
  practiceStartedAt = ''
  savedRecordingId.value = ''
  recordingCompleted.value = false
  saving.value = false
  draw()
}

async function savePractice() {
  if (!canUseCompletedRecording.value || saving.value || savedRecordingId.value) return
  saving.value = true
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await storeRecording({
      tempFilePath: recordingPath.value,
      blob: recordingBlob,
      recording: {
        id,
        name: props.exerciseTitle,
        duration: props.manifest.duration,
        audioOffset: replayVoiceOffsetSeconds,
        createdAt: new Date().toISOString(),
        pointCount: userPoints.length,
        points: [...userPoints],
        recordingType: RECORDING_TYPE.ACCOMPANIED_PRACTICE
      }
    })
    savedRecordingId.value = id
    uni.showToast({ title: t('record.saved'), icon: 'success' })
  } catch {
    uni.showToast({ title: t('record.saveFailed'), icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function sharePractice() {
  if (!canUseCompletedRecording.value || sharing.value) return
  const sourcePath = recordingPath.value
  sharing.value = true
  try {
    const exportPrepared = audioExportSession.isPrepared(sourcePath)
    if (!exportPrepared) await pitchAnalysis.releaseWorkerSlot()
    const result = await audioExportSession.run({
      key: sourcePath,
      filePath: sourcePath,
      name: props.exerciseTitle
    })
    if (result === 'cancelled') return
  } catch (error) {
    console.error('[音频导出] 伴奏练声分享失败', error)
    uni.showToast({ title: t('record.exportFailed'), icon: 'none' })
  } finally {
    sharing.value = false
  }
}

function currentPosition() {
  return Math.min(props.manifest.duration, audioTransport.position())
}

function startRenderTimer() {
  stopRenderTimer()
  visualClock.reset(position.value)
  const interval = recorderCapabilities.capturesPcmFrames
    ? PCM_RENDER_INTERVAL_MS
    : directCanvas
      ? DIRECT_RENDER_INTERVAL_MS
      : COMMAND_CANVAS_RENDER_INTERVAL_MS
  renderTimer = setInterval(() => {
    position.value = currentPosition()
    draw()
  }, interval)
}

function stopRenderTimer() {
  if (renderTimer) clearInterval(renderTimer)
  renderTimer = undefined
}

function draw() {
  if (!context || canvasDrawQueued) return
  canvasDrawQueued = true
  void nextTick(() => {
    canvasDrawQueued = false
    drawCanvas()
  })
}

function drawCanvas() {
  if (!context) return
  const drawStartedAt = Date.now()
  const ctx = context
  const width = canvasWidth.value
  const height = canvasHeight.value
  const plotWidth = width - AXIS_WIDTH
  const targetDisplayPosition =
    status.value === 'recording'
      ? Math.max(0, position.value - LIVE_PITCH_RENDER_DELAY_SECONDS)
      : status.value === 'playing'
        ? Math.max(0, position.value - PLAYBACK_OUTPUT_DELAY_SECONDS)
        : position.value
  const displayPosition = visualClock.update(
    targetDisplayPosition,
    status.value === 'recording' || status.value === 'playing'
  )
  const viewStart =
    displayPosition - (plotWidth * LIVE_PITCH_PLAYHEAD_RATIO) / PIXELS_PER_SECOND
  const viewEnd = viewStart + plotWidth / PIXELS_PER_SECOND
  const visibleRowCount = height / ROW_HEIGHT
  const rangeCenterMidi =
    (props.manifest.range.minimumMidi + props.manifest.range.maximumMidi) / 2
  const latestVisibleMidi = findLatestVisibleUserMidi(viewStart, viewEnd)
  viewportMaximumMidi ??= rangeCenterMidi + visibleRowCount / 2 - 0.5
  if (latestVisibleMidi !== null) {
    const viewportMinimumMidi = viewportMaximumMidi - visibleRowCount + 1
    if (latestVisibleMidi < viewportMinimumMidi + USER_PITCH_VIEW_PADDING) {
      viewportMaximumMidi =
        Math.floor(latestVisibleMidi) - USER_PITCH_VIEW_PADDING + visibleRowCount - 1
    } else if (latestVisibleMidi > viewportMaximumMidi - USER_PITCH_VIEW_PADDING) {
      viewportMaximumMidi = Math.ceil(latestVisibleMidi) + USER_PITCH_VIEW_PADDING
    }
    const lowestAllowedMidi =
      props.manifest.range.minimumMidi - USER_PITCH_MAXIMUM_EXPANSION - ROW_PADDING
    const highestAllowedMidi =
      props.manifest.range.maximumMidi + USER_PITCH_MAXIMUM_EXPANSION + ROW_PADDING
    viewportMaximumMidi = Math.max(
      lowestAllowedMidi + visibleRowCount - 1,
      Math.min(highestAllowedMidi, viewportMaximumMidi)
    )
  }
  const minimumMidi =
    props.manifest.range.minimumMidi - USER_PITCH_MAXIMUM_EXPANSION - ROW_PADDING
  const maximumMidi =
    props.manifest.range.maximumMidi + USER_PITCH_MAXIMUM_EXPANSION + ROW_PADDING
  const rowHeight = ROW_HEIGHT

  const pitchLayer = {
    context: ctx,
    direct: directCanvas,
    width,
    height,
    axisWidth: AXIS_WIDTH,
    viewportMaxMidi: viewportMaximumMidi,
    rowHeight,
    minimumMidi,
    maximumMidi
  }
  drawPitchGrid(pitchLayer)

  for (const note of props.manifest.targetNotes) {
    if (note.end < viewStart || note.start > viewEnd) continue
    const x = (note.start - viewStart) * PIXELS_PER_SECOND
    const endX = (note.end - viewStart) * PIXELS_PER_SECOND
    const y = (viewportMaximumMidi - note.midi + 0.24) * rowHeight
    setFill(ctx, 'rgba(87, 174, 145, 0.34)')
    ctx.fillRect(x, y, Math.max(2, endX - x), Math.max(3, rowHeight * 0.52))
  }

  drawLivePitchCurve({
    context: ctx,
    direct: directCanvas,
    points: userPoints,
    startTime: viewStart,
    endTime: viewEnd,
    width: plotWidth,
    pixelsPerSecond: PIXELS_PER_SECOND,
    maximumMidi: viewportMaximumMidi,
    rowHeight,
    showLatestPoint: status.value === 'recording',
    liveTime: status.value === 'recording' ? displayPosition : undefined
  })

  const playheadX = (displayPosition - viewStart) * PIXELS_PER_SECOND
  drawLivePitchPlayhead({ context: ctx, direct: directCanvas, x: playheadX, height })

  drawPitchAxis(pitchLayer)
  commitCanvas()
  logCanvasTiming(drawStartedAt)
}

function logCanvasTiming(drawStartedAt: number) {
  const now = Date.now()
  if (now - lastCanvasDiagnosticAt < 1000) return
  lastCanvasDiagnosticAt = now
  const pcmPosition = currentCapturedPcmPosition()
  const accompanimentPosition = currentPosition()
  const latestPoint = userPoints[userPoints.length - 1]
  console.info('[曲线诊断] 伴奏练声', {
    canvasDrawMs: now - drawStartedAt,
    pcmPosition: Number(pcmPosition.toFixed(3)),
    accompanimentPosition: Number(accompanimentPosition.toFixed(3)),
    clockDriftMs: Math.round((pcmPosition - accompanimentPosition) * 1000),
    latestPointLagMs: latestPoint
      ? Math.round((accompanimentPosition - latestPoint.time) * 1000)
      : undefined,
    pointCount: userPoints.length
  })
}

function setFill(ctx: any, color: string) {
  if (directCanvas) ctx.fillStyle = color
  else ctx.setFillStyle(color)
}

function setStroke(ctx: any, color: string, width: number) {
  if (directCanvas) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
  } else {
    ctx.setStrokeStyle(color)
    ctx.setLineWidth(width)
  }
}

function findLatestVisibleUserMidi(viewStart: number, viewEnd: number) {
  for (let index = userPoints.length - 1; index >= 0; index -= 1) {
    const point = userPoints[index]
    if (point.time < viewStart - 0.25) break
    if (point.time > viewEnd || point.midi === null) continue
    return point.midi
  }
  return null
}

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

function closeSession() {
  cleanup()
  emit('close')
}

function cleanup() {
  if (sessionDisposed) return
  sessionDisposed = true
  invalidatePausedPreview()
  void releaseRecordingScreenAwake()
  stopRenderTimer()
  if (recordingSessionOpen) {
    discardPendingRecording = true
    stopRecorder()
  }
  disconnectRecorder()
  pitchAnalysis.terminate()
  audioTransport.destroy()
  deleteTemporaryAudio(temporaryPcmPreview)
  if (recordingPath.value !== temporaryPcmPreview) deleteTemporaryAudio(recordingPath.value)
}
</script>

<style scoped lang="scss">
.session-page {
  display: flex;
  height: 100vh;
  overflow: hidden;
  flex-direction: column;
  background: #fff;
}
.canvas-stage {
  position: relative;
  width: 100%;
  flex: none;
  overflow: hidden;
}
.canvas {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
}
.session-status {
  position: relative;
  display: flex;
  height: 50rpx;
  align-items: center;
  justify-content: flex-start;
  padding: 0 24rpx;
  color: #fff;
  background: #356b5b;
  font-size: 21rpx;
}
.session-time {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}
</style>
