export type PracticeTransportCallbacks = {
  onStarted: () => void
  onEnded: () => void
  onError: () => void
}

type TransportMode = 'idle' | 'practice' | 'replay' | 'paused'
type ActiveTransportMode = 'practice' | 'replay'

const START_LEAD_SECONDS = 0.25
const CLOCK_POLL_INTERVAL_MS = 16
const TARGET_VOICE_PEAK = 0.82
const TARGET_ACTIVE_VOICE_RMS = 0.18
const VOICE_ACTIVITY_FLOOR = 0.01
const MINIMUM_VOICE_GAIN = 1
const MAXIMUM_VOICE_GAIN = 6
const PEAK_SCAN_SAMPLE_STEP = 8
const REPLAY_ACCOMPANIMENT_GAIN = 0.32
const COMPRESSOR_THRESHOLD_DB = -18
const COMPRESSOR_KNEE_DB = 12
const COMPRESSOR_RATIO = 6
const COMPRESSOR_ATTACK_SECONDS = 0.003
const COMPRESSOR_RELEASE_SECONDS = 0.18

export function createPracticeAudioTransport() {
  let webAudioPlatform = false
  // #ifdef H5 || MP-WEIXIN
  webAudioPlatform = true
  // #endif

  return webAudioPlatform
    ? createScheduledTransport()
    : createFallbackTransport()
}

