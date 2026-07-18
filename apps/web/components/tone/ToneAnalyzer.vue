<template>
  <section class="tracker-page">
    <header class="tracker-header">
      <NuxtLink class="header-button" :to="mode === 'playback' ? '/recordings' : '/'" aria-label="返回"><i class="bi bi-chevron-left"></i></NuxtLink>
      <h1>{{ mode === 'playback' ? recordingName : '自由录音' }}</h1><span aria-hidden="true"></span>
    </header>

    <div ref="trackerShell" class="tracker-shell">
      <div class="pitch-board" :style="{ height: `${boardHeight}px` }" @pointerdown="startTimelinePan">
        <canvas ref="canvasRef" class="pitch-canvas"></canvas>
        <div class="playhead" :style="{ left: `${playheadX}px` }" @pointerdown.stop="startPlayheadSeek"></div>
        <div class="pitch-axis">
          <div v-for="note in axisNotes" :key="note.midi" class="axis-row" :class="{ c: note.pitchClass === 'C', a: note.pitchClass === 'A' }"><span>{{ note.name }}</span></div>
        </div>
      </div>
    </div>

    <div class="time-bar"><span>{{ formatTime(playbackCursor) }}/{{ formatTime(totalDuration) }}</span></div>
    <nav class="bottom-toolbar" aria-label="录音工具栏">
      <button v-if="mode === 'record'" class="tool-button" type="button" aria-label="清空" @click="clearTrack"><i class="bi bi-trash3"></i></button>
      <button class="tool-button" type="button" :disabled="!recordedAudioUrl" :aria-label="isPlaying ? '暂停播放' : '播放录音'" @click="toggleRecordingPlayback"><i :class="isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill'"></i></button>
      <button v-if="mode === 'record'" class="tool-button primary" type="button" :aria-label="isRunning ? '暂停录音' : '开始录音'" @click="isRunning ? pause() : start()"><i :class="isRunning ? 'bi bi-pause-fill' : 'bi bi-mic-fill'"></i></button>
      <button v-if="mode === 'record'" class="tool-button" type="button" :disabled="!recordedAudioUrl || saving" aria-label="保存到本机" @click="saveRecording"><i :class="saving ? 'bi bi-hourglass-split' : 'bi bi-save2'"></i></button>
    </nav>
    <audio ref="audioRef" :src="recordedAudioUrl || undefined" preload="auto" playsinline @timeupdate="handlePlaybackTime" @ended="handlePlaybackEnded"></audio>
  </section>
</template>

<script setup lang="ts">
import { PitchEngine, midiToNoteName, midiToPitchClass } from '@tone/pitch-core'
import { createCurveCommands } from '@tone/curve-layout'
import type { StoredPitchPoint } from '@tone/contracts'
import { getLocalRecording, saveLocalRecording } from '~/utils/recordingStore'
import { useToast } from '~/composables/useToast'

const props = defineProps<{ mode: 'record' | 'playback'; recordingId?: string }>()
const { showToast } = useToast()
const MIN_MIDI = 24
const MAX_MIDI = 108
const ROW_HEIGHT = 22
const AXIS_WIDTH = 86
const PIXELS_PER_SECOND = 92
const BUFFER_SIZE = 2048
const SAMPLE_INTERVAL_MS = 70
const DRAW_INTERVAL_MS = 50
const boardHeight = (MAX_MIDI - MIN_MIDI + 1) * ROW_HEIGHT

const trackerShell = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const isRunning = ref(false)
const isPlaying = ref(false)
const saving = ref(false)
const elapsed = ref(0)
const recordingDuration = ref(0)
const playbackCursor = ref(0)
const viewportStartTime = ref(0)
const recordedAudioUrl = ref<string | null>(null)
const recordingName = ref('录音回放')
const totalDuration = computed(() => Math.max(recordingDuration.value, elapsed.value))
const playheadX = computed(() => Math.min(getCanvasWidth(), Math.max(0, (playbackCursor.value - viewportStartTime.value) * PIXELS_PER_SECOND)))
const axisNotes = computed(() => Array.from({ length: MAX_MIDI - MIN_MIDI + 1 }, (_, index) => {
  const midi = MAX_MIDI - index
  return { midi, name: midiToNoteName(midi), pitchClass: midiToPitchClass(midi) }
}))

let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let mediaStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let pitchEngine: PitchEngine | null = null
let sampleBuffer: Float32Array<ArrayBuffer> | null = null
let animationId = 0
let startedAt = 0
let lastSampledAt = 0
let lastDrawAt = 0
let points: StoredPitchPoint[] = []
let chunks: Blob[] = []
let recorderMimeType = ''
let resizeObserver: ResizeObserver | null = null
let followingEnd = true
let discardRecorderData = false

