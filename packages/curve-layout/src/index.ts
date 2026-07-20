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
  let segment: Array<{ x: number; y: number }> = []

  const flushSegment = () => {
    if (segment.length === 0) return
    commands.push({ type: 'move', ...segment[0] })
    if (segment.length === 2) {
      commands.push({ type: 'line', ...segment[1] })
    } else {
      for (let index = 1; index < segment.length - 1; index += 1) {
        const current = segment[index]
        const next = segment[index + 1]
        commands.push({
          type: 'quad',
          cx: current.x,
          cy: current.y,
          x: (current.x + next.x) / 2,
          y: (current.y + next.y) / 2
        })
      }
      commands.push({ type: 'line', ...segment[segment.length - 1] })
    }
    segment = []
  }

  for (let index = startIndex; index < points.length; index += 1) {
    const point = points[index]
    if (point.time > endTime) break
    if (point.midi === null) {
      flushSegment()
      if (commands.length > 0 && commands[commands.length - 1].type !== 'gap') commands.push({ type: 'gap' })
      continue
    }
    segment.push({
      x: (point.time - viewport.startTime) * viewport.pixelsPerSecond,
      y: midiToY(point.midi, viewport.maxMidi, viewport.rowHeight)
    })
  }
  flushSegment()
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
