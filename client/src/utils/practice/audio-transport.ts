import { createAudibleAudioPlayer } from '../audio/player'

export type PracticeTransportCallbacks = {
  onStarted: () => void
  onEnded: () => void
  onError: () => void
}

export type PracticeAudioSegment = { sourceOffset: number; duration: number }

type TransportMode = 'idle' | 'practice' | 'replay' | 'paused'
type ActiveTransportMode = 'practice' | 'replay'

const PRACTICE_START_LEAD_SECONDS = 0.25
const REPLAY_START_LEAD_SECONDS = 0.04
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

  return webAudioPlatform ? createScheduledTransport() : createFallbackTransport()
}

function createScheduledTransport() {
  const audioContext = createAudioContext()
  let accompanimentBuffer: any = null
  let accompanimentPath = ''
  let accompanimentSources: any[] = []
  let voiceSource: any = null
  let replayVoiceBuffer: any = null
  let replayVoicePath = ''
  let replayPreparation: Promise<void> | null = null
  let replayVoiceGain = MINIMUM_VOICE_GAIN
  let replayVoiceOffset = 0
  let replayIncludesAccompaniment = true
  let mode: TransportMode = 'idle'
  let scheduledAt = 0
  let pausedAt = 0
  let pausedMode: ActiveTransportMode = 'replay'
  let replayEndsAt = 0
  let segmentOffset = 0
  let segmentDuration = Number.POSITIVE_INFINITY
  let audioSegments: PracticeAudioSegment[] = []
  let callbacks: PracticeTransportCallbacks | null = null
  let startTimer: ReturnType<typeof setTimeout> | undefined
  let clockTimer: ReturnType<typeof setInterval> | undefined
  let ignoreEnded = false

  async function prepare(
    path: string,
    audioOffset = 0,
    duration?: number,
    segments?: PracticeAudioSegment[]
  ) {
    await resumeContext(audioContext)
    segmentOffset = Math.max(0, audioOffset)
    segmentDuration = duration === undefined ? Number.POSITIVE_INFINITY : Math.max(0, duration)
    audioSegments = segments?.length
      ? segments.map((segment) => ({
          sourceOffset: Math.max(0, segment.sourceOffset),
          duration: Math.max(0, segment.duration)
        }))
      : [{ sourceOffset: segmentOffset, duration: segmentDuration }]
    if (!accompanimentBuffer || accompanimentPath !== path) {
      accompanimentBuffer = await decodeFile(audioContext, path)
      accompanimentPath = path
    }
  }

  async function startPractice(nextCallbacks: PracticeTransportCallbacks, offset = 0) {
    if (!accompanimentBuffer) throw new Error('practice accompaniment is not prepared')
    stopSources()
    callbacks = nextCallbacks
    mode = 'practice'
    pausedAt = offset
    console.info('[录音诊断] 伴奏播放源开始调度', { offset })
    scheduleSources(false, offset)
  }

  async function startReplay(
    voicePath: string,
    nextCallbacks: PracticeTransportCallbacks,
    endsAt?: number,
    voiceOffset = 0,
    includeAccompaniment = true
  ) {
    if (!accompanimentBuffer) throw new Error('practice accompaniment is not prepared')
    const replayDecodeStartedAt = Date.now()
    await prepareReplay(voicePath)
    const voiceBuffer = replayVoiceBuffer
    if (!voiceBuffer) throw new Error('practice replay is not prepared')
    console.info('[录音诊断] 人声 WAV 解码完成', {
      elapsedMs: Date.now() - replayDecodeStartedAt,
      duration: voiceBuffer?.duration
    })
    replayVoiceOffset = Math.max(0, voiceOffset)
    replayIncludesAccompaniment = includeAccompaniment
    stopSources()
    callbacks = nextCallbacks
    mode = 'replay'
    pausedAt = 0
    replayEndsAt = Math.min(
      segmentDuration,
      endsAt ?? segmentDuration
    )
    scheduleSources(
      true,
      0,
      voiceBuffer,
      replayEndsAt,
      replayVoiceOffset,
      replayIncludesAccompaniment
    )
  }

  async function prepareReplay(voicePath: string) {
    if (replayVoiceBuffer && replayVoicePath === voicePath) return
    if (replayPreparation && replayVoicePath === voicePath) return replayPreparation

    replayVoicePath = voicePath
    replayVoiceBuffer = null
    replayPreparation = (async () => {
      const voiceBuffer = await decodeFile(audioContext, voicePath)
      // 预解码期间录音可能已经继续并生成新文件，旧结果不能覆盖新缓存。
      if (replayVoicePath !== voicePath) return
      replayVoiceBuffer = voiceBuffer
      const gainStartedAt = Date.now()
      replayVoiceGain = calculateVoiceGain(voiceBuffer)
      console.info('[录音诊断] 人声音量扫描完成', {
        elapsedMs: Date.now() - gainStartedAt,
        gain: replayVoiceGain
      })
    })().finally(() => {
      if (replayVoicePath === voicePath) replayPreparation = null
    })
    return replayPreparation
  }

  function scheduleSources(
    includeVoice: boolean,
    offset: number,
    voiceBuffer?: any,
    endsAt?: number,
    voiceOffset = 0,
    includeAccompaniment = true
  ) {
    ignoreEnded = false
    const startLeadSeconds = includeVoice
      ? REPLAY_START_LEAD_SECONDS
      : PRACTICE_START_LEAD_SECONDS
    scheduledAt = Number(audioContext.currentTime) + startLeadSeconds
    const duration = Math.max(
      0,
      Math.min(segmentDuration, endsAt ?? segmentDuration) - offset
    )
    if (includeAccompaniment) {
      const scheduledSegments = sliceAudioSegments(audioSegments, offset, duration)
      accompanimentSources = scheduledSegments.map((segment, index) => {
        const source = createSource(
          audioContext,
          accompanimentBuffer,
          includeVoice ? REPLAY_ACCOMPANIMENT_GAIN : 1
        )
        if (index === scheduledSegments.length - 1) source.onended = handleTransportEnded
        source.start(
          scheduledAt + segment.timelineOffset,
          segment.sourceOffset,
          segment.duration
        )
        return source
      })
    }
    if (includeVoice && voiceBuffer) {
      voiceSource = createSource(audioContext, voiceBuffer, replayVoiceGain, true)
      if (!includeAccompaniment) voiceSource.onended = handleTransportEnded
      voiceSource.start(scheduledAt, voiceOffset + offset, duration)
    }
    scheduleStartNotification(startLeadSeconds)
  }

  function scheduleStartNotification(startLeadSeconds: number) {
    clearTimers()
    const notifyWhenStarted = () => {
      if (mode !== 'practice' && mode !== 'replay') return
      if (Number(audioContext.currentTime) < scheduledAt) return
      callbacks?.onStarted()
      if (clockTimer) clearInterval(clockTimer)
      clockTimer = undefined
    }
    clockTimer = setInterval(notifyWhenStarted, CLOCK_POLL_INTERVAL_MS)
    startTimer = setTimeout(notifyWhenStarted, startLeadSeconds * 1000)
  }

  function pause(modeToPause: ActiveTransportMode) {
    if (mode !== modeToPause) return
    pausedAt = position()
    pausedMode = modeToPause
    mode = 'paused'
    stopSources()
  }

  function pausePractice() {
    pause('practice')
  }
  function pauseReplay() {
    pause('replay')
  }

  function resumePractice(nextCallbacks: PracticeTransportCallbacks) {
    if (mode !== 'paused' || pausedMode !== 'practice') return
    callbacks = nextCallbacks
    mode = 'practice'
    scheduleSources(false, pausedAt)
  }

  function resumeReplay() {
    if (mode !== 'paused' || pausedMode !== 'replay' || !replayVoiceBuffer) return
    mode = 'replay'
    scheduleSources(
      true,
      pausedAt,
      replayVoiceBuffer,
      replayEndsAt,
      replayVoiceOffset,
      replayIncludesAccompaniment
    )
  }

  function position() {
    if (mode === 'paused') return pausedAt
    if (mode !== 'practice' && mode !== 'replay') return pausedAt
    return Math.max(0, Number(audioContext.currentTime) - scheduledAt + pausedAt)
  }

  function hasStarted() {
    return (
      (mode === 'practice' || mode === 'replay') && Number(audioContext.currentTime) >= scheduledAt
    )
  }

  function stop() {
    const stopStartedAt = Date.now()
    pausedAt = position()
    mode = 'idle'
    stopSources()
    console.info('[录音诊断] 回放源停止完成', { elapsedMs: Date.now() - stopStartedAt })
  }

  function stopSources() {
    ignoreEnded = true
    clearTimers()
    for (const source of accompanimentSources) source.onended = null
    if (voiceSource) voiceSource.onended = null
    try {
      for (const source of accompanimentSources) source.stop()
    } catch {}
    try {
      voiceSource?.stop()
    } catch {}
    accompanimentSources = []
    voiceSource = null
    queueMicrotask(() => {
      ignoreEnded = false
    })
  }

  function handleTransportEnded() {
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
    replayVoiceBuffer = null
    replayVoicePath = ''
    replayPreparation = null
    audioContext.close?.()
  }

  return {
    prepare,
    prepareReplay,
    startPractice,
    startReplay,
    pausePractice,
    resumePractice,
    pauseReplay,
    resumeReplay,
    position,
    hasStarted,
    stop,
    destroy
  }
}

