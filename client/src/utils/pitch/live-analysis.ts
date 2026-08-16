import {
  AudioFrameAccumulator,
  PitchEngine,
  pcm16ToFloat32
} from '@singjourney/pitch-core'
import type { StoredPitchPoint } from '@singjourney/contracts'
import { createPitchWorker } from './worker'
import { LIVE_PITCH_ANALYSIS_INTERVAL_MS } from './live-curve'

export interface LivePitchResult {
  time: number
  frequency?: number | null
  midi: number | null
  confidence: number
  voiced: boolean
}

interface LivePitchAnalysisOptions {
  diagnosticLabel: string
  points: StoredPitchPoint[]
  sampleRate: number
  frameSize: number
  capturesPcmFrames: boolean
  isActive: () => boolean
  shouldCapture?: () => boolean
  currentTime: () => number
  handleWorkerMessage?: (message: any) => boolean
  onWorkerFailure?: () => void
  onPcmFrame?: (buffer: ArrayBuffer) => void
  onResult?: (result: LivePitchResult) => void
  onVoiced?: (midi: number, result: LivePitchResult) => void
  gapAfterUnvoicedFrames?: number
}

export function createLivePitchAnalysis(options: LivePitchAnalysisOptions) {
  let engineSampleRate = options.sampleRate
  let engine = createEngine(engineSampleRate)
  const accumulator = new AudioFrameAccumulator(options.frameSize)
  let worker: ReturnType<typeof createPitchWorker> = null
  let lastAnalysisAt = 0
  let workerBusy = false
  let workerRequestStartedAt = 0
  let pendingWorkerRequest: {
    buffer: ArrayBuffer
    sampleRate: number
    time: number
    requestId: number
    sentAt: number
  } | null = null
  let workerRequestSequence = 0
  let lastPcmFrameAt = 0
  let latestPcmFrameIntervalMs = 0
  let lastDiagnosticAt = 0
  let replacedPendingFrames = 0
  let unvoicedFrames = 0
  const gapAfterUnvoicedFrames = options.gapAfterUnvoicedFrames ?? 3

  function initWorker() {
    if (worker || !options.capturesPcmFrames) return
    try {
      worker = createPitchWorker(handleWorkerMessage, disableWorker)
    } catch {
      worker = null
    }
  }

  function handleWorkerMessage(message: any) {
    if (options.handleWorkerMessage?.(message)) return
    if (message?.type === 'reset') {
      workerBusy = false
      workerRequestStartedAt = 0
      return
    }
    if (message?.type !== 'pitch-result') return
    workerBusy = false
    workerRequestStartedAt = 0
    if (options.isActive() && message.result) {
      acceptResult(message.result)
      logWorkerTiming(message)
    }
    dispatchPendingWorkerRequest()
  }

  function disableWorker() {
    workerBusy = false
    workerRequestStartedAt = 0
    pendingWorkerRequest = null
    options.onWorkerFailure?.()
    worker?.terminate?.()
    worker = null
  }

  function analyze(buffer: ArrayBuffer | Float32Array, sampleRate = options.sampleRate) {
    const active = options.isActive()
    if (!active && !options.shouldCapture?.()) return
    if (options.capturesPcmFrames) {
      if (!(buffer instanceof ArrayBuffer)) return
      const frameArrivedAt = Date.now()
      if (lastPcmFrameAt) latestPcmFrameIntervalMs = frameArrivedAt - lastPcmFrameAt
      lastPcmFrameAt = frameArrivedAt
      options.onPcmFrame?.(buffer)
      if (!active) return
      if (worker) {
        const now = Date.now()
        if (workerBusy) {
          // 暂停期间本来就不会产生分析结果，不能拿“距离上次返回的时间”判断 Worker 超时。
          // 只计算当前在途请求自身的等待时间，避免恢复录音时误退回主线程分析并卡住界面。
          if (now - workerRequestStartedAt < 1200) {
            // Worker 正在分析时只保留最新一帧，既不丢掉整段新声音，也不形成积压队列。
            if (pendingWorkerRequest) replacedPendingFrames += 1
            pendingWorkerRequest = {
              buffer,
              sampleRate,
              time: options.currentTime(),
              requestId: ++workerRequestSequence,
              sentAt: now
            }
            return
          }
          console.warn('[录音诊断] 音高 Worker 当前请求超时，停止使用 Worker', {
            elapsedMs: now - workerRequestStartedAt
          })
          disableWorker()
        }
        if (!worker) return
        postWorkerRequest({
          buffer,
          sampleRate,
          time: options.currentTime(),
          requestId: ++workerRequestSequence,
          sentAt: now
        })
        return
      }
      // 小程序的实时音高识别只能在 Worker 中执行。Worker 不可用或超时后停止识别，
      // 录音仍然继续。此处直接返回，代码层面不存在回退 UI 主线程的入口。
      return
    }

    if (!active) return

    const now = Date.now()
    if (now - lastAnalysisAt < LIVE_PITCH_ANALYSIS_INTERVAL_MS) return
    lastAnalysisAt = now
    if (sampleRate !== engineSampleRate) {
      engineSampleRate = sampleRate
      engine = createEngine(engineSampleRate)
      accumulator.reset()
    }
    const samples = buffer instanceof Float32Array ? buffer : pcm16ToFloat32(buffer)
    accumulator.push(samples, (frame: Float32Array) => {
      const result = engine.analyze(frame, options.currentTime())
      if (result) acceptResult(result)
    })
  }

  function acceptResult(result: LivePitchResult) {
    options.onResult?.(result)
    const last = options.points[options.points.length - 1]
    if (result.voiced && result.midi !== null) {
      unvoicedFrames = 0
      options.points.push({
        time: result.time,
        midi: result.midi,
        confidence: result.confidence
      })
      options.onVoiced?.(result.midi, result)
      return
    }
    unvoicedFrames += 1
    if (unvoicedFrames === gapAfterUnvoicedFrames && (!last || last.midi !== null)) {
      options.points.push({ time: result.time, midi: null, confidence: 0 })
    }
  }

  function reset(clearPoints = true) {
    if (clearPoints) options.points.splice(0)
    lastAnalysisAt = 0
    workerBusy = false
    workerRequestStartedAt = 0
    pendingWorkerRequest = null
    workerRequestSequence = 0
    lastPcmFrameAt = 0
    latestPcmFrameIntervalMs = 0
    lastDiagnosticAt = 0
    replacedPendingFrames = 0
    unvoicedFrames = 0
    engine.reset()
    accumulator.reset()
    worker?.postMessage?.({ type: 'reset' })
  }

  function terminate() {
    worker?.terminate?.()
    worker = null
    workerBusy = false
    workerRequestStartedAt = 0
    pendingWorkerRequest = null
  }

  async function releaseWorkerSlot() {
    terminate()
    // 微信的 Worker 槽位在 terminate 后异步释放，稍等一帧再创建导出 Worker。
    if (options.capturesPcmFrames) await new Promise((resolve) => setTimeout(resolve, 50))
  }

  return {
    analyze,
    initWorker,
    reset,
    releaseWorkerSlot,
    terminate,
    worker: () => worker
  }

  function createEngine(sampleRate: number) {
    return new PitchEngine({
      sampleRate,
      bufferSize: options.frameSize
    })
  }

  function postWorkerRequest(request: {
    buffer: ArrayBuffer
    sampleRate: number
    time: number
    requestId: number
    sentAt: number
  }) {
    if (!worker) return
    workerBusy = true
    const dispatchedAt = Date.now()
    workerRequestStartedAt = dispatchedAt
    try {
      worker.postMessage({ type: 'analyze', ...request, dispatchedAt })
    } catch {
      disableWorker()
    }
  }

  function logWorkerTiming(message: any) {
    const now = Date.now()
    if (now - lastDiagnosticAt < 1000) return
    lastDiagnosticAt = now
    const timing = message.timing || {}
    const resultTime = Number(message.result?.time)
    console.info(`[音高诊断] ${options.diagnosticLabel}`, {
      requestId: timing.requestId,
      pcmFrameIntervalMs: latestPcmFrameIntervalMs,
      pendingWaitMs: Number(timing.dispatchedAt) - Number(timing.sentAt),
      workerDeliveryMs: Number(timing.receivedAt) - Number(timing.dispatchedAt),
      workerComputeMs: Number(timing.finishedAt) - Number(timing.receivedAt),
      workerReturnMs: now - Number(timing.finishedAt),
      totalWorkerMs: now - Number(timing.sentAt),
      curveLagMs: Number.isFinite(resultTime)
        ? Math.round((options.currentTime() - resultTime) * 1000)
        : undefined,
      replacedPendingFrames,
      pcmByteLength: timing.bufferByteLength,
      voiced: Boolean(message.result?.voiced)
    })
    replacedPendingFrames = 0
  }

  function dispatchPendingWorkerRequest() {
    if (!worker || workerBusy || !options.isActive() || !pendingWorkerRequest) {
      if (!options.isActive()) pendingWorkerRequest = null
      return
    }
    const request = pendingWorkerRequest
    pendingWorkerRequest = null
    postWorkerRequest(request)
  }
}
