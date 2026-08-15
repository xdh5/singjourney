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
      <view class="legend">
        <text class="legend-target">{{ t('practice.targetCurve') }}</text>
        <text class="legend-user">{{ t('practice.voiceCurve') }}</text>
      </view>
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
      :share-label="t('record.share')"
      :is-playing="status === 'playing'"
      :is-recording="isPractising"
      :playback-disabled="!canReplay"
      :record-disabled="!canStartOrStop"
      :share-disabled="!canDownload"
      :show-share="true"
      @clear="clearPractice"
      @play="toggleReplay"
      @record="togglePracticeRecording"
      @share="sharePractice"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import {
  AudioFrameAccumulator,
  PitchEngine,
  pcm16ToFloat32
} from '@singjourney/pitch-core'
import { createCurveCommands } from '@singjourney/curve-layout'
import type { StoredPitchPoint } from '@singjourney/contracts'
import { createPitchCanvasSurface } from '../../../utils/pitch/canvas'
import { createPcmPreview, deleteTemporaryAudio } from '../../../utils/audio/files'
import { createRecordingAudioEncoder } from '../../../utils/audio/encoder'
import { createPitchWorker } from '../../../utils/pitch/worker'
import { exportAudio } from '../../../utils/share'
import { getWindowMetrics } from '../../../utils/window-metrics'
import RecordingToolbar from '../../../components/recording-toolbar.vue'
import AppNavbar from '../../../components/app-navbar.vue'
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
import {
  createPracticeEventId,
  type CompletedPracticeEvent
} from '../../../services/practice/statistics'
import { drawPitchAxis, drawPitchGrid } from '../../../utils/pitch/renderer'

const props = defineProps<{ manifest: PracticeManifest }>()
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

const CANVAS_MINIMUM_HEIGHT = 320
const SESSION_HEADER_HEIGHT_PX = 36
const AXIS_WIDTH = 48
const ROW_PADDING = 2
const PIXELS_PER_SECOND = 72
const PLAYHEAD_RATIO = 0.46
const DIRECT_RENDER_INTERVAL_MS = 1000 / 60
const PCM_RENDER_INTERVAL_MS = 1000 / 30
const LEGACY_CANVAS_RENDER_INTERVAL_MS = 120
const ANALYSIS_INTERVAL_MS = 80
const PCM_BLOCK_SIZE = 64 * 1024
const TIME_BAR_HEIGHT_RPX = 50
const TOOLBAR_HEIGHT_RPX = 144

const status = ref<SessionStatus>('ready')
const position = ref(0)
const canvasWidth = ref(375)
const canvasHeight = ref(480)
const toolbarHeight = ref(72)
const safeBottom = ref(0)
const userPoints: StoredPitchPoint[] = []
const audioTransport = createPracticeAudioTransport()
let engineSampleRate = recorderAnalysisConfig.sampleRate
let engine = new PitchEngine({
  sampleRate: recorderAnalysisConfig.sampleRate,
  bufferSize: recorderAnalysisConfig.frameSize,
  primaryDetector: 'yin',
  fallbackDetector: true
})
const accumulator = new AudioFrameAccumulator(recorderAnalysisConfig.frameSize)

let context: any = null
let directCanvas = false
let commitCanvas = () => {}
let canvasDrawQueued = false
let pitchWorker: ReturnType<typeof createPitchWorker> = null
let renderTimer: ReturnType<typeof setInterval> | undefined
let lastAnalysisAt = 0
let workerAnalysisStartedAt = 0
let lastWorkerResultAt = 0
let unvoicedFrames = 0
let pcmBlocks: Uint8Array[] = []
let pcmBlock = new Uint8Array(PCM_BLOCK_SIZE)
let pcmBlockOffset = 0
let pcmByteLength = 0
let recordedPcmByteLength = 0
const recordingPath = ref('')
let recordingBlob: Blob | undefined
let temporaryPcmPreview = ''
let discardPendingRecording = false
let recordingPausedAt = 0
let replayReturnStatus: 'recordingPaused' | 'completed' = 'completed'
let resumeRecorderOnGate = false
let recordingSessionOpen = false
let completedEventSent = false
let practiceEventId = ''
let practiceStartedAt = ''
const recordingAudioEncoder = createRecordingAudioEncoder({
  enabled: () => recorderCapabilities.capturesPcmFrames,
  worker: () => pitchWorker
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
const canDownload = computed(
  () => Boolean(recordingPath.value) && ['recordingPaused', 'completed'].includes(status.value)
)
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
    void startAccompaniment()
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
  if (status.value === 'recording') void keepScreenAwakeWhileRecording()
})
onUnload(cleanup)

