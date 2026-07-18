export type CurvePoint = { time: number; midi: number | null }
export type CurveCommand =
  | { type: 'move'; x: number; y: number }
  | { type: 'quad'; cx: number; cy: number; x: number; y: number }
  | { type: 'line'; x: number; y: number }
  | { type: 'gap' }

export type CurveViewport = {
  startTime: number
  width: number
  pixelsPerSecond: number
  maxMidi: number
  rowHeight: number
}

export function midiToY(midi: number, maxMidi: number, rowHeight: number) {
  return (maxMidi - midi + 0.5) * rowHeight
}

export function createCurveCommands(points: CurvePoint[], viewport: CurveViewport): CurveCommand[] {
  const paddingSeconds = 8 / viewport.pixelsPerSecond
  const endTime = viewport.startTime + viewport.width / viewport.pixelsPerSecond + paddingSeconds
  const startIndex = lowerBound(points, viewport.startTime - paddingSeconds)
  const commands: CurveCommand[] = []
  let previous: { x: number; y: number } | null = null

  for (let index = startIndex; index < points.length; index += 1) {
    const point = points[index]
    if (point.time > endTime) break
    if (point.midi === null) {
      if (previous) commands.push({ type: 'gap' })
      previous = null
      continue
    }
    const current = {
      x: (point.time - viewport.startTime) * viewport.pixelsPerSecond,
      y: midiToY(point.midi, viewport.maxMidi, viewport.rowHeight)
    }
    if (!previous) commands.push({ type: 'move', ...current })
    else commands.push({
      type: 'quad',
      cx: previous.x,
      cy: previous.y,
      x: (previous.x + current.x) / 2,
      y: (previous.y + current.y) / 2
    })
    previous = current
  }
  if (previous) commands.push({ type: 'line', ...previous })
  return commands
}

function lowerBound(points: CurvePoint[], time: number) {
  let low = 0
  let high = points.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (points[middle].time < time) low = middle + 1
    else high = middle
  }
  return Math.max(0, low - 1)
}
