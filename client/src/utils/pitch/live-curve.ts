import {
  createCurveCommands,
  midiToY,
  type CurvePoint
} from '@singjourney/curve-layout'

export const LIVE_PITCH_PLAYHEAD_RATIO = 0.6
export const LIVE_PITCH_ANALYSIS_INTERVAL_MS = 80
// 音高点改用 PCM 实际采样时间后不再需要固定猜测补偿。
export const LIVE_PITCH_RENDER_DELAY_SECONDS = 0
export const PLAYBACK_OUTPUT_DELAY_SECONDS = 0.07

const VISUAL_CLOCK_SNAP_THRESHOLD_SECONDS = 0.35
const VISUAL_CLOCK_CORRECTION_TIME_MS = 140
const VISUAL_CLOCK_MAX_CORRECTION_PER_FRAME_SECONDS = 0.012
/**
 * 将到达间隔不稳定的录音或播放位置转换成连续的画布时间轴。
 * 这里只平滑视窗位置，不修改音高点的真实采样时间。
 */
export function createLivePitchVisualClock() {
  let value = 0
  let initialized = false
  let lastFrameAt = 0

  function reset(position = 0) {
    value = Math.max(0, position)
    initialized = true
    lastFrameAt = Date.now()
    return value
  }

  function update(targetPosition: number, moving: boolean) {
    const target = Math.max(0, Number.isFinite(targetPosition) ? targetPosition : 0)
    const now = Date.now()
    if (!initialized) return reset(target)

    const frameDurationMs = Math.min(80, Math.max(0, now - lastFrameAt))
    lastFrameAt = now
    const predicted = value + (moving ? frameDurationMs / 1000 : 0)
    const difference = target - predicted

    // 拖动、重新开始或切换回页面时直接校准，避免视觉时钟长时间追赶。
    if (Math.abs(difference) >= VISUAL_CLOCK_SNAP_THRESHOLD_SECONDS) {
      value = target
      return value
    }

    const blend = 1 - Math.exp(-frameDurationMs / VISUAL_CLOCK_CORRECTION_TIME_MS)
    const correction = Math.max(
      -VISUAL_CLOCK_MAX_CORRECTION_PER_FRAME_SECONDS,
      Math.min(VISUAL_CLOCK_MAX_CORRECTION_PER_FRAME_SECONDS, difference * blend)
    )
    value = Math.max(0, predicted + correction)
    return value
  }

  return { reset, update }
}

interface LivePitchCurveOptions {
  context: any
  direct: boolean
  points: CurvePoint[]
  startTime: number
  endTime: number
  width: number
  pixelsPerSecond: number
  maximumMidi: number
  rowHeight: number
  showLatestPoint?: boolean
  liveTime?: number
}

interface LivePitchPlayheadOptions {
  context: any
  direct: boolean
  x: number
  height: number
}

interface VisualCurveHeadState {
  midi: number
  pointTime: number
  updatedAt: number
}

const visualCurveHeads = new WeakMap<CurvePoint[], VisualCurveHeadState>()

