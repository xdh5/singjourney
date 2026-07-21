<template>
  <view class="page">
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
      <!-- #ifdef MP-WEIXIN -->
      <canvas
        id="pitchCanvas"
        type="2d"
        class="pitch-canvas"
        disable-scroll
        :style="{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }"
      />
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <canvas
        id="pitchCanvas"
        canvas-id="pitchCanvas"
        class="pitch-canvas"
        disable-scroll
        :style="{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }"
      />
      <!-- #endif -->

      <view class="page-mode" @touchstart.stop @touchmove.stop>
        {{ recordingDetailMode ? t('record.playbackMode') : t('record.freeRecordingMode') }}
      </view>

      <view class="top-actions" @touchstart.stop @touchmove.stop>
        <view
          v-if="!recordingDetailMode"
          class="top-action"
          :class="{ disabled: !hasStarted || saving }"
          role="button"
          @tap.stop="saveRecording"
        >
          <image class="top-action-icon" src="/static/icons/save.svg" />
          <text>{{ saving ? t('record.saving') : t('record.save') }}</text>
        </view>

        <!-- #ifdef MP-WEIXIN -->
        <button v-if="preparedShare" class="top-action top-share-button" open-type="share">
          <image class="top-action-icon" src="/static/icons/share.svg" />
          <text>{{ t('record.share') }}</text>
        </button>
        <view v-else class="top-action" :class="{ disabled: !playablePath || sharing }" role="button" @tap.stop="shareRecording">
          <image class="top-action-icon" src="/static/icons/share.svg" />
          <text>{{ sharing ? t('record.generating') : t('record.share') }}</text>
        </view>
        <!-- #endif -->

        <!-- #ifndef MP-WEIXIN -->
        <view class="top-action" :class="{ disabled: !playablePath || sharing }" role="button" @tap.stop="shareRecording">
          <image class="top-action-icon" src="/static/icons/share.svg" />
          <text>{{ sharing ? t('record.generating') : t('record.share') }}</text>
        </view>
        <!-- #endif -->
      </view>

      <view v-if="showAiEntry" class="ai-entry" role="button" @tap.stop="showAiComingSoon" @touchstart.stop @touchmove.stop>
        <view class="ai-copy">
          <text class="ai-title">{{ t('record.aiTitle') }}</text>
          <text class="ai-subtitle">{{ t('record.aiSubtitle') }}</text>
        </view>
        <text class="ai-chevron">›</text>
      </view>
    </view>

    <view class="time-bar">{{ timeLabel }}</view>

    <recording-toolbar
      :height="toolbarHeight"
      :safe-bottom="safeBottom"
      :clear-label="recordingDetailMode ? t('record.delete') : t('record.clear')"
      :play-label="isPlaying ? t('record.pause') : t('record.play')"
      :record-label="recordLabel"
      :download-label="t('record.download')"
      :is-playing="isPlaying"
      :is-recording="isRecording"
      :playback-disabled="!playablePath"
      :download-disabled="!playablePath"
      :show-record="!recordingDetailMode"
      :detail-mode="recordingDetailMode"
      @clear="clearRecording"
      @play="togglePlayback"
      @record="toggleRecording"
      @download="downloadRecording"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { onHide, onLoad, onReady, onShareAppMessage, onShow, onUnload } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { AudioFrameAccumulator, PitchEngine, pcm16ToFloat32 } from '@singjourney/pitch-core'
import { createCurveCommands } from '@singjourney/curve-layout'
import RecordingToolbar from './components/recording-toolbar.vue'
import {
  MAX_RECORDING_DURATION_SECONDS,
  RECORDING_DURATION_WARNING_AT_SECONDS,
  type StoredPitchPoint
} from '@singjourney/contracts'
import { formatRecordingName, formatTime, getPlaybackSource, getRecording, removeRecording, storeRecording } from './shared/recordings'
import { exportAudio } from './platform/export-audio'
import { createPitchCanvasSurface } from './platform/pitch-canvas'
import { createPcmPreview, deleteTemporaryAudio } from './platform/audio-files'
import { prepareShareAudio } from './platform/share-audio'
import { createRecordingShare, type ActivatedShare } from './shared/sharing'
import { setPageTitle } from './i18n'
import { lockDocumentScroll, unlockDocumentScroll } from './platform/page-scroll'
import {
  drawPitchAxis,
  drawPitchGrid,
  PITCH_MAXIMUM_MIDI,
  PITCH_MINIMUM_MIDI
} from './shared/pitch-canvas-renderer'
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
} from './platform/recorder'