async function initCanvas() {
  const metrics = getWindowMetrics()
  canvasWidth.value = Math.max(1, metrics.windowWidth)
  safeBottom.value = metrics.safeBottom
  toolbarHeight.value = uni.upx2px(TOOLBAR_HEIGHT_RPX) + safeBottom.value
  const reservedHeight =
    metrics.statusBarHeight +
    SESSION_HEADER_HEIGHT_PX +
    uni.upx2px(TIME_BAR_HEIGHT_RPX + TOOLBAR_HEIGHT_RPX) +
    safeBottom.value
  canvasHeight.value = Math.max(CANVAS_MINIMUM_HEIGHT, metrics.windowHeight - reservedHeight)
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
  initPitchWorker()
  draw()
}

function initPitchWorker() {
  if (pitchWorker || !recorderCapabilities.capturesPcmFrames) return
  try {
    pitchWorker = createPitchWorker(handlePitchWorkerMessage, disablePitchWorker)
  } catch {
    pitchWorker = null
  }
}

function handlePitchWorkerMessage(message: any) {
  if (recordingAudioEncoder.handleMessage(message)) return
  if (message?.type === 'pitch-result') {
    lastWorkerResultAt = Date.now()
    if (status.value === 'recording' && message.result) handlePitchResult(message.result)
  }
}

function disablePitchWorker() {
  recordingAudioEncoder.fail()
  pitchWorker?.terminate?.()
  pitchWorker = null
}

async function startPractice() {
  if (status.value !== 'ready') return
  status.value = 'preparing'
  position.value = 0
  userPoints.splice(0)
  resetPcm()
  recordedPcmByteLength = 0
  workerAnalysisStartedAt = 0
  lastWorkerResultAt = 0
  lastAnalysisAt = 0
  engine.reset()
  accumulator.reset()
  pitchWorker?.postMessage({ type: 'reset' })
  try {
    await audioTransport.prepare(
      props.manifest.audioPath,
      props.manifest.audioOffset,
      props.manifest.duration
    )
    await requestMicrophonePermission()
    await recordingAudioEncoder.start()
    resumeRecorderOnGate = recorderCapabilities.startsPausedForAudioGate
    await startRecorder({ startPaused: recorderCapabilities.startsPausedForAudioGate })
    recordingSessionOpen = true
  } catch {
    recordingAudioEncoder.discard()
    status.value = 'ready'
    uni.showModal({
      title: t('record.microphonePermissionTitle'),
      content: t('record.recordingStartFailed'),
      showCancel: false
    })
  }
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
  recordingPausedAt = currentPosition()
  position.value = recordingPausedAt
  audioTransport.pausePractice()
  pauseRecorder()
  void releaseRecordingScreenAwake()
  status.value = 'recordingPaused'
  stopRenderTimer()
  draw()
  await refreshPausedPreview()
}

function resumePracticeSession() {
  if (status.value !== 'recordingPaused' && status.value !== 'playbackPaused') return
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
  try {
    const encodedPreviewPath = await recordingAudioEncoder.createPreview()
    if (encodedPreviewPath) {
      deleteTemporaryAudio(temporaryPcmPreview)
      temporaryPcmPreview = encodedPreviewPath
      recordingPath.value = encodedPreviewPath
      recordingBlob = undefined
      return
    }
    let previewPath = ''
    let previewBlob: Blob | undefined
    if (
      recorderCapabilities.capturesPcmFrames &&
      pcmByteLength > 0 &&
      pcmByteLength === recordedPcmByteLength
    ) {
      previewPath = await createPcmPreview(getPcmChunks(), pcmByteLength)
    } else if (recorderCapabilities.startsPausedForAudioGate) {
      const preview = await createPausedRecorderPreview()
      previewPath = preview?.tempFilePath || ''
      previewBlob = preview?.blob
    }
    if (!previewPath || status.value !== 'recordingPaused') {
      deleteTemporaryAudio(previewPath)
      return
    }
    deleteTemporaryAudio(temporaryPcmPreview)
    temporaryPcmPreview = previewPath
    recordingPath.value = previewPath
    recordingBlob = previewBlob
  } catch {
    uni.showToast({ title: t('record.previewFailed'), icon: 'none' })
  }
}