onMounted(async () => {
  if (props.mode === 'playback') await loadRecording()
  resizeCanvas(); draw()
  requestAnimationFrame(() => trackerShell.value?.scrollTo({ top: getScrollTopForMidi(60) }))
  if (trackerShell.value) {
    resizeObserver = new ResizeObserver(() => { resizeCanvas(); draw() })
    resizeObserver.observe(trackerShell.value)
  }
})

onBeforeUnmount(() => {
  pause(); stopPlayback(); stopMicrophone(); resizeObserver?.disconnect()
  if (recordedAudioUrl.value) URL.revokeObjectURL(recordedAudioUrl.value)
})

async function loadRecording() {
  try {
    const record = await getLocalRecording(props.recordingId || '')
    if (!record) throw new Error('录音不存在')
    recordingName.value = record.name
    recordingDuration.value = record.duration
    points = record.points
    recordedAudioUrl.value = URL.createObjectURL(record.audio)
  } catch {
    showToast('找不到这条本地录音', 'error')
    await navigateTo('/recordings')
  }
}

async function start() {
  stopPlayback()
  try { await ensureMicrophone() }
  catch (error) { showToast(formatMicrophoneError(error), 'error'); return }
  if (!audioContext || !analyser) return
  if (audioContext.state === 'suspended') await audioContext.resume()
  startedAt = performance.now() - elapsed.value * 1000
  isRunning.value = true
  followingEnd = true
  startRecorder()
  tick()
}

function pause() {
  if (!isRunning.value) return
  isRunning.value = false
  recordingDuration.value = Math.max(recordingDuration.value, elapsed.value)
  playbackCursor.value = recordingDuration.value
  if (mediaRecorder?.state === 'recording') { mediaRecorder.requestData(); mediaRecorder.pause() }
  cancelAnimationFrame(animationId); animationId = 0
  draw()
}

function tick() {
  if (!isRunning.value || !analyser || !sampleBuffer || !pitchEngine) return
  const now = performance.now()
  elapsed.value = Math.max(0, (now - startedAt) / 1000)
  recordingDuration.value = Math.max(recordingDuration.value, elapsed.value)
  playbackCursor.value = elapsed.value
  if (followingEnd) followTimelineEnd()
  if (now - lastSampledAt >= SAMPLE_INTERVAL_MS) {
    lastSampledAt = now
    analyser.getFloatTimeDomainData(sampleBuffer)
    const result = pitchEngine.analyze(sampleBuffer, elapsed.value)
    const last = points[points.length - 1]
    if (result.voiced || !last || last.midi !== null) points.push({ time: result.time, midi: result.midi, confidence: result.confidence })
    if (result.midi !== null) followPitch(result.midi)
  }
  if (now - lastDrawAt >= DRAW_INTERVAL_MS) { lastDrawAt = now; draw() }
  animationId = requestAnimationFrame(tick)
}

async function ensureMicrophone() {
  if (audioContext && analyser && sampleBuffer && pitchEngine) return
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器不支持麦克风采集')
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  audioContext = new AudioContext()
  analyser = audioContext.createAnalyser(); analyser.fftSize = BUFFER_SIZE; analyser.smoothingTimeConstant = 0
  audioContext.createMediaStreamSource(mediaStream).connect(analyser)
  sampleBuffer = new Float32Array(BUFFER_SIZE)
  pitchEngine = new PitchEngine({ sampleRate: audioContext.sampleRate, bufferSize: BUFFER_SIZE })
}

function startRecorder() {
  if (!mediaStream || typeof MediaRecorder === 'undefined') return
  if (mediaRecorder?.state === 'paused') { mediaRecorder.resume(); return }
  if (mediaRecorder?.state === 'recording') return
  discardRecorderData = false
  recorderMimeType = getRecorderMimeType()
  mediaRecorder = new MediaRecorder(mediaStream, recorderMimeType ? { mimeType: recorderMimeType } : undefined)
  mediaRecorder.ondataavailable = event => { if (!discardRecorderData && event.data.size) { chunks.push(event.data); refreshAudioUrl() } }
  mediaRecorder.onstop = () => { mediaRecorder = null }
  mediaRecorder.start()
}

function refreshAudioUrl() {
  if (recordedAudioUrl.value) URL.revokeObjectURL(recordedAudioUrl.value)
  recordedAudioUrl.value = chunks.length ? URL.createObjectURL(new Blob(chunks, { type: recorderMimeType || chunks[0]?.type || 'audio/webm' })) : null
}

async function saveRecording() {
  if (!chunks.length || saving.value) return
  pause(); saving.value = true
  await new Promise(resolve => window.setTimeout(resolve, 80))
  try {
    const audio = new Blob(chunks, { type: recorderMimeType || chunks[0]?.type || 'audio/webm' })
    await saveLocalRecording({ name: formatRecordingName(new Date()), duration: recordingDuration.value, mimeType: audio.type, audio, points })
    showToast('录音和音高曲线已保存到本机', 'success')
  } catch { showToast('本地空间不足，录音保存失败', 'error') }
  finally { saving.value = false }
}

