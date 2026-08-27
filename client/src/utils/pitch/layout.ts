import type { WindowMetrics } from '../window-metrics'

export const LIVE_PITCH_AXIS_WIDTH = 52
export const LIVE_PITCH_ROW_HEIGHT = 18
export const LIVE_PITCH_PIXELS_PER_SECOND = 72
export const LIVE_PITCH_DIRECT_RENDER_INTERVAL_MS = 1000 / 60
export const LIVE_PITCH_PCM_RENDER_INTERVAL_MS = 1000 / 30
export const LIVE_PITCH_COMMAND_RENDER_INTERVAL_MS = 120

const NAVBAR_HEIGHT_PX = 36
const TIME_BAR_HEIGHT_RPX = 38
const TOOLBAR_HEIGHT_RPX = 104
const CANVAS_MINIMUM_HEIGHT_PX = 240

export function calculateLivePitchCanvasLayout(metrics: WindowMetrics) {
  const toolbarContentHeight = uni.upx2px(TOOLBAR_HEIGHT_RPX)
  const toolbarHeight = toolbarContentHeight + metrics.safeBottom
  const footerHeight = uni.upx2px(TIME_BAR_HEIGHT_RPX) + toolbarHeight
  const navbarHeight = metrics.statusBarHeight + NAVBAR_HEIGHT_PX
  return {
    canvasWidth: Math.max(1, metrics.windowWidth),
    canvasHeight: Math.max(
      CANVAS_MINIMUM_HEIGHT_PX,
      metrics.windowHeight - footerHeight - navbarHeight
    ),
    toolbarHeight,
    safeBottom: metrics.safeBottom
  }
}