function createScheduledTransport() {
  const audioContext = createAudioContext()
  let accompanimentBuffer: any = null
  let accompanimentPath = ''
  let accompanimentSource: any = null
  let voiceSource: any = null
  let replayVoiceBuffer: any = null
  let replayVoiceGain = MINIMUM_VOICE_GAIN
  let mode: TransportMode = 'idle'
  let scheduledAt = 0
  let pausedAt = 0
  let pausedMode: ActiveTransportMode = 'replay'
  let replayEndsAt = 0
  let callbacks: PracticeTransportCallbacks | null = null
  let startTimer: ReturnType<typeof setTimeout> | undefined
  let clockTimer: ReturnType<typeof setInterval> | undefined
  let ignoreEnded = false

  async function prepare(path: string) {
    await resumeContext(audioContext)
    if (accompanimentBuffer && accompanimentPath === path) return
    accompanimentBuffer = await decodeFile(audioContext, path)
    accompanimentPath = path
  }

  async function startPractice(nextCallbacks: PracticeTransportCallbacks, offset = 0) {
    if (!accompanimentBuffer) throw new Error('practice accompaniment is not prepared')
    stopSources()
    callbacks = nextCallbacks
    mode = 'practice'
    pausedAt = offset
    scheduleSources(false, offset)
  }

  async function startReplay(voicePath: string, nextCallbacks: PracticeTransportCallbacks, endsAt?: number) {
    if (!accompanimentBuffer) throw new Error('practice accompaniment is not prepared')
    const voiceBuffer = await decodeFile(audioContext, voicePath)
    replayVoiceBuffer = voiceBuffer
    replayVoiceGain = calculateVoiceGain(voiceBuffer)
    stopSources()
    callbacks = nextCallbacks
    mode = 'replay'
    pausedAt = 0
    replayEndsAt = Math.min(
      Number(accompanimentBuffer.duration) || Number.POSITIVE_INFINITY,
      endsAt ?? Number(accompanimentBuffer.duration)
    )
    scheduleSources(true, 0, voiceBuffer, replayEndsAt)
  }

  function scheduleSources(includeVoice: boolean, offset: number, voiceBuffer?: any, endsAt?: number) {
    ignoreEnded = false
    scheduledAt = Number(audioContext.currentTime) + START_LEAD_SECONDS
    accompanimentSource = createSource(audioContext, accompanimentBuffer, includeVoice ? REPLAY_ACCOMPANIMENT_GAIN : 1)
    accompanimentSource.onended = handleAccompanimentEnded
    const duration = endsAt === undefined ? undefined : Math.max(0, endsAt - offset)
    if (duration === undefined) accompanimentSource.start(scheduledAt, offset)
    else accompanimentSource.start(scheduledAt, offset, duration)
    if (includeVoice && voiceBuffer) {
      voiceSource = createSource(audioContext, voiceBuffer, replayVoiceGain, true)
      if (duration === undefined) voiceSource.start(scheduledAt, offset)
      else voiceSource.start(scheduledAt, offset, duration)
    }
    scheduleStartNotification()
  }

  function scheduleStartNotification() {
    clearTimers()
    const notifyWhenStarted = () => {
      if (mode !== 'practice' && mode !== 'replay') return
      if (Number(audioContext.currentTime) < scheduledAt) return
      callbacks?.onStarted()
      if (clockTimer) clearInterval(clockTimer)
      clockTimer = undefined
    }
    clockTimer = setInterval(notifyWhenStarted, CLOCK_POLL_INTERVAL_MS)
    startTimer = setTimeout(notifyWhenStarted, START_LEAD_SECONDS * 1000)
  }

  function pause(modeToPause: ActiveTransportMode) {
    if (mode !== modeToPause) return
    pausedAt = position()
    pausedMode = modeToPause
    mode = 'paused'
    stopSources()
  }

  function pausePractice() { pause('practice') }
  function pauseReplay() { pause('replay') }

  function resumePractice(nextCallbacks: PracticeTransportCallbacks) {
    if (mode !== 'paused' || pausedMode !== 'practice') return
    callbacks = nextCallbacks
    mode = 'practice'
    scheduleSources(false, pausedAt)
  }

  function resumeReplay() {
    if (mode !== 'paused' || pausedMode !== 'replay' || !replayVoiceBuffer) return
    mode = 'replay'
    scheduleSources(true, pausedAt, replayVoiceBuffer, replayEndsAt)
  }

  function position() {
    if (mode === 'paused') return pausedAt
    if (mode !== 'practice' && mode !== 'replay') return pausedAt
    return Math.max(0, Number(audioContext.currentTime) - scheduledAt + pausedAt)
  }

  function hasStarted() {
    return (mode === 'practice' || mode === 'replay') && Number(audioContext.currentTime) >= scheduledAt
  }

  function stop() {
    pausedAt = position()
    mode = 'idle'
    stopSources()
  }

  function stopSources() {
    ignoreEnded = true
    clearTimers()
    if (accompanimentSource) accompanimentSource.onended = null
    try { accompanimentSource?.stop() } catch {}
    try { voiceSource?.stop() } catch {}
    accompanimentSource = null
    voiceSource = null
    queueMicrotask(() => { ignoreEnded = false })
  }

  function handleAccompanimentEnded() {
    if (ignoreEnded || (mode !== 'practice' && mode !== 'replay')) return
    mode = 'idle'
    clearTimers()
    callbacks?.onEnded()
  }

  function clearTimers() {
    if (startTimer) clearTimeout(startTimer)
    if (clockTimer) clearInterval(clockTimer)
    startTimer = undefined
    clockTimer = undefined
  }

  function destroy() {
    mode = 'idle'
    stopSources()
    audioContext.close?.()
  }

  return { prepare, startPractice, startReplay, pausePractice, resumePractice, pauseReplay, resumeReplay, position, hasStarted, stop, destroy }
}

function createAudioContext(): any {
  // #ifdef H5
  return new AudioContext()
  // #endif
  // #ifdef MP-WEIXIN
  return (globalThis as any).wx.createWebAudioContext()
  // #endif
  return null
}

async function resumeContext(context: any) {
  if (context?.state === 'suspended') await context.resume()
}

function createSource(context: any, buffer: any, gainValue = 1, compress = false) {
  const source = context.createBufferSource()
  source.buffer = buffer
  if (gainValue === 1) {
    source.connect(context.destination)
    return source
  }
  const gain = context.createGain()
  gain.gain.value = gainValue
  source.connect(gain)
  if (compress && typeof context.createDynamicsCompressor === 'function') {
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = COMPRESSOR_THRESHOLD_DB
    compressor.knee.value = COMPRESSOR_KNEE_DB
    compressor.ratio.value = COMPRESSOR_RATIO
    compressor.attack.value = COMPRESSOR_ATTACK_SECONDS
    compressor.release.value = COMPRESSOR_RELEASE_SECONDS
    gain.connect(compressor)
    compressor.connect(context.destination)
  } else {
    gain.connect(context.destination)
  }
  return source
}

