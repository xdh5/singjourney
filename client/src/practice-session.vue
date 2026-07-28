<template>
  <view class="session-page">
    <view class="session-header">
      <view class="back" role="button" @tap="closeSession">‹</view>
      <view class="session-copy">
        <text class="session-title">{{ t('practice.exercises.mumOctave.title') }}</text>
        <text class="session-range">{{ t(`practice.voices.${manifest.voice}`) }} · {{ rangeLabel }}</text>
      </view>
    </view>

    <view class="canvas-stage" :style="{ height: `${canvasHeight}px` }">
      <!-- #ifdef MP-WEIXIN -->
      <canvas id="practiceCanvas" type="2d" class="canvas" :style="canvasStyle" />
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <canvas id="practiceCanvas" canvas-id="practiceCanvas" class="canvas" :style="canvasStyle" />
      <!-- #endif -->
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
      :download-label="t('record.download')"
      :save-label="t('record.save')"
      :share-label="t('record.share')"
      :is-playing="status === 'playing'"
      :is-recording="isPractising"
      :playback-disabled="!canReplay"
      :record-disabled="!canStartOrStop"
      :download-disabled="!canDownload"
      :share-disabled="!canDownload"
      :show-download="!miniProgramPlatform"
      :show-share="miniProgramPlatform"
      @clear="clearPractice"
      @play="toggleReplay"
      @record="togglePracticeRecording"
      @download="downloadPractice"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { AudioFrameAccumulator, PitchEngine, midiToNoteName, pcm16ToFloat32 } from '@singjourney/pitch-core'
import type { StoredPitchPoint } from '@singjourney/contracts'
import { createPitchCanvasSurface } from './platform/pitch-canvas'
import { createPcmPreview, deleteTemporaryAudio } from './platform/audio-files'
import { exportAudio } from './platform/export-audio'
import RecordingToolbar from './components/recording-toolbar.vue'
import { createPracticeAudioTransport } from './platform/practice-audio-transport'
import {
  connectRecorder,
  createPausedRecorderPreview,
  pauseRecorder,
  recorderAnalysisConfig,
  requestMicrophonePermission,
  resumeRecorder,
  startRecorder,
  stopRecorder
} from './platform/recorder'
import type { PracticeManifest } from './shared/practice'
import { createPracticeEventId, type CompletedPracticeEvent } from './shared/practice-statistics'
import { drawPitchAxis, drawPitchGrid } from './shared/pitch-canvas-renderer'

const props = defineProps<{ manifest: PracticeManifest }>()
const emit = defineEmits<{ close: [], completed: [event: CompletedPracticeEvent] }>()
const { t } = useI18n()
const instance = getCurrentInstance()

type SessionStatus = 'ready' | 'preparing' | 'recording' | 'recordingPaused' | 'finishing' | 'completed' | 'playing' | 'playbackPaused'

const CANVAS_MINIMUM_HEIGHT = 320
const SESSION_HEADER_HEIGHT_RPX = 92
const AXIS_WIDTH = 48
const ROW_PADDING = 2
const PIXELS_PER_SECOND = 72
const PLAYHEAD_RATIO = 0.38
const RENDER_INTERVAL_MS = 1000 / 30
const ANALYSIS_INTERVAL_MS = 80
const TIME_BAR_HEIGHT_RPX = 50
const TOOLBAR_HEIGHT_RPX = 144

const status = ref<SessionStatus>('ready')
const position = ref(0)
const canvasWidth = ref(375)
const canvasHeight = ref(480)
const toolbarHeight = ref(72)
const safeBottom = ref(0)
const userPoints: StoredPitchPoint[] = []
const pcmChunks: Uint8Array[] = []
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
let renderTimer: ReturnType<typeof setInterval> | undefined
let lastAnalysisAt = 0
let unvoicedFrames = 0
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
let miniProgramPlatform = false
let webPlatform = false
// #ifdef MP-WEIXIN
miniProgramPlatform = true
// #endif
// #ifdef H5
webPlatform = true
// #endif

const canvasStyle = computed(() => `width:${canvasWidth.value}px;height:${canvasHeight.value}px`)
const rangeLabel = computed(() => `${midiToNoteName(props.manifest.range.minimumMidi)}–${midiToNoteName(props.manifest.range.maximumMidi)}`)
const timeLabel = computed(() => `${formatTime(position.value)} / ${formatTime(props.manifest.duration)}`)
const statusLabel = computed(() => t(`practice.sessionStatus.${status.value}`))
const isPractising = computed(() => status.value === 'preparing' || status.value === 'recording')
const canReplay = computed(() => Boolean(recordingPath.value) && ['recordingPaused', 'completed', 'playing', 'playbackPaused'].includes(status.value))
const canDownload = computed(() => Boolean(recordingPath.value) && ['recordingPaused', 'completed'].includes(status.value))
const canStartOrStop = computed(() => ['ready', 'recording', 'recordingPaused'].includes(status.value)
  || (status.value === 'playbackPaused' && replayReturnStatus === 'recordingPaused'))
