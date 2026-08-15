export type WindowMetrics = {
  windowWidth: number
  windowHeight: number
  pixelRatio: number
  statusBarHeight: number
  safeBottom: number
}

const DEFAULT_WINDOW_WIDTH = 375
const DEFAULT_WINDOW_HEIGHT = 667
const DEFAULT_PIXEL_RATIO = 1

export function getWindowMetrics(): WindowMetrics {
  const info = readWindowInfo()
  const windowWidth = positiveNumber(info?.windowWidth, DEFAULT_WINDOW_WIDTH)
  const windowHeight = positiveNumber(info?.windowHeight, DEFAULT_WINDOW_HEIGHT)
  const pixelRatio = positiveNumber(info?.pixelRatio, DEFAULT_PIXEL_RATIO)
  const statusBarHeight = nonNegativeNumber(info?.statusBarHeight, 0)
  const screenHeight = positiveNumber(info?.screenHeight, windowHeight)
  const safeAreaBottom = finiteNumber(info?.safeArea?.bottom)
  const safeAreaInsetBottom = finiteNumber(info?.safeAreaInsets?.bottom)
  const safeBottom =
    safeAreaInsetBottom ??
    (safeAreaBottom === null ? 0 : Math.max(0, screenHeight - safeAreaBottom))

  return { windowWidth, windowHeight, pixelRatio, statusBarHeight, safeBottom }
}

function readWindowInfo(): any {
  try {
    const current = (uni as any).getWindowInfo?.()
    if (current) return current
    // #ifndef MP-WEIXIN
    return uni.getSystemInfoSync()
    // #endif
  } catch {
    return null
  }
  return null
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nonNegativeNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}