function calculateVoiceGain(buffer: any) {
  if (!buffer?.numberOfChannels || typeof buffer.getChannelData !== 'function') return MINIMUM_VOICE_GAIN
  let peak = 0
  let activeSquareSum = 0
  let activeSampleCount = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel) as Float32Array
    for (let index = 0; index < samples.length; index += PEAK_SCAN_SAMPLE_STEP) {
      const magnitude = Math.abs(samples[index])
      peak = Math.max(peak, magnitude)
      if (magnitude >= VOICE_ACTIVITY_FLOOR) {
        activeSquareSum += magnitude * magnitude
        activeSampleCount += 1
      }
    }
  }
  if (peak <= 0 || activeSampleCount === 0) return MINIMUM_VOICE_GAIN
  const activeRms = Math.sqrt(activeSquareSum / activeSampleCount)
  const rmsGain = TARGET_ACTIVE_VOICE_RMS / Math.max(activeRms, Number.EPSILON)
  const peakGain = TARGET_VOICE_PEAK / peak
  return Math.min(MAXIMUM_VOICE_GAIN, Math.max(MINIMUM_VOICE_GAIN, Math.max(rmsGain, peakGain)))
}

async function decodeFile(context: any, path: string): Promise<any> {
  const bytes = await readAudioFile(path)
  return new Promise((resolve, reject) => {
    const pending = context.decodeAudioData(bytes.slice(0), resolve, reject)
    if (pending?.then) pending.then(resolve, reject)
  })
}

async function readAudioFile(path: string): Promise<ArrayBuffer> {
  // #ifdef H5
  const response = await fetch(path)
  if (!response.ok) throw new Error(`audio load failed: ${response.status}`)
  return response.arrayBuffer()
  // #endif

  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  const packagedPath = path.startsWith('/') ? path.slice(1) : path
  return new Promise((resolve, reject) => {
    wxApi.getFileSystemManager().readFile({
      filePath: packagedPath,
      success: (result: { data: ArrayBuffer }) => resolve(result.data),
      fail: reject
    })
  })
  // #endif

  throw new Error('scheduled audio is unavailable')
}

function createFallbackTransport() {
  const accompaniment = uni.createInnerAudioContext()
  const voice = uni.createInnerAudioContext()
  let mode: TransportMode = 'idle'
  let startedAt = 0
  let pausedAt = 0
  let callbacks: PracticeTransportCallbacks | null = null

  accompaniment.onPlay(() => {
    startedAt = Date.now()
    callbacks?.onStarted()
  })
  accompaniment.onEnded(() => callbacks?.onEnded())
  accompaniment.onError(() => callbacks?.onError())

  return {
    async prepare(path: string) { accompaniment.src = path },
    async startPractice(nextCallbacks: PracticeTransportCallbacks) {
      callbacks = nextCallbacks
      mode = 'practice'
      pausedAt = 0
      accompaniment.volume = 1
      accompaniment.seek(0)
      accompaniment.play()
    },
    async startReplay(voicePath: string, nextCallbacks: PracticeTransportCallbacks) {
      callbacks = nextCallbacks
      mode = 'replay'
      pausedAt = 0
      accompaniment.volume = REPLAY_ACCOMPANIMENT_GAIN
      voice.volume = 1
      voice.src = voicePath
      accompaniment.seek(0)
      voice.seek(0)
      accompaniment.play()
      voice.play()
    },
    pauseReplay() {
      pausedAt = Math.max(0, (Date.now() - startedAt) / 1000)
      mode = 'paused'
      accompaniment.pause()
      voice.pause()
    },
    pausePractice() {
      pausedAt = Math.max(0, (Date.now() - startedAt) / 1000)
      mode = 'paused'
      accompaniment.pause()
    },
    resumePractice(nextCallbacks: PracticeTransportCallbacks) {
      callbacks = nextCallbacks
      mode = 'practice'
      accompaniment.play()
    },
    resumeReplay() {
      mode = 'replay'
      accompaniment.play()
      voice.play()
    },
    position() { return mode === 'paused' ? pausedAt : pausedAt + Math.max(0, (Date.now() - startedAt) / 1000) },
    hasStarted() { return mode === 'practice' || mode === 'replay' },
    stop() { mode = 'idle'; accompaniment.stop(); voice.stop() },
    destroy() { accompaniment.destroy(); voice.destroy() }
  }
}
