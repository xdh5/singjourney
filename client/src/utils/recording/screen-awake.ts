type WebWakeLockSentinel = {
  released?: boolean
  release: () => Promise<void>
  addEventListener?: (type: 'release', listener: () => void) => void
}

let recordingActive = false
const awakePageOwners = new Set<string>()
let webWakeLock: WebWakeLockSentinel | null = null
let webVisibilityListenerInstalled = false

/** 录音采集期间保持屏幕常亮。 */
export async function keepScreenAwakeWhileRecording() {
  recordingActive = true
  await refreshScreenAwake()
}

/** 录音暂停或结束后释放录音级常亮；页面级常亮仍然有效。 */
export async function releaseRecordingScreenAwake() {
  recordingActive = false
  await refreshScreenAwake()
}

/** 页面打开期间保持屏幕常亮，同一页面重复进入不会重复计数。 */
export async function keepScreenAwakeWhilePageOpen(owner: string) {
  awakePageOwners.add(owner)
  await refreshScreenAwake()
}

/** 真正离开页面时释放页面级常亮。 */
export async function releasePageScreenAwake(owner: string) {
  awakePageOwners.delete(owner)
  await refreshScreenAwake()
}

async function refreshScreenAwake() {
  const shouldKeepScreenAwake = recordingActive || awakePageOwners.size > 0

  // #ifdef H5
  installWebVisibilityListener()
  if (shouldKeepScreenAwake) {
    await requestWebWakeLock()
    return
  }
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
  await setUniKeepScreenOn(shouldKeepScreenAwake)
  // #endif
}

// #ifdef H5
function installWebVisibilityListener() {
  if (webVisibilityListenerInstalled || typeof document === 'undefined') return
  webVisibilityListenerInstalled = true
  document.addEventListener('visibilitychange', () => {
    if (shouldKeepScreenAwake() && document.visibilityState === 'visible')
      void requestWebWakeLock()
  })
}

async function requestWebWakeLock() {
  if (
    !shouldKeepScreenAwake() ||
    webWakeLock ||
    typeof document === 'undefined' ||
    document.visibilityState !== 'visible'
  )
    return
  const wakeLockApi = (globalThis.navigator as any)?.wakeLock
  if (!wakeLockApi?.request) return
  try {
    const requestedLock = (await wakeLockApi.request('screen')) as WebWakeLockSentinel
    if (!shouldKeepScreenAwake()) {
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

function shouldKeepScreenAwake() {
  return recordingActive || awakePageOwners.size > 0
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
