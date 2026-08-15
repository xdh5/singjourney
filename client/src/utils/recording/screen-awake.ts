type WebWakeLockSentinel = {
  released?: boolean
  release: () => Promise<void>
  addEventListener?: (type: 'release', listener: () => void) => void
}

let recordingActive = false
let webWakeLock: WebWakeLockSentinel | null = null
let webVisibilityListenerInstalled = false

/**
 * Keeps the display awake only while audio is actively being captured.
 * Callers must release it when recording pauses, stops, fails, or the page exits.
 */
export async function keepScreenAwakeWhileRecording() {
  recordingActive = true

  // #ifdef H5
  installWebVisibilityListener()
  await requestWebWakeLock()
  // #endif

  // #ifndef H5
  await setUniKeepScreenOn(true)
  // #endif
}

/** Releases a recording wake lock so normal system screen timeout can resume. */
export async function releaseRecordingScreenAwake() {
  recordingActive = false

  // #ifdef H5
  const wakeLock = webWakeLock
  webWakeLock = null
  if (wakeLock && !wakeLock.released) {
    try {
      await wakeLock.release()
    } catch {
      // 页面隐藏期间，浏览器可能已经撤销屏幕常亮锁。
    }
  }
  // #endif

  // #ifndef H5
  await setUniKeepScreenOn(false)
  // #endif
}

// #ifdef H5
function installWebVisibilityListener() {
  if (webVisibilityListenerInstalled || typeof document === 'undefined') return
  webVisibilityListenerInstalled = true
  document.addEventListener('visibilitychange', () => {
    if (recordingActive && document.visibilityState === 'visible') void requestWebWakeLock()
  })
}

async function requestWebWakeLock() {
  if (
    !recordingActive ||
    webWakeLock ||
    typeof document === 'undefined' ||
    document.visibilityState !== 'visible'
  )
    return
  const wakeLockApi = (globalThis.navigator as any)?.wakeLock
  if (!wakeLockApi?.request) return
  try {
    const requestedLock = (await wakeLockApi.request('screen')) as WebWakeLockSentinel
    if (!recordingActive) {
      await requestedLock.release()
      return
    }
    webWakeLock = requestedLock
    requestedLock.addEventListener?.('release', () => {
      if (webWakeLock === requestedLock) webWakeLock = null
    })
  } catch {
    // 不支持的浏览器或系统省电策略可能拒绝该请求。
  }
}
// #endif

// #ifndef H5
async function setUniKeepScreenOn(keepScreenOn: boolean) {
  const setter = (globalThis as any).uni?.setKeepScreenOn
  if (typeof setter !== 'function') return
  await new Promise<void>((resolve) => {
    try {
      setter({ keepScreenOn, complete: resolve })
    } catch {
      resolve()
    }
  })
}
// #endif