const SAMPLE_RATE = recorderAnalysisConfig.sampleRate
const BUFFER_SIZE = recorderAnalysisConfig.frameSize
const MIN_MIDI = PITCH_MINIMUM_MIDI
const MAX_MIDI = PITCH_MAXIMUM_MIDI
const ROW_HEIGHT = 18
const AXIS_WIDTH = 52
const PIXELS_PER_SECOND = 72
const CURVE_RENDER_DELAY_SECONDS = 0.07
const DIRECT_RENDER_INTERVAL_MS = 1000 / 60
const PCM_BLOCK_SIZE = 64 * 1024
const PLAYHEAD_RATIO = 0.5
const TIME_BAR_HEIGHT_RPX = 38
const TOOLBAR_HEIGHT_RPX = 144

const canvasWidth = ref(375)
const canvasHeight = ref(500)
const toolbarHeight = ref(72)
const safeBottom = ref(0)
const isRecording = ref(false)
const hasStarted = ref(false)
const saving = ref(false)
const sharing = ref(false)
const isPlaying = ref(false)
const playablePath = ref('')
const timeLabel = ref('00:00')
const playbackPosition = ref(0)
const recordingDetailMode = ref(false)
const preparedShare = ref<ActivatedShare | null>(null)

const fallbackPitchDetector = true
const primaryPitchDetector: 'yin' | 'macleod' = 'yin'

let engineSampleRate = SAMPLE_RATE
let engine = new PitchEngine({
  sampleRate: SAMPLE_RATE,
  bufferSize: BUFFER_SIZE,
  fallbackDetector: fallbackPitchDetector,
  primaryDetector: primaryPitchDetector
})
const accumulator = new AudioFrameAccumulator(BUFFER_SIZE)
const points: StoredPitchPoint[] = []
const player = uni.createInnerAudioContext()
const instance = getCurrentInstance()
const { t } = useI18n()

let context: any = null
let directCanvas = false
let canvasNode: any = null
let commitCanvas = () => {}
let canvasInitialized = false
let canvasDrawQueued = false
let miniProgramPlatform = false
// #ifdef MP-WEIXIN
miniProgramPlatform = true
// #endif
let pitchWorker: any = null
let workerBusy = false
let startedAt = 0
let pausedDuration = 0
let pauseStartedAt = 0
let elapsed = 0
let sampleCount = 0
let timer: ReturnType<typeof setInterval> | undefined
let renderTimer: ReturnType<typeof setInterval> | undefined
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
let playerHasSource = false
let playerSourcePath = ''
let ignoreEndedBefore = 0
let playbackStarting = false
let playbackStartPosition = 0
let recordingClockPosition = 0
let recordingClockAt = 0
let lastDetectedMidi = 60
let lastAnalysisAt = 0
let unvoicedFrames = 0
let pendingAction: 'save' | 'stop' | null = null
let tempFilePath = ''
let tempBlob: Blob | undefined
let discardStop = false
let exportName = ''
let pcmBlocks: Uint8Array[] = []
let pcmBlock = new Uint8Array(PCM_BLOCK_SIZE)
let pcmBlockOffset = 0
let pcmByteLength = 0
let previewAudioPath = ''
let currentRecordingId = ''
let durationWarningShown = false
let durationLimitHandled = false

const recordLabel = computed(() => {
  if (isRecording.value) return recorderCapabilities.pause ? t('record.pause') : t('record.stop')
  if (hasStarted.value && recorderCapabilities.pause && !tempFilePath) return t('record.continue')
  if (hasStarted.value && tempFilePath) return t('record.stopped')
  return t('record.record')
})

const showAiEntry = computed(() => !isRecording.value && (
  recordingDetailMode.value || hasStarted.value || Boolean(playablePath.value)
))

const disconnectRecorder = connectRecorder({
  onStart: () => {
    isRecording.value = true
    hasStarted.value = true
  },
  onFrame: handleFrame,
  onStop: handleStop,
  onError: message => {
    isRecording.value = false
    saving.value = false
    clearTimer()
    clearRenderTimer()
    uni.showToast({ title: message, icon: 'none' })
  }
})