export function drawLivePitchCurve(options: LivePitchCurveOptions) {
  const { context } = options
  const latestPoint = findLatestVisiblePoint(
    options.points,
    options.startTime,
    options.endTime
  )
  const visualMidi = resolveVisualHeadMidi(options, latestPoint)
  const commands = createCurveCommands(options.points, {
    startTime: options.startTime,
    width: options.width,
    pixelsPerSecond: options.pixelsPerSecond,
    maxMidi: options.maximumMidi,
    rowHeight: options.rowHeight,
    lastPointMidi: visualMidi
  })

  setStroke(options, '#00a96b', 4)
  setLineCap(options, 'round')
  setLineJoin(options, 'round')
  context.beginPath()
  for (const command of commands) {
    if (command.type === 'move') context.moveTo(command.x, command.y)
    else if (command.type === 'line') context.lineTo(command.x, command.y)
    else if (command.type === 'quad')
      context.quadraticCurveTo(command.cx, command.cy, command.x, command.y)
    else {
      context.stroke()
      context.beginPath()
    }
  }
  context.stroke()

  if (options.showLatestPoint === false) return

  if (!latestPoint || latestPoint.midi === null) return

  const liveTime = Number(options.liveTime)
  const headTime = Number.isFinite(liveTime)
    ? Math.min(options.endTime, latestPoint.time + 0.18, Math.max(latestPoint.time, liveTime))
    : latestPoint.time
  const latestX = (latestPoint.time - options.startTime) * options.pixelsPerSecond
  const x = (headTime - options.startTime) * options.pixelsPerSecond
  const y = midiToY(visualMidi ?? latestPoint.midi, options.maximumMidi, options.rowHeight)

  // 音高结果约每 80ms 到达一次，实时末端延伸到视觉时钟，避免曲线和圆点分段跳动。
  // 延伸点只参与绘制，不写入真实音高数据；最多延伸 180ms，气声或断音仍会及时断线。
  if (x > latestX) {
    setStroke(options, '#00a96b', 4)
    setLineCap(options, 'round')
    options.context.beginPath()
    options.context.moveTo(latestX, y)
    options.context.lineTo(x, y)
    options.context.stroke()
  }

  setFill(options, '#00c982')
  context.beginPath()
  context.arc(x, y, 4.5, 0, Math.PI * 2)
  context.fill()
}

function resolveVisualHeadMidi(
  options: LivePitchCurveOptions,
  latestPoint: CurvePoint | null
) {
  if (!latestPoint || latestPoint.midi === null || !Number.isFinite(Number(options.liveTime)))
    return undefined

  const now = Date.now()
  const previousPoint = options.points[options.points.length - 2]
  const state = visualCurveHeads.get(options.points)
  const startsNewSegment =
    !previousPoint ||
    previousPoint.midi === null ||
    latestPoint.time - previousPoint.time > 0.3 ||
    !state ||
    latestPoint.time < state.pointTime

  if (startsNewSegment) {
    visualCurveHeads.set(options.points, {
      midi: latestPoint.midi,
      pointTime: latestPoint.time,
      updatedAt: now
    })
    return latestPoint.midi
  }

  const frameDuration = Math.min(80, Math.max(0, now - state.updatedAt))
  const blend = 1 - Math.exp(-frameDuration / 70)
  state.midi += (latestPoint.midi - state.midi) * blend
  state.pointTime = latestPoint.time
  state.updatedAt = now
  return state.midi
}

export function drawLivePitchPlayhead(options: LivePitchPlayheadOptions) {
  setStroke(options, '#1f4e41', 1.5)
  options.context.beginPath()
  options.context.moveTo(options.x, 0)
  options.context.lineTo(options.x, options.height)
  options.context.stroke()
}

function findLatestVisiblePoint(points: CurvePoint[], startTime: number, endTime: number) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]
    if (point.time > endTime) continue
    if (point.time < startTime) return null
    if (point.midi !== null) return point
  }
  return null
}

function setFill(options: Pick<LivePitchCurveOptions, 'context' | 'direct'>, color: string) {
  if (options.direct) options.context.fillStyle = color
  else options.context.setFillStyle(color)
}

function setStroke(
  options: Pick<LivePitchCurveOptions, 'context' | 'direct'>,
  color: string,
  width: number
) {
  if (options.direct) {
    options.context.strokeStyle = color
    options.context.lineWidth = width
  } else {
    options.context.setStrokeStyle(color)
    options.context.setLineWidth(width)
  }
}

function setLineCap(
  options: Pick<LivePitchCurveOptions, 'context' | 'direct'>,
  value: CanvasLineCap
) {
  if (options.direct) options.context.lineCap = value
  else options.context.setLineCap(value)
}

function setLineJoin(
  options: Pick<LivePitchCurveOptions, 'context' | 'direct'>,
  value: CanvasLineJoin
) {
  if (options.direct) options.context.lineJoin = value
  else options.context.setLineJoin(value)
}