function clearTrack() {
  pause(); stopPlayback()
  discardRecorderData = true
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
  mediaRecorder = null; points = []; chunks = []; elapsed.value = 0; recordingDuration.value = 0; playbackCursor.value = 0; viewportStartTime.value = 0; startedAt = 0
  pitchEngine?.reset()
  if (recordedAudioUrl.value) URL.revokeObjectURL(recordedAudioUrl.value)
  recordedAudioUrl.value = null; draw()
}

async function toggleRecordingPlayback() {
  const audio = audioRef.value
  if (!audio || !recordedAudioUrl.value) return
  if (isPlaying.value) { audio.pause(); isPlaying.value = false; return }
  pause()
  audio.currentTime = playbackCursor.value >= recordingDuration.value - .05 ? 0 : playbackCursor.value
  try { await audio.play(); isPlaying.value = true }
  catch { showToast('录音无法播放', 'error') }
}
function stopPlayback() { audioRef.value?.pause(); isPlaying.value = false }
function handlePlaybackTime() { if (!audioRef.value || !isPlaying.value) return; playbackCursor.value = audioRef.value.currentTime; keepCursorVisible(); draw() }
function handlePlaybackEnded() { isPlaying.value = false; playbackCursor.value = recordingDuration.value; draw() }

function resizeCanvas() {
  const canvas = canvasRef.value; if (!canvas) return
  const width = getCanvasWidth(); const ratio = Math.min(devicePixelRatio || 1, 1.5)
  canvas.style.width = `${width}px`; canvas.style.height = `${boardHeight}px`; canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(boardHeight * ratio)
  canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0)
}

function draw() {
  const canvas = canvasRef.value; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return
  const width = getCanvasWidth(); ctx.clearRect(0, 0, width, boardHeight)
  for (let index = 0; index <= MAX_MIDI - MIN_MIDI; index += 1) {
    const y = index * ROW_HEIGHT; const midi = MAX_MIDI - index; const pitchClass = midiToPitchClass(midi)
    ctx.fillStyle = pitchClass.includes('#') ? '#fff8e7' : '#fff'; ctx.fillRect(0, y, width, ROW_HEIGHT)
    ctx.strokeStyle = pitchClass === 'C' ? '#cbd7e8' : '#ecf0f5'; ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(width, y + .5); ctx.stroke()
  }
  const commands = createCurveCommands(points, { startTime: viewportStartTime.value, width, pixelsPerSecond: PIXELS_PER_SECOND, maxMidi: MAX_MIDI, rowHeight: ROW_HEIGHT })
  ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#f59f00'; ctx.beginPath()
  for (const command of commands) {
    if (command.type === 'move') ctx.moveTo(command.x, command.y)
    else if (command.type === 'quad') ctx.quadraticCurveTo(command.cx, command.cy, command.x, command.y)
    else if (command.type === 'line') ctx.lineTo(command.x, command.y)
    else { ctx.stroke(); ctx.beginPath() }
  }
  ctx.stroke()
}

function followPitch(midi: number) {
  const shell = trackerShell.value; if (!shell) return
  const target = getScrollTopForMidi(midi); shell.scrollTop += (target - shell.scrollTop) * .16
}
function getScrollTopForMidi(midi: number) { const shell = trackerShell.value; if (!shell) return 0; return Math.max(0, Math.min(shell.scrollHeight - shell.clientHeight, (MAX_MIDI - midi + .5) * ROW_HEIGHT - shell.clientHeight / 2)) }
function getCanvasWidth() { return Math.max(320, (trackerShell.value?.clientWidth || 900) - AXIS_WIDTH) }
function getWindowSeconds() { return getCanvasWidth() / PIXELS_PER_SECOND }
function clampViewport(value: number) { return Math.min(Math.max(0, totalDuration.value - getWindowSeconds()), Math.max(0, value)) }
function followTimelineEnd() { viewportStartTime.value = clampViewport(playbackCursor.value - getWindowSeconds()) }
function keepCursorVisible() { if (playbackCursor.value < viewportStartTime.value) viewportStartTime.value = clampViewport(playbackCursor.value); else if (playbackCursor.value > viewportStartTime.value + getWindowSeconds()) viewportStartTime.value = clampViewport(playbackCursor.value - getWindowSeconds()) }