player.onTimeUpdate(syncPlaybackPosition)
player.onCanplay(() => {
  if (!playbackStarting || pendingPlayerSeek === null) return
  const position = pendingPlayerSeek
  pendingPlayerSeek = null
  if (position <= 0.01) {
    startPreparedPlayback(position)
    return
  }
  awaitingPlayerSeek = position
  player.seek(position)
})
player.onPlay(() => {
  if (!playbackStarting) return
  playbackStarting = false
  isPlaying.value = true
  playbackHasStarted = true
  const actualTime = Number((player as any).currentTime)
  const position = Number.isFinite(actualTime) && Math.abs(actualTime - playbackStartPosition) < 0.5
    ? actualTime
    : playbackStartPosition
  playbackPosition.value = position
  playbackAnchorPosition = position
  playbackAnchorAt = Date.now()
  clearTimer()
  timer = setInterval(updateClock, 100)
  startRenderTimer()
  updateClock()
  draw()
})
player.onSeeked(() => {
  if (awaitingPlayerSeek === null) return
  const position = awaitingPlayerSeek
  awaitingPlayerSeek = null
  startPreparedPlayback(position)
})
player.onEnded(() => {
  if (Date.now() < ignoreEndedBefore) return
  const predictedTime = currentPlaybackPosition()
  isPlaying.value = false
  playbackStarting = false
  pendingPlayerSeek = null
  awaitingPlayerSeek = null
  const actualTime = Number((player as any).currentTime)
  playbackPosition.value = Number.isFinite(actualTime) && Math.abs(actualTime - predictedTime) < 0.5
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
player.onError(() => {
  isPlaying.value = false
  playbackStarting = false
  pendingPlayerSeek = null
  awaitingPlayerSeek = null
  clearTimer()
  clearRenderTimer()
})

onReady(initCanvas)
onMounted(async () => {
  await nextTick(initCanvas)
})
onLoad(loadRecordingDetail)
onShow(lockDocumentScroll)
onHide(unlockDocumentScroll)
onUnload(() => {
  unlockDocumentScroll()
  clearTimer()
  clearRenderTimer()
  clearViewportAnimationTimer()
  cancelSeekAnimation()
  if (hasStarted.value && !tempFilePath) {
    discardStop = true
    stopRecorder()
  }
  disconnectRecorder()
  pitchWorker?.terminate?.()
  pitchWorker = null
  workerBusy = false
  deleteTemporaryAudio(previewAudioPath)
  player.destroy()
})

onShareAppMessage(() => ({
  title: preparedShare.value ? t('record.shareMessage', { title: preparedShare.value.title }) : t('app.name'),
  path: preparedShare.value ? `/share?id=${encodeURIComponent(preparedShare.value.id)}` : '/home'
}))

async function loadRecordingDetail(options: Record<string, string | undefined> = {}) {
  const id = options?.id ? decodeURIComponent(options.id) : ''
  setPageTitle('app.name')
  if (!id) return
  recordingDetailMode.value = true
  currentRecordingId = id
  try {
    const recording = await getRecording(id)
    if (!recording) throw new Error('recording not found')
    points.splice(0, points.length, ...(Array.isArray(recording.points) ? recording.points : []))
    elapsed = Math.max(0, recording.duration || 0)
    playbackPosition.value = elapsed
    playbackHasStarted = false
    hasManualSeek = false
    playablePath.value = await getPlaybackSource(recording)
    exportName = formatRecordingName(new Date(recording.createdAt), t('record.defaultName'))
    const lastVoicedPoint = [...points].reverse().find(point => point.midi !== null)
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
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
  const width = info.windowWidth
  safeBottom.value = info.safeAreaInsets?.bottom
    ?? (info.safeArea ? Math.max(0, info.screenHeight - info.safeArea.bottom) : 0)
  toolbarHeight.value = uni.upx2px(TOOLBAR_HEIGHT_RPX) + safeBottom.value
  const footerHeight = uni.upx2px(TIME_BAR_HEIGHT_RPX) + toolbarHeight.value
  canvasWidth.value = Math.max(1, width)
  canvasHeight.value = Math.max(240, info.windowHeight - footerHeight)
  await nextTick()
  const surface = await createPitchCanvasSurface({
    id: 'pitchCanvas',
    width: canvasWidth.value,
    height: canvasHeight.value,
    pixelRatio: info.pixelRatio || 1,
    component: instance?.proxy
  })
  context = surface.context
  directCanvas = surface.direct
  canvasNode = surface.node
  commitCanvas = surface.commit
  initPitchWorker()
  draw()
}

function initPitchWorker() {
  if (pitchWorker) return
  // #ifdef H5
  try {
    const webWorker = new Worker(new URL('./workers/pitch-web-worker.ts', import.meta.url), { type: 'module' })
    webWorker.onmessage = event => handlePitchWorkerMessage(event.data)
    webWorker.onerror = disablePitchWorker
    pitchWorker = webWorker
    return
  } catch {
    pitchWorker = null
  }
  // #endif

  if (!miniProgramPlatform) return
  try {
    const wxApi = (globalThis as any).wx
    if (!wxApi?.createWorker) return
    pitchWorker = wxApi.createWorker('static/workers/pitch.js')
    pitchWorker.onMessage(handlePitchWorkerMessage)
    pitchWorker.onError?.(disablePitchWorker)
  } catch {
    pitchWorker = null
    workerBusy = false
  }
}

function handlePitchWorkerMessage(result: any) {
  workerBusy = false
  if (!isRecording.value || result?.type === 'reset') return
  handlePitchResult(result)
}

function disablePitchWorker() {
  workerBusy = false
  pitchWorker?.terminate?.()
  pitchWorker = null
}

async function toggleRecording() {
  if (recordingDetailMode.value) return
  preparedShare.value = null
  stopPlayback()
  if (isRecording.value) {
    if (recorderCapabilities.pause) {
      elapsed = Math.max(elapsed, currentElapsed())
      pauseRecorder()
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
    } else {
      pendingAction = 'stop'
      isRecording.value = false
      elapsed = Math.max(elapsed, (Date.now() - startedAt - pausedDuration) / 1000)
      clearTimer()
      clearRenderTimer()
      stopRecorder()
    }
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
    try {
      await requestMicrophonePermission()
      resetAnalysis()
      startedAt = Date.now()
      await startRecorder()
      uni.showToast({ title: t('record.durationLimitNotice'), icon: 'none', duration: 2500 })
    } catch {
      uni.showModal({
        title: t('record.microphonePermissionTitle'),
        content: t('record.recordingStartFailed'),
        showCancel: false
      })
      return
    }
  } else {
    pausedDuration += Date.now() - pauseStartedAt
    stopPlayback()
    deleteTemporaryAudio(previewAudioPath)
    previewAudioPath = ''
    playablePath.value = ''
    setViewportTarget(lastDetectedMidi)
    draw()
    resumeRecorder()
  }

  isRecording.value = true
  hasStarted.value = true
  clearTimer()
  timer = setInterval(updateClock, 100)
  startRenderTimer()
}

function handleFrame(buffer: ArrayBuffer | Float32Array, sourceSampleRate = SAMPLE_RATE) {
  const nativeWebFrame = buffer instanceof Float32Array
  if (miniProgramPlatform) {
    if (!(buffer instanceof ArrayBuffer)) return
    appendPcm(buffer)
    recordingClockPosition = pcmByteLength / (SAMPLE_RATE * 2)
    recordingClockAt = Date.now()
  }
  const analysisNow = Date.now()
  if (!nativeWebFrame && analysisNow - lastAnalysisAt < (pitchWorker ? 28 : 90)) return

  if (pitchWorker) {
    if (workerBusy) return
    lastAnalysisAt = analysisNow
    workerBusy = true
    try {
      pitchWorker.postMessage({ type: 'analyze', buffer, sampleRate: sourceSampleRate, time: currentElapsed() })
    } catch {
      workerBusy = false
    }
    return
  }

  if (sourceSampleRate !== engineSampleRate) {
    engineSampleRate = sourceSampleRate
    engine = new PitchEngine({
      sampleRate: engineSampleRate,
      bufferSize: BUFFER_SIZE,
      fallbackDetector: fallbackPitchDetector,
      primaryDetector: primaryPitchDetector
    })
    accumulator.reset()
  }

  const samples = buffer instanceof Float32Array ? buffer : pcm16ToFloat32(buffer)
  accumulator.push(samples, (frame: Float32Array) => {
    sampleCount += frame.length
    const frameNow = Date.now()
    if (!nativeWebFrame && frameNow - lastAnalysisAt < 90) return
    lastAnalysisAt = frameNow
    elapsed = currentElapsed()
    const result = engine.analyze(frame, elapsed)
    if (result) handlePitchResult(result)
  })
}

function handlePitchResult(result: { time: number; frequency?: number | null; midi: number | null; confidence: number; voiced: boolean }) {
  elapsed = Math.max(elapsed, result.time)
  const last = points[points.length - 1]
  if (result.voiced && result.midi !== null) {
    unvoicedFrames = 0
    points.push({ time: result.time, midi: result.midi, confidence: result.confidence })
    lastDetectedMidi = result.midi
    followRecordedPitch(result.midi)
    return
  }

  unvoicedFrames += 1
  if (unvoicedFrames === 4 && (!last || last.midi !== null)) {
    points.push({ time: result.time, midi: null, confidence: 0 })
  }
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
  if (discardStop) {
    discardStop = false
    return
  }
  tempFilePath = result.tempFilePath
  tempBlob = result.blob
  playablePath.value = recorderCapabilities.realtimeFrames ? '' : result.tempFilePath
  isRecording.value = false
  clearTimer()
  clearRenderTimer()
  elapsed = miniProgramPlatform && pcmByteLength > 0
    ? pcmByteLength / (SAMPLE_RATE * 2)
    : Math.max(elapsed, (Date.now() - startedAt - pausedDuration) / 1000)
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
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const date = new Date()
    const stored = await storeRecording({
      tempFilePath,
      blob: tempBlob,
      recording: {
        id,
        name: formatRecordingName(date, t('record.defaultName')),
        duration: elapsed,
        createdAt: date.toISOString(),
        pointCount: points.length,
        points: [...points]
      }
    })
    deleteTemporaryAudio(previewAudioPath)
    previewAudioPath = ''
    playablePath.value = await getPlaybackSource(stored)
    exportName = stored.name
    tempFilePath = ''
    tempBlob = undefined
    hasStarted.value = false
    saving.value = false
    uni.showToast({ title: t('record.saved'), icon: 'success' })
  } catch {
    saving.value = false
    uni.showToast({ title: t('record.saveFailed'), icon: 'none' })
  }
}

async function clearRecording() {
  if (recordingDetailMode.value) {
    const result = await uni.showModal({
      title: t('record.deleteTitle'),
      content: t('record.deleteCurrentConfirm')
    })
    if (!result.confirm) return
    stopPlayback()
    await removeRecording(currentRecordingId)
    uni.navigateBack()
    return
  }
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
  tempFilePath = ''
  tempBlob = undefined
  exportName = ''
  preparedShare.value = null
  deleteTemporaryAudio(previewAudioPath)
  previewAudioPath = ''
  timeLabel.value = '00:00'
  draw()
}

function resetAnalysis() {
  points.splice(0)
  elapsed = 0
  playbackPosition.value = 0
  playbackHasStarted = false
  hasManualSeek = false
  recordingClockPosition = 0
  recordingClockAt = 0
  sampleCount = 0
  lastAnalysisAt = 0
  unvoicedFrames = 0
  pausedDuration = 0
  durationWarningShown = false
  durationLimitHandled = false
  viewportCenterMidi.value = 60
  viewportTargetMidi = 60
  viewportAnimationAt = 0
  lastDetectedMidi = 60
  engine.reset()
  accumulator.reset()
  workerBusy = false
  pitchWorker?.postMessage?.({ type: 'reset' })
  resetPcm()
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

function pcmSnapshot() {
  const snapshot = new Uint8Array(pcmByteLength)
  let offset = 0
  for (const block of pcmBlocks) {
    snapshot.set(block, offset)
    offset += block.length
  }
  if (pcmBlockOffset > 0) snapshot.set(pcmBlock.subarray(0, pcmBlockOffset), offset)
  return snapshot.buffer
}

async function refreshPausedPlayback() {
  try {
    const preview = miniProgramPlatform
      ? (pcmByteLength > 0 ? { tempFilePath: await createPcmPreview(pcmSnapshot()) } : null)
      : await createPausedRecorderPreview()
    if (!preview) return
    deleteTemporaryAudio(previewAudioPath)
    previewAudioPath = preview.tempFilePath
    playablePath.value = preview.tempFilePath
  } catch {
    uni.showToast({ title: t('record.previewFailed'), icon: 'none' })
  }
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
  const canReuseLoadedSource = playerHasSource && playerSourcePath === playablePath.value
  if (playerHasSource) {
    ignoreEndedBefore = Date.now() + 500
    player.stop()
  }
  if (canReuseLoadedSource) {
    const position = playbackPosition.value
    pendingPlayerSeek = null
    if (position <= 0.01) startPreparedPlayback(position)
    else {
      awaitingPlayerSeek = position
      player.seek(position)
    }
    return
  }
  player.src = playablePath.value
  playerHasSource = true
  playerSourcePath = playablePath.value
  ;(player as any).startTime = playbackPosition.value
  // InnerAudioContext may not emit canplay for an already prepared local
  // preview. Start immediately and let it finish loading internally; otherwise
  // the first tap only assigns src and the second tap is the one that plays.
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
  if (playerHasSource) {
    ignoreEndedBefore = Date.now() + 500
    player.stop()
  }
  clearTimer()
  clearRenderTimer()
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
  if (!isPlaying.value || pendingPlayerSeek !== null) return
  const currentTime = Number((player as any).currentTime)
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
  return new Promise<void>(resolve => {
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
    playbackPosition.value = clamp(dragStartPlaybackPosition - deltaX / PIXELS_PER_SECOND, 0, elapsed)
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
  try {
    await exportAudio({
      filePath: playablePath.value,
      name: exportName || formatRecordingName(new Date(), t('record.defaultName'))
    })
  } catch {
    uni.showToast({ title: t('record.exportFailed'), icon: 'none' })
  }
}

async function shareRecording() {
  if (!playablePath.value || sharing.value) return
  if (elapsed > MAX_RECORDING_DURATION_SECONDS) {
    uni.showToast({ title: t('record.durationTooLongToShare'), icon: 'none' })
    return
  }
  sharing.value = true
  uni.showLoading({ title: t('record.generatingShare'), mask: true })
  try {
    const audio = await prepareShareAudio(playablePath.value, tempBlob)
    const share = await createRecordingShare({
      title: exportName || formatRecordingName(new Date(), t('record.defaultName')),
      durationSeconds: elapsed,
      points: [...points],
      audio
    })
    preparedShare.value = share
    // #ifdef MP-WEIXIN
    uni.showToast({ title: t('record.shareReady'), icon: 'none' })
    // #endif
    // #ifdef H5
    if (navigator.share) await navigator.share({ title: share.title, url: share.share_url })
    else await uni.setClipboardData({ data: share.share_url })
    // #endif
    // #ifdef APP-PLUS
    await (uni as any).shareWithSystem({
      type: 'text',
      summary: t('record.shareSummary', { title: share.title }),
      href: share.share_url
    })
    // #endif
  } catch {
    uni.showToast({ title: t('record.shareFailed'), icon: 'none' })
  } finally {
    uni.hideLoading()
    sharing.value = false
  }
}

function showAiComingSoon() {
  uni.showToast({ title: t('record.aiComingSoon'), icon: 'none' })
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
  renderTimer = setInterval(draw, directCanvas ? DIRECT_RENDER_INTERVAL_MS : 120)
}

function clearRenderTimer() {
  if (renderTimer !== undefined) clearInterval(renderTimer)
  renderTimer = undefined
  ensureViewportAnimationTimer()
}

function currentElapsed() {
  if (miniProgramPlatform && hasStarted.value) {
    return Math.max(elapsed, pcmByteLength / (SAMPLE_RATE * 2))
  }
  if (!startedAt) return elapsed
  return Math.max(elapsed, (Date.now() - startedAt - pausedDuration) / 1000)
}

function currentRecordingPosition() {
  const exactPosition = currentElapsed()
  if (!miniProgramPlatform || !isRecording.value || !recordingClockAt) return exactPosition
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
    if (Math.abs(viewportTargetMidi - viewportCenterMidi.value) < 0.015) clearViewportAnimationTimer()
  }, DIRECT_RENDER_INTERVAL_MS)
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

function draw() {
  const cursorTime = isRecording.value
    ? Math.max(0, currentRecordingPosition() - CURVE_RENDER_DELAY_SECONDS)
    : currentPlaybackPosition()
  if (isPlaying.value || isRecording.value || dragMode === 'time') {
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
  const playheadX = plotWidth * PLAYHEAD_RATIO
  const startTime = cursorTime - playheadX / PIXELS_PER_SECOND
  const commands = createCurveCommands(points, {
    startTime,
    width: plotWidth,
    pixelsPerSecond: PIXELS_PER_SECOND,
    maxMidi: viewportMaxMidi,
    rowHeight: ROW_HEIGHT
  })
  if (directCanvas) {
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#4b806f'
  } else {
    ctx.setLineWidth(3)
    ctx.setLineCap('round')
    ctx.setLineJoin('round')
    ctx.setStrokeStyle('#4b806f')
  }
  ctx.beginPath()
  for (const command of commands) {
    if (command.type === 'move') ctx.moveTo(command.x, command.y)
    else if (command.type === 'quad') ctx.quadraticCurveTo(command.cx, command.cy, command.x, command.y)
    else if (command.type === 'line') ctx.lineTo(command.x, command.y)
    else { ctx.stroke(); ctx.beginPath() }
  }
  ctx.stroke()

  if (directCanvas) {
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1f5e4c'
  } else {
    ctx.setLineWidth(2)
    ctx.setStrokeStyle('#1f5e4c')
  }
  ctx.beginPath()
  ctx.moveTo(playheadX, 0)
  ctx.lineTo(playheadX, height)
  ctx.stroke()
  // Keep the pitch rail as the final canvas layer so curve/playhead drawing
  // can never cover or clear the C1-C8 labels on the right.
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

<style scoped>
.page { display: flex; width: 100%; height: 100vh; overflow: hidden; flex-direction: column; background: #fff; }
/* #ifdef H5 */
.page { height: calc(100vh - var(--window-top) - var(--window-bottom)); }
/* #endif */
.pitch-stage { position: relative; width: 100%; flex: none; overflow: hidden; background: #fff; cursor: grab; user-select: none; }
.pitch-stage:active { cursor: grabbing; }
.pitch-canvas { position: absolute; z-index: 1; top: 0; left: 0; display: block; background: transparent; }
.page-mode {
  position: absolute;
  z-index: 4;
  top: 18rpx;
  left: 24rpx;
  display: flex;
  min-width: 112rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  padding: 0 18rpx;
  border: 1px solid #c9ddd5;
  border-radius: 999rpx;
  box-sizing: border-box;
  color: #356b5b;
  background: rgba(255, 255, 255, 0.94);
  font-size: 23rpx;
  font-weight: 700;
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

.share-button::after { border: 0; }

.top-actions {
  position: absolute;
  z-index: 4;
  top: 18rpx;
  right: 76rpx;
  display: flex;
  gap: 14rpx;
}

.top-action {
  display: flex;
  min-width: 112rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin: 0;
  padding: 0 18rpx;
  border: 1px solid #c9ddd5;
  border-radius: 999rpx;
  box-sizing: border-box;
  color: #356b5b;
  background: rgba(255, 255, 255, 0.94);
  font-size: 23rpx;
  line-height: 1;
}

.top-action.disabled { opacity: 0.4; }
.top-action-icon { width: 28rpx; height: 28rpx; }
.top-share-button::after { border: 0; }

.ai-entry {
  position: absolute;
  z-index: 4;
  right: 76rpx;
  bottom: 24rpx;
  left: 24rpx;
  display: flex;
  min-height: 94rpx;
  align-items: center;
  gap: 18rpx;
  padding: 16rpx 22rpx;
  border: 1px solid #bcd4cb;
  border-radius: 20rpx;
  box-sizing: border-box;
  background: rgba(237, 245, 241, 0.96);
  color: #294c43;
}

.ai-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.ai-title { font-size: 28rpx; font-weight: 800; }
.ai-subtitle { margin-top: 6rpx; color: #6b8179; font-size: 21rpx; }
.ai-chevron { color: #507064; font-size: 36rpx; }
</style>