function appendPcm(buffer: ArrayBuffer) {
  const source = new Uint8Array(buffer)
  let sourceOffset = 0
  while (sourceOffset < source.length) {
    const writable = Math.min(source.length - sourceOffset, PCM_BLOCK_SIZE - pcmBlockOffset)
    pcmBlock.set(source.subarray(sourceOffset, sourceOffset + writable), pcmBlockOffset)
    pcmBlockOffset += writable
    pcmByteLength += writable
    sourceOffset += writable
    if (pcmBlockOffset === PCM_BLOCK_SIZE) {
      pcmBlocks.push(pcmBlock)
      pcmBlock = new Uint8Array(PCM_BLOCK_SIZE)
      pcmBlockOffset = 0
    }
  }
}

function resetPcm() {
  pcmBlocks = []
  pcmBlock = new Uint8Array(PCM_BLOCK_SIZE)
  pcmBlockOffset = 0
  pcmByteLength = 0
}

function getPcmChunks() {
  return pcmBlockOffset > 0 ? [...pcmBlocks, pcmBlock.subarray(0, pcmBlockOffset)] : pcmBlocks
}

function analyzeFrame(
  buffer: ArrayBuffer | Float32Array,
  sampleRate = recorderAnalysisConfig.sampleRate
) {
  if (status.value !== 'recording') return
  if (recorderCapabilities.capturesPcmFrames) {
    if (!(buffer instanceof ArrayBuffer)) return
    recordedPcmByteLength += buffer.byteLength
    appendPcm(buffer)
    if (pitchWorker) {
      const now = Date.now()
      if (!workerAnalysisStartedAt) workerAnalysisStartedAt = now
      try {
        pitchWorker.postMessage({
          type: 'analyze',
          buffer,
          sampleRate,
          time: currentPosition()
        })
      } catch {
        disablePitchWorker()
      }
      const workerResponsive = lastWorkerResultAt
        ? now - lastWorkerResultAt < 1200
        : now - workerAnalysisStartedAt < 1200
      if (pitchWorker && workerResponsive) return
      disablePitchWorker()
    }
  }
  const now = Date.now()
  if (now - lastAnalysisAt < ANALYSIS_INTERVAL_MS) return
  lastAnalysisAt = now
  if (sampleRate !== engineSampleRate) {
    engineSampleRate = sampleRate
    engine = new PitchEngine({
      sampleRate: engineSampleRate,
      bufferSize: recorderAnalysisConfig.frameSize,
      primaryDetector: 'yin',
      fallbackDetector: true
    })
    accumulator.reset()
  }
  const samples = buffer instanceof Float32Array ? buffer : pcm16ToFloat32(buffer)
  accumulator.push(samples, (frame: Float32Array) => {
    const result = engine.analyze(frame, currentPosition())
    if (result) handlePitchResult(result)
  })
}

function handlePitchResult(result: {
  time: number
  midi: number | null
  confidence: number
  voiced: boolean
}) {
  if (result.voiced && result.midi !== null) {
    unvoicedFrames = 0
    userPoints.push({ time: result.time, midi: result.midi, confidence: result.confidence })
  } else if (++unvoicedFrames === 3) {
    userPoints.push({ time: result.time, midi: null, confidence: 0 })
  }
}

function endPractice() {
  if (status.value !== 'recording' && status.value !== 'preparing') return
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
    recordingAudioEncoder.discard()
    resetPcm()
    recordedPcmByteLength = 0
    return
  }
  if (temporaryPcmPreview && temporaryPcmPreview !== result.tempFilePath)
    deleteTemporaryAudio(temporaryPcmPreview)
  temporaryPcmPreview = ''
  let fallbackPath = result.tempFilePath
  if (
    recorderCapabilities.capturesPcmFrames &&
    pcmByteLength > 0 &&
    pcmByteLength === recordedPcmByteLength
  ) {
    fallbackPath = await createPcmPreview(getPcmChunks(), pcmByteLength)
    deleteTemporaryAudio(result.tempFilePath)
  }
  recordingPath.value = await recordingAudioEncoder.finalize(fallbackPath)
  recordingBlob = result.blob
  resetPcm()
  recordedPcmByteLength = 0
  workerAnalysisStartedAt = 0
  lastWorkerResultAt = 0
  status.value = 'completed'
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
  if (status.value === 'playing') {
    position.value = currentPosition()
    audioTransport.pauseReplay()
    status.value = 'playbackPaused'
    stopRenderTimer()
    draw()
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
      replayEnd
    )
    .catch(failReplay)
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
  recordingAudioEncoder.discard()
  resetPcm()
  recordedPcmByteLength = 0
  engine.reset()
  accumulator.reset()
  pitchWorker?.postMessage({ type: 'reset' })
  status.value = 'ready'
  completedEventSent = false
  practiceEventId = ''
  practiceStartedAt = ''
  draw()
}

