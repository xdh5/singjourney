import { AudioFrameAccumulator, PitchEngine, midiToNoteName, midiToPitchClass } from '@tone/pitch-core'
import { createCurveCommands } from '@tone/curve-layout'
import type { StoredPitchPoint } from '@tone/contracts'
import { addRecording } from '../../shared/storage'
import { pcm16ToFloat32, wrapPcmAsWav } from '../../shared/wav'

const SAMPLE_RATE = 16000
const BUFFER_SIZE = 2048
const MIN_MIDI = 24
const MAX_MIDI = 108
const ROW_HEIGHT = 18
const AXIS_WIDTH = 52
const PIXELS_PER_SECOND = 72
const BOARD_HEIGHT = (MAX_MIDI - MIN_MIDI + 1) * ROW_HEIGHT

Page({
  data: {
    isRecording: false,
    hasStarted: false,
    saving: false,
    timeLabel: '00:00',
    canvasWidth: 375,
    boardHeight: BOARD_HEIGHT,
    scrollTop: 0
  },
  recorder: null as any,
  engine: null as PitchEngine | null,
  accumulator: null as AudioFrameAccumulator | null,
  points: [] as StoredPitchPoint[],
  startedAt: 0,
  pausedDuration: 0,
  pauseStartedAt: 0,
  elapsed: 0,
  sampleCount: 0,
  timer: 0 as any,
  canvas: null as any,
  context: null as any,
  pixelRatio: 1,
  pendingSave: false,
  lastDrawAt: 0,

  onLoad() {
    this.engine = new PitchEngine({ sampleRate: SAMPLE_RATE, bufferSize: BUFFER_SIZE })
    this.accumulator = new AudioFrameAccumulator(BUFFER_SIZE)
    this.recorder = wx.getRecorderManager()
    this.recorder.onFrameRecorded((result: any) => this.handleFrame(result.frameBuffer))
    this.recorder.onStop((result: any) => this.handleStop(result))
    this.recorder.onError((error: any) => { wx.showToast({ title: error.errMsg || '录音失败', icon: 'none' }); this.setData({ isRecording: false }) })
    this.initCanvas()
  },

  onUnload() {
    clearInterval(this.timer)
    if (this.data.isRecording) this.recorder?.stop()
    this.recorder?.offFrameRecorded?.()
    this.recorder?.offStop?.()
    this.recorder?.offError?.()
  },

  initCanvas() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const width = info.windowWidth
    this.setData({ canvasWidth: width })
    wx.createSelectorQuery().select('#pitchCanvas').fields({ node: true, size: true }).exec((result: any[]) => {
      const item = result[0]
      if (!item?.node) return
      this.canvas = item.node
      this.context = item.node.getContext('2d')
      this.pixelRatio = Math.min(info.pixelRatio || 1, 2)
      item.node.width = width * this.pixelRatio
      item.node.height = BOARD_HEIGHT * this.pixelRatio
      this.context.scale(this.pixelRatio, this.pixelRatio)
      this.draw()
      this.setData({ scrollTop: Math.max(0, (MAX_MIDI - 60) * ROW_HEIGHT - 260) })
    })
  },

  toggle() {
    if (this.data.isRecording) this.pause()
    else this.start()
  },

  start() {
    const now = Date.now()
    if (!this.data.hasStarted) {
      this.startedAt = now
      this.pausedDuration = 0
      this.points = []
      this.sampleCount = 0
      this.engine?.reset()
      this.accumulator?.reset()
      this.recorder.start({ duration: 600000, sampleRate: SAMPLE_RATE, numberOfChannels: 1, encodeBitRate: 96000, format: 'PCM', frameSize: 4 })
    } else {
      this.pausedDuration += now - this.pauseStartedAt
      this.recorder.resume()
    }
    this.setData({ isRecording: true, hasStarted: true })
    clearInterval(this.timer)
    this.timer = setInterval(() => this.updateClock(), 100)
  },

  pause() {
    this.recorder.pause()
    this.pauseStartedAt = Date.now()
    clearInterval(this.timer)
    this.updateClock()
    this.setData({ isRecording: false })
  },

  updateClock() {
    const displaySeconds = this.data.isRecording
      ? Math.max(this.elapsed, (Date.now() - this.startedAt - this.pausedDuration) / 1000)
      : this.elapsed
    this.setData({ timeLabel: formatTime(displaySeconds) })
  },

  handleFrame(buffer: ArrayBuffer) {
    const samples = pcm16ToFloat32(buffer)
    this.accumulator?.push(samples, (frame: Float32Array) => {
      this.sampleCount += frame.length
      this.elapsed = this.sampleCount / SAMPLE_RATE
      const result = this.engine?.analyze(frame, this.elapsed)
      if (!result) return
      const last = this.points[this.points.length - 1]
      if (result.voiced || !last || last.midi !== null) this.points.push({ time: result.time, midi: result.midi, confidence: result.confidence })
      if (result.midi !== null) this.setData({ scrollTop: Math.max(0, (MAX_MIDI - result.midi) * ROW_HEIGHT - 260) })
    })
    const now = Date.now()
    if (now - this.lastDrawAt > 66) { this.lastDrawAt = now; this.draw() }
  },

  save() {
    if (!this.data.hasStarted || this.data.saving) return
    this.pendingSave = true
    this.setData({ saving: true, isRecording: false })
    clearInterval(this.timer)
    this.recorder.stop()
  },

  clear() {
    this.pendingSave = false
    clearInterval(this.timer)
    if (this.data.hasStarted) this.recorder.stop()
    this.points = []; this.elapsed = 0; this.sampleCount = 0; this.startedAt = 0; this.pausedDuration = 0
    this.engine?.reset(); this.accumulator?.reset()
    this.setData({ isRecording: false, hasStarted: false, saving: false, timeLabel: '00:00' })
    this.draw()
  },

  handleStop(result: any) {
    if (!this.pendingSave) return
    const fs = wx.getFileSystemManager()
    fs.readFile({
      filePath: result.tempFilePath,
      success: (read: any) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const audioPath = `${wx.env.USER_DATA_PATH}/tone-${id}.wav`
        const pointsPath = `${wx.env.USER_DATA_PATH}/tone-${id}.json`
        const wav = wrapPcmAsWav(read.data, SAMPLE_RATE)
        fs.writeFile({
          filePath: audioPath,
          data: wav,
          success: () => fs.writeFile({
            filePath: pointsPath,
            data: JSON.stringify(this.points),
            encoding: 'utf8',
            success: () => {
              const date = new Date()
              addRecording({ id, name: formatName(date), duration: this.elapsed, audioPath, pointsPath, createdAt: date.toISOString(), pointCount: this.points.length, size: wav.byteLength })
              this.pendingSave = false
              this.setData({ saving: false, hasStarted: false, isRecording: false })
              wx.showToast({ title: '已保存到本机', icon: 'success' })
            },
            fail: () => this.saveFailed()
          }),
          fail: () => this.saveFailed()
        })
      },
      fail: () => this.saveFailed()
    })
  },

  saveFailed() { this.pendingSave = false; this.setData({ saving: false }); wx.showToast({ title: '本地保存失败', icon: 'none' }) },

  draw() {
    const ctx = this.context
    if (!ctx) return
    const width = this.data.canvasWidth
    const plotWidth = width - AXIS_WIDTH
    ctx.clearRect(0, 0, width, BOARD_HEIGHT)
    for (let index = 0; index <= MAX_MIDI - MIN_MIDI; index += 1) {
      const y = index * ROW_HEIGHT
      const midi = MAX_MIDI - index
      const pitchClass = midiToPitchClass(midi)
      ctx.fillStyle = pitchClass.includes('#') ? '#fff8e7' : '#ffffff'; ctx.fillRect(0, y, plotWidth, ROW_HEIGHT)
      ctx.strokeStyle = pitchClass === 'C' ? '#cbd7e8' : '#ecf0f5'; ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(plotWidth, y + .5); ctx.stroke()
      ctx.fillStyle = pitchClass === 'C' ? '#cfe0ff' : pitchClass === 'A' ? '#cef3dc' : '#d5eff7'; ctx.fillRect(plotWidth, y, AXIS_WIDTH, ROW_HEIGHT)
      ctx.fillStyle = '#4b5b68'; ctx.font = '10px sans-serif'; ctx.fillText(midiToNoteName(midi), plotWidth + 8, y + 13)
    }
    const windowSeconds = plotWidth / PIXELS_PER_SECOND
    const startTime = Math.max(0, this.elapsed - windowSeconds)
    const commands = createCurveCommands(this.points, { startTime, width: plotWidth, pixelsPerSecond: PIXELS_PER_SECOND, maxMidi: MAX_MIDI, rowHeight: ROW_HEIGHT })
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#f59f00'; ctx.beginPath()
    for (const command of commands) {
      if (command.type === 'move') ctx.moveTo(command.x, command.y)
      else if (command.type === 'quad') ctx.quadraticCurveTo(command.cx, command.cy, command.x, command.y)
      else if (command.type === 'line') ctx.lineTo(command.x, command.y)
      else { ctx.stroke(); ctx.beginPath() }
    }
    ctx.stroke()
  }
})

function formatTime(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` }
function formatName(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