const practiceRecordLabel = computed(() => {
  if (status.value === 'recording') return t('record.pause')
  if (status.value === 'recordingPaused' || (status.value === 'playbackPaused' && replayReturnStatus === 'recordingPaused')) return t('record.continue')
  if (status.value === 'completed' || status.value === 'playing' || status.value === 'playbackPaused') return t('record.stopped')
  return t('record.record')
})

const disconnectRecorder = connectRecorder({
  onStart: () => { void startAccompaniment() },
  onFrame: analyzeFrame,
  onStop: finishRecording,
  onError: () => {
    audioTransport.stop()
    status.value = 'ready'
    stopRenderTimer()
    uni.showToast({ title: t('record.recordingStartFailed'), icon: 'none' })
  }
})

onMounted(initCanvas)
onUnload(cleanup)

async function initCanvas() {
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
  canvasWidth.value = Math.max(1, info.windowWidth)
  safeBottom.value = info.safeAreaInsets?.bottom
    ?? Math.max(0, info.screenHeight - (info.safeArea?.bottom ?? info.screenHeight))
  toolbarHeight.value = uni.upx2px(TOOLBAR_HEIGHT_RPX) + safeBottom.value
  const reservedHeight = uni.upx2px(SESSION_HEADER_HEIGHT_RPX + TIME_BAR_HEIGHT_RPX + TOOLBAR_HEIGHT_RPX) + safeBottom.value
  canvasHeight.value = Math.max(CANVAS_MINIMUM_HEIGHT, info.windowHeight - reservedHeight)
  await nextTick()
  const surface = await createPitchCanvasSurface({
    id: 'practiceCanvas',
    width: canvasWidth.value,
    height: canvasHeight.value,
    pixelRatio: info.pixelRatio || 1,
    component: instance?.proxy
  })
  context = surface.context
  directCanvas = surface.direct
  commitCanvas = surface.commit
  draw()
}