async function sharePractice() {
  if (!canDownload.value) return
  try {
    const result = await exportAudio({
      filePath: recordingPath.value,
      name: t('practice.exercises.mumOctave.title')
    })
    if (result === 'cancelled') return
  } catch {
    uni.showToast({ title: t('record.exportFailed'), icon: 'none' })
  }
}

function currentPosition() {
  return Math.min(props.manifest.duration, audioTransport.position())
}

function startRenderTimer() {
  stopRenderTimer()
  const interval = recorderCapabilities.capturesPcmFrames
    ? PCM_RENDER_INTERVAL_MS
    : directCanvas
      ? DIRECT_RENDER_INTERVAL_MS
      : LEGACY_CANVAS_RENDER_INTERVAL_MS
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
  const ctx = context
  const width = canvasWidth.value
  const height = canvasHeight.value
  const plotWidth = width - AXIS_WIDTH
  const minimumMidi = props.manifest.range.minimumMidi - ROW_PADDING
  const maximumMidi = props.manifest.range.maximumMidi + ROW_PADDING
  const rowHeight = height / (maximumMidi - minimumMidi + 1)
  const viewStart = Math.max(0, position.value - (plotWidth * PLAYHEAD_RATIO) / PIXELS_PER_SECOND)
  const viewEnd = viewStart + plotWidth / PIXELS_PER_SECOND

  const pitchLayer = {
    context: ctx,
    direct: directCanvas,
    width,
    height,
    axisWidth: AXIS_WIDTH,
    viewportMaxMidi: maximumMidi,
    rowHeight,
    minimumMidi,
    maximumMidi
  }
  drawPitchGrid(pitchLayer)

  for (const note of props.manifest.targetNotes) {
    if (note.end < viewStart || note.start > viewEnd) continue
    const x = (note.start - viewStart) * PIXELS_PER_SECOND
    const endX = (note.end - viewStart) * PIXELS_PER_SECOND
    const y = (maximumMidi - note.midi + 0.24) * rowHeight
    setFill(ctx, 'rgba(87, 174, 145, 0.34)')
    ctx.fillRect(x, y, Math.max(2, endX - x), Math.max(3, rowHeight * 0.52))
  }

  const commands = createCurveCommands(userPoints, {
    startTime: viewStart,
    width: plotWidth,
    pixelsPerSecond: PIXELS_PER_SECOND,
    maxMidi: maximumMidi,
    rowHeight
  })
  setStroke(ctx, '#356b5b', 2.5)
  ctx.beginPath()
  for (const command of commands) {
    if (command.type === 'move') ctx.moveTo(command.x, command.y)
    else if (command.type === 'line') ctx.lineTo(command.x, command.y)
    else if (command.type === 'quad') ctx.quadraticCurveTo(command.cx, command.cy, command.x, command.y)
  }
  ctx.stroke()

  const playheadX = (position.value - viewStart) * PIXELS_PER_SECOND
  setStroke(ctx, '#1f4e41', 1.5)
  ctx.beginPath()
  ctx.moveTo(playheadX, 0)
  ctx.lineTo(playheadX, height)
  ctx.stroke()

  drawPitchAxis(pitchLayer)
  commitCanvas()
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

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

function closeSession() {
  cleanup()
  emit('close')
}

function cleanup() {
  void releaseRecordingScreenAwake()
  stopRenderTimer()
  if (recordingSessionOpen) {
    discardPendingRecording = true
    stopRecorder()
  }
  disconnectRecorder()
  recordingAudioEncoder.discard()
  pitchWorker?.terminate?.()
  pitchWorker = null
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
.legend {
  position: absolute;
  z-index: 2;
  top: 16rpx;
  left: 18rpx;
  display: flex;
  gap: 10rpx;
}
.legend-target,
.legend-user {
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
}
.legend-target {
  color: #356b5b;
  background: rgba(217, 238, 230, 0.92);
}
.legend-user {
  color: #fff;
  background: rgba(53, 107, 91, 0.92);
}
.session-status {
  display: flex;
  height: 50rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  color: #fff;
  background: #356b5b;
  font-size: 21rpx;
}
.session-time {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}
</style>