function startPlayheadSeek(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement; target.setPointerCapture(event.pointerId)
  const update = (clientX: number) => { const rect = canvasRef.value?.getBoundingClientRect(); if (!rect) return; playbackCursor.value = Math.min(totalDuration.value, Math.max(0, viewportStartTime.value + (clientX - rect.left) / PIXELS_PER_SECOND)); if (audioRef.value) audioRef.value.currentTime = playbackCursor.value; draw() }
  const move = (moveEvent: PointerEvent) => update(moveEvent.clientX); const stop = () => target.removeEventListener('pointermove', move)
  update(event.clientX); target.addEventListener('pointermove', move); target.addEventListener('pointerup', stop, { once: true }); target.addEventListener('pointercancel', stop, { once: true })
}
function startTimelinePan(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('.playhead, .pitch-axis')) return
  const target = event.currentTarget as HTMLElement; const startX = event.clientX; const start = viewportStartTime.value; followingEnd = false; target.setPointerCapture(event.pointerId)
  const move = (moveEvent: PointerEvent) => { viewportStartTime.value = clampViewport(start + (startX - moveEvent.clientX) / PIXELS_PER_SECOND); draw() }
  const stop = () => target.removeEventListener('pointermove', move); target.addEventListener('pointermove', move); target.addEventListener('pointerup', stop, { once: true }); target.addEventListener('pointercancel', stop, { once: true })
}

function stopMicrophone() { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); mediaStream?.getTracks().forEach(track => track.stop()); audioContext?.close(); mediaRecorder = null; mediaStream = null; audioContext = null; analyser = null; pitchEngine = null; sampleBuffer = null }
function getRecorderMimeType() { return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type)) || '' }
function formatTime(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` }
function formatRecordingName(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
function formatMicrophoneError(error: unknown) { const name = error instanceof DOMException ? error.name : ''; if (name === 'NotAllowedError') return '请允许浏览器使用麦克风'; if (name === 'NotFoundError') return '没有找到可用麦克风'; return error instanceof Error ? error.message : '无法访问麦克风' }
</script>

<style scoped>
.tracker-page { --header-height: 54px; --toolbar-height: calc(58px + env(safe-area-inset-bottom)); --timebar-height: 22px; position: relative; width: 100vw; height: 100dvh; overflow: hidden; background: #fff; }
.tracker-header { position: fixed; inset: 0 0 auto; z-index: 21; display: grid; grid-template-columns: 40px minmax(0, 1fr) 40px; align-items: center; height: var(--header-height); gap: 8px; padding: 7px 14px; border-bottom: 1px solid #dde5ef; background: #fff; }.tracker-header h1 { overflow: hidden; margin: 0; color: #162033; font-size: 1.05rem; font-weight: 850; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.header-button { display: grid; width: 40px; height: 40px; place-items: center; border: 1px solid #d6dfeb; border-radius: 999px; color: #303b4d; text-decoration: none; }
.tracker-shell { width: 100%; height: calc(100% - var(--header-height) - var(--toolbar-height) - var(--timebar-height)); margin-top: var(--header-height); overflow-x: hidden; overflow-y: auto; scrollbar-width: none; }.tracker-shell::-webkit-scrollbar { display: none; }
.pitch-board { position: relative; display: flex; overflow: hidden; cursor: grab; touch-action: pan-y; }.pitch-canvas { display: block; flex: 1 1 auto; }.pitch-axis { flex: 0 0 86px; width: 86px; border-left: 1px solid #b7d9e6; background: #d5eff7; }.axis-row { display: flex; align-items: center; height: 22px; padding-left: 10px; border-bottom: 1px solid rgba(255,255,255,.48); color: #4b5b68; font-size: .72rem; font-weight: 700; }.axis-row.c { background: rgba(126,163,255,.24); }.axis-row.a { background: rgba(88,230,151,.22); }
.playhead { position: absolute; top: 0; z-index: 8; width: 28px; height: 100%; cursor: ew-resize; touch-action: none; transform: translateX(-50%); }.playhead::after { position: absolute; top: 0; left: 50%; width: 2px; height: 100%; background: #ff8a00; content: ''; }.playhead::before { position: absolute; top: 0; left: 50%; border-right: 7px solid transparent; border-left: 7px solid transparent; border-top: 11px solid #ff8a00; content: ''; transform: translateX(-43%); }
.time-bar { position: fixed; right: 0; bottom: var(--toolbar-height); left: 0; z-index: 19; display: flex; height: var(--timebar-height); align-items: center; justify-content: center; background: #5f6670; color: #fff; font-size: .8rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.bottom-toolbar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; display: flex; height: var(--toolbar-height); align-items: center; justify-content: center; gap: 16px; padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid #dde5ef; background: #fff; box-shadow: 0 -10px 28px rgba(15,23,42,.12); }.tool-button { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid #d6dfeb; border-radius: 999px; color: #3d4856; background: #fff; }.tool-button.primary { border-color: #ffc43d; background: #ffc43d; color: #172033; font-size: 1.15rem; }.tool-button:disabled { opacity: .4; }
</style>