function sliceAudioSegments(
  segments: PracticeAudioSegment[],
  offset: number,
  duration: number
) {
  const result: Array<PracticeAudioSegment & { timelineOffset: number }> = []
  let skipped = Math.max(0, offset)
  let remaining = Math.max(0, duration)
  let timelineOffset = 0
  for (const segment of segments) {
    if (remaining <= 0) break
    if (skipped >= segment.duration) {
      skipped -= segment.duration
      continue
    }
    const sourceOffset = segment.sourceOffset + skipped
    const available = segment.duration - skipped
    const selectedDuration = Math.min(available, remaining)
    result.push({ sourceOffset, duration: selectedDuration, timelineOffset })
    timelineOffset += selectedDuration
    remaining -= selectedDuration
    skipped = 0
  }
  return result
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
  if (!buffer?.numberOfChannels || typeof buffer.getChannelData !== 'function')
    return MINIMUM_VOICE_GAIN
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
  const readStartedAt = Date.now()
  const bytes = await readAudioFile(path)
  console.info('[录音诊断] 音频文件读取完成', {
    elapsedMs: Date.now() - readStartedAt,
    byteLength: bytes.byteLength
  })
  const decodeStartedAt = Date.now()
  return new Promise((resolve, reject) => {
    let completed = false
    const finish = (buffer: any) => {
      if (completed) return
      completed = true
      console.info('[录音诊断] decodeAudioData 完成', {
        elapsedMs: Date.now() - decodeStartedAt
      })
      resolve(buffer)
    }
    const pending = context.decodeAudioData(bytes.slice(0), finish, reject)
    if (pending?.then) pending.then(finish, reject)
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
  const filePath = /^https?:\/\//i.test(path) ? await cacheRemoteAudio(wxApi, path) : path.startsWith('/') ? path.slice(1) : path
  return new Promise((resolve, reject) => {
    wxApi.getFileSystemManager().readFile({
      filePath,
      success: (result: { data: ArrayBuffer }) => resolve(result.data),
      fail: reject
    })
  })
  // #endif

  throw new Error('scheduled audio is unavailable')
}

async function cacheRemoteAudio(wxApi: any, url: string) {
  const fileSystem = wxApi.getFileSystemManager()
  const cachePath = `${wxApi.env.USER_DATA_PATH}/singjourney-practice-${stableHash(url)}.opus`
  const exists = await new Promise<boolean>((resolve) => {
    fileSystem.access({ path: cachePath, success: () => resolve(true), fail: () => resolve(false) })
  })
  if (exists) return cachePath
  const downloadedPath = await new Promise<string>((resolve, reject) => {
    wxApi.downloadFile({
      url,
      success: (result: { statusCode: number; tempFilePath: string }) =>
        result.statusCode >= 200 && result.statusCode < 300
          ? resolve(result.tempFilePath)
          : reject(new Error(`audio download failed: ${result.statusCode}`)),
      fail: reject
    })
  })
  await new Promise<void>((resolve, reject) => {
    fileSystem.copyFile({
      srcPath: downloadedPath,
      destPath: cachePath,
      success: () => resolve(),
      fail: reject
    })
  })
  return cachePath
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function createFallbackTransport() {
  const accompaniment = createAudibleAudioPlayer()
  const voice = createAudibleAudioPlayer()
  let mode: TransportMode = 'idle'
  let startedAt = 0
  let pausedAt = 0
  let callbacks: PracticeTransportCallbacks | null = null
  let segmentOffset = 0
  let segmentDuration = Number.POSITIVE_INFINITY
  let replayIncludesAccompaniment = true
  let replayVoicePath = ''
  let endTimer: ReturnType<typeof setTimeout> | undefined

  function scheduleEnd() {
    if (endTimer) clearTimeout(endTimer)
    if (!Number.isFinite(segmentDuration)) return
    endTimer = setTimeout(() => {
      mode = 'idle'
      accompaniment.stop()
      voice.stop()
      callbacks?.onEnded()
    }, Math.max(0, segmentDuration - pausedAt) * 1000)
  }

  accompaniment.onPlay(() => {
    startedAt = Date.now()
    callbacks?.onStarted()
  })
  voice.onPlay(() => {
    if (mode !== 'replay' || replayIncludesAccompaniment) return
    startedAt = Date.now()
    callbacks?.onStarted()
  })
  accompaniment.onEnded(handleFallbackEnded)
  voice.onEnded(() => {
    if (mode === 'replay' && !replayIncludesAccompaniment) handleFallbackEnded()
  })
  accompaniment.onError(() => callbacks?.onError())
  voice.onError(() => callbacks?.onError())

  function handleFallbackEnded() {
    if (mode !== 'practice' && mode !== 'replay') return
    mode = 'idle'
    if (endTimer) clearTimeout(endTimer)
    callbacks?.onEnded()
  }

  return {
    async prepare(
      path: string,
      audioOffset = 0,
      duration?: number,
      _segments?: PracticeAudioSegment[]
    ) {
      accompaniment.src = path
      segmentOffset = Math.max(0, audioOffset)
      segmentDuration = duration === undefined ? Number.POSITIVE_INFINITY : Math.max(0, duration)
    },
    async prepareReplay(voicePath: string) {
      if (replayVoicePath === voicePath) return
      replayVoicePath = voicePath
      voice.src = voicePath
    },
    async startPractice(nextCallbacks: PracticeTransportCallbacks) {
      callbacks = nextCallbacks
      mode = 'practice'
      pausedAt = 0
      accompaniment.volume = 1
      accompaniment.seek(segmentOffset)
      accompaniment.play()
      scheduleEnd()
    },
    async startReplay(
      voicePath: string,
      nextCallbacks: PracticeTransportCallbacks,
      _endsAt?: number,
      voiceOffset = 0,
      includeAccompaniment = true
    ) {
      callbacks = nextCallbacks
      mode = 'replay'
      pausedAt = 0
      replayIncludesAccompaniment = includeAccompaniment
      accompaniment.volume = REPLAY_ACCOMPANIMENT_GAIN
      voice.volume = 1
      if (replayVoicePath !== voicePath) {
        replayVoicePath = voicePath
        voice.src = voicePath
      }
      accompaniment.seek(segmentOffset)
      voice.seek(voiceOffset)
      if (replayIncludesAccompaniment) accompaniment.play()
      voice.play()
      scheduleEnd()
    },
    pauseReplay() {
      pausedAt = Math.max(0, (Date.now() - startedAt) / 1000)
      mode = 'paused'
      if (endTimer) clearTimeout(endTimer)
      if (replayIncludesAccompaniment) accompaniment.pause()
      voice.pause()
    },
    pausePractice() {
      pausedAt = Math.max(0, (Date.now() - startedAt) / 1000)
      mode = 'paused'
      if (endTimer) clearTimeout(endTimer)
      accompaniment.pause()
    },
    resumePractice(nextCallbacks: PracticeTransportCallbacks) {
      callbacks = nextCallbacks
      mode = 'practice'
      if (replayIncludesAccompaniment) accompaniment.play()
      scheduleEnd()
    },
    resumeReplay() {
      mode = 'replay'
      accompaniment.play()
      voice.play()
      scheduleEnd()
    },
    position() {
      return mode === 'paused' ? pausedAt : pausedAt + Math.max(0, (Date.now() - startedAt) / 1000)
    },
    hasStarted() {
      return mode === 'practice' || mode === 'replay'
    },
    stop() {
      mode = 'idle'
      if (endTimer) clearTimeout(endTimer)
      accompaniment.stop()
      voice.stop()
    },
    destroy() {
      accompaniment.destroy()
      voice.destroy()
      if (endTimer) clearTimeout(endTimer)
    }
  }
}