async function startPractice() {
  if (status.value !== 'ready') return
  status.value = 'preparing'
  position.value = 0
  userPoints.splice(0)
  pcmChunks.splice(0)
  engine.reset()
  accumulator.reset()
  try {
    await audioTransport.prepare(props.manifest.audioPath)
    await requestMicrophonePermission()
    resumeRecorderOnGate = webPlatform
    await startRecorder({ startPaused: webPlatform })
    recordingSessionOpen = true
  } catch {
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
  position.value = currentPosition()
  startRenderTimer()
}

function failTransport() {
  audioTransport.stop()
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
  if (status.value === 'recordingPaused' || (status.value === 'playbackPaused' && replayReturnStatus === 'recordingPaused')) {
    resumePracticeSession()
  }
}

async function pausePracticeSession() {
  if (status.value !== 'recording') return
  recordingPausedAt = currentPosition()
  position.value = recordingPausedAt
  audioTransport.pausePractice()
  pauseRecorder()
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
  void audioTransport.startPractice({
    onStarted: openRecordingGate,
    onEnded: endPractice,
    onError: failTransport
  }, recordingPausedAt).catch(failTransport)
}

async function refreshPausedPreview() {
  try {
    let previewPath = ''
    let previewBlob: Blob | undefined
    if (miniProgramPlatform && pcmChunks.length > 0) {
      previewPath = await createPcmPreview(joinPcmChunks())
    } else if (webPlatform) {
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

function joinPcmChunks() {
  const byteLength = pcmChunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const pcm = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of pcmChunks) {
    pcm.set(chunk, offset)
    offset += chunk.byteLength
  }
  return pcm.buffer
}

function analyzeFrame(buffer: ArrayBuffer | Float32Array, sampleRate = recorderAnalysisConfig.sampleRate) {
  if (status.value !== 'recording') return
  if (miniProgramPlatform && buffer instanceof ArrayBuffer) pcmChunks.push(new Uint8Array(buffer.slice(0)))
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
    if (!result) return
    if (result.voiced && result.midi !== null) {
      unvoicedFrames = 0
      userPoints.push({ time: result.time, midi: result.midi, confidence: result.confidence })
    } else if (++unvoicedFrames === 3) {
      userPoints.push({ time: result.time, midi: null, confidence: 0 })
    }
  })
}

function endPractice() {
  if (status.value !== 'recording' && status.value !== 'preparing') return
  position.value = Math.min(props.manifest.duration, currentPosition())
  audioTransport.stop()
  status.value = 'finishing'
  stopRenderTimer()
  stopRecorder()
}

async function finishRecording(result: { tempFilePath: string; blob?: Blob }) {
  recordingSessionOpen = false
  if (discardPendingRecording) {
    discardPendingRecording = false
    deleteTemporaryAudio(result.tempFilePath)
    return
  }
  if (temporaryPcmPreview && temporaryPcmPreview !== result.tempFilePath) deleteTemporaryAudio(temporaryPcmPreview)
  temporaryPcmPreview = ''
  recordingPath.value = result.tempFilePath
  recordingBlob = result.blob
  if (miniProgramPlatform && pcmChunks.length > 0) {
    deleteTemporaryAudio(temporaryPcmPreview)
    temporaryPcmPreview = await createPcmPreview(joinPcmChunks())
    recordingPath.value = temporaryPcmPreview
  }
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
  const replayEnd = replayReturnStatus === 'recordingPaused' ? recordingPausedAt : props.manifest.duration
  position.value = 0
  status.value = 'preparing'
  void audioTransport.startReplay(recordingPath.value, {
    onStarted: () => {
      status.value = 'playing'
      startRenderTimer()
    },
    onEnded: completeReplay,
    onError: failReplay
  }, replayEnd).catch(failReplay)
}

function completeReplay() {
  status.value = replayReturnStatus
  position.value = replayReturnStatus === 'recordingPaused' ? recordingPausedAt : props.manifest.duration
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
  pcmChunks.splice(0)
  engine.reset()
  accumulator.reset()
  status.value = 'ready'
  completedEventSent = false
  practiceEventId = ''
  practiceStartedAt = ''
  draw()
}

async function downloadPractice() {
  if (!canDownload.value) return
  try {
    await exportAudio({
      filePath: recordingPath.value,
      name: t('practice.exercises.mumOctave.title')
    })
  } catch {
    uni.showToast({ title: t('record.exportFailed'), icon: 'none' })
  }
}

function currentPosition() {
  return Math.min(props.manifest.duration, audioTransport.position())
}

function startRenderTimer() {
  stopRenderTimer()
  renderTimer = setInterval(() => {
    position.value = currentPosition()
    draw()
  }, RENDER_INTERVAL_MS)
}

function stopRenderTimer() {
  if (renderTimer) clearInterval(renderTimer)
  renderTimer = undefined
}

function draw() {
  if (!context) return
  const ctx = context
  const width = canvasWidth.value
  const height = canvasHeight.value
  const plotWidth = width - AXIS_WIDTH
  const minimumMidi = props.manifest.range.minimumMidi - ROW_PADDING
  const maximumMidi = props.manifest.range.maximumMidi + ROW_PADDING
  const rowHeight = height / (maximumMidi - minimumMidi + 1)
  const viewStart = Math.max(0, position.value - plotWidth * PLAYHEAD_RATIO / PIXELS_PER_SECOND)
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

  setStroke(ctx, '#356b5b', 2.5)
  ctx.beginPath()
  let drawing = false
  for (const point of userPoints) {
    if (point.time < viewStart || point.time > viewEnd || point.midi === null) {
      drawing = false
      continue
    }
    const x = (point.time - viewStart) * PIXELS_PER_SECOND
    const y = (maximumMidi - point.midi + 0.5) * rowHeight
    if (!drawing) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    drawing = true
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
  stopRenderTimer()
  if (recordingSessionOpen) {
    discardPendingRecording = true
    stopRecorder()
  }
  disconnectRecorder()
  audioTransport.destroy()
  deleteTemporaryAudio(temporaryPcmPreview)
}
</script>

<style scoped>
.session-page { display: flex; height: 100vh; overflow: hidden; flex-direction: column; background: #fff; }
.session-header { display: flex; min-height: 92rpx; align-items: center; padding: 12rpx 24rpx; border-bottom: 1px solid #d3e2dc; box-sizing: border-box; }
.back { display: flex; width: 64rpx; height: 64rpx; align-items: center; justify-content: center; color: #356b5b; font-size: 54rpx; }
.session-copy { display: flex; min-width: 0; flex-direction: column; }
.session-title { color: #294c43; font-size: 28rpx; font-weight: 900; }
.session-range { margin-top: 5rpx; color: #6b8179; font-size: 21rpx; }
.canvas-stage { position: relative; width: 100%; flex: none; overflow: hidden; }
.canvas { position: absolute; top: 0; left: 0; display: block; }
.legend { position: absolute; z-index: 2; top: 16rpx; left: 18rpx; display: flex; gap: 10rpx; }
.legend-target, .legend-user { padding: 7rpx 12rpx; border-radius: 999rpx; font-size: 18rpx; }
.legend-target { color: #356b5b; background: rgba(217, 238, 230, 0.92); }
.legend-user { color: #fff; background: rgba(53, 107, 91, 0.92); }
.session-status { display: flex; height: 50rpx; align-items: center; justify-content: space-between; padding: 0 24rpx; color: #fff; background: #356b5b; font-size: 21rpx; }
.session-time { font-variant-numeric: tabular-nums; font-weight: 800; }
/* #ifdef H5 */
.session-page { height: calc(100vh - var(--window-top) - var(--window-bottom)); }
/* #endif */
</style>
