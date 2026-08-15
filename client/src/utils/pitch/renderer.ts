import { midiToNoteName, midiToPitchClass } from '@singjourney/pitch-core'

export const PITCH_MINIMUM_MIDI = 24
export const PITCH_MAXIMUM_MIDI = 108
export const PITCH_OCTAVE_COLORS = [
  '#ffffd9',
  '#edf8b1',
  '#c7e9b4',
  '#7fcdbb',
  '#41b6c4',
  '#1d91c0',
  '#225ea8',
  '#225ea8'
] as const

const NATURAL_ROW_COLOR = '#ffffff'
const ACCIDENTAL_ROW_COLOR = '#f3f7f5'
const DEFAULT_GRID_COLOR = '#e4ece8'
const AXIS_BORDER_COLOR = '#86aa9f'
const DARK_LABEL_COLOR = '#294c43'
const LIGHT_LABEL_COLOR = '#ffffff'
const LIGHT_LABEL_FROM_OCTAVE = 6
const AXIS_LABEL_LEFT_PADDING = 8
const AXIS_FONT_SIZE = 10

interface PitchCanvasLayerOptions {
  context: any
  direct: boolean
  width: number
  height: number
  axisWidth: number
  viewportMaxMidi: number
  rowHeight: number
  minimumMidi: number
  maximumMidi: number
}

export function drawPitchGrid(options: PitchCanvasLayerOptions) {
  const { context, width, height, axisWidth, viewportMaxMidi, rowHeight } = options
  const plotWidth = Math.max(1, width - axisWidth)
  const firstMidi = Math.min(options.maximumMidi, Math.ceil(viewportMaxMidi))
  const lastMidi = Math.max(
    options.minimumMidi,
    Math.floor(viewportMaxMidi - height / rowHeight) - 1
  )

  for (let midi = firstMidi; midi >= lastMidi; midi -= 1) {
    const y = (viewportMaxMidi - midi) * rowHeight
    const pitchClass = midiToPitchClass(midi)
    setFill(options, pitchClass.includes('#') ? ACCIDENTAL_ROW_COLOR : NATURAL_ROW_COLOR)
    context.fillRect(0, y, plotWidth, rowHeight)
    setStroke(options, DEFAULT_GRID_COLOR, 1)
    context.beginPath()
    context.moveTo(0, y + 0.5)
    context.lineTo(plotWidth, y + 0.5)
    context.stroke()
  }
}

export function drawPitchAxis(options: PitchCanvasLayerOptions) {
  const { context, width, height, axisWidth, viewportMaxMidi, rowHeight } = options
  const axisLeft = Math.max(1, width - axisWidth)
  const firstMidi = Math.min(options.maximumMidi, Math.ceil(viewportMaxMidi))
  const lastMidi = Math.max(
    options.minimumMidi,
    Math.floor(viewportMaxMidi - height / rowHeight) - 1
  )

  setFont(options)
  for (let midi = firstMidi; midi >= lastMidi; midi -= 1) {
    const y = (viewportMaxMidi - midi) * rowHeight
    const octave = Math.floor(midi / 12) - 1
    setFill(options, getOctaveColor(midi))
    context.fillRect(axisLeft, y, axisWidth, rowHeight + 1)
    setFill(options, octave >= LIGHT_LABEL_FROM_OCTAVE ? LIGHT_LABEL_COLOR : DARK_LABEL_COLOR)
    context.fillText(midiToNoteName(midi), axisLeft + AXIS_LABEL_LEFT_PADDING, y + rowHeight / 2)
  }

  setStroke(options, AXIS_BORDER_COLOR, 1)
  context.beginPath()
  context.moveTo(axisLeft + 0.5, 0)
  context.lineTo(axisLeft + 0.5, height)
  context.stroke()
}

function getOctaveColor(midi: number) {
  const octave = Math.floor(midi / 12) - 1
  const index = Math.max(0, Math.min(PITCH_OCTAVE_COLORS.length - 1, octave - 1))
  return PITCH_OCTAVE_COLORS[index]
}

function setFill(options: PitchCanvasLayerOptions, color: string) {
  if (options.direct) options.context.fillStyle = color
  else options.context.setFillStyle(color)
}

function setStroke(options: PitchCanvasLayerOptions, color: string, width: number) {
  if (options.direct) {
    options.context.strokeStyle = color
    options.context.lineWidth = width
  } else {
    options.context.setStrokeStyle(color)
    options.context.setLineWidth(width)
  }
}

function setFont(options: PitchCanvasLayerOptions) {
  if (options.direct) {
    options.context.font = `${AXIS_FONT_SIZE}px sans-serif`
    options.context.textBaseline = 'middle'
    options.context.textAlign = 'left'
    return
  }
  options.context.setFontSize(AXIS_FONT_SIZE)
  options.context.setTextBaseline?.('middle')
  options.context.setTextAlign?.('left')
}
