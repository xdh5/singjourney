import { CLIENT_RELEASE } from '../config/release'
import { apiStorageKey, requestJson } from './http/client'

const TELEMETRY_STORAGE_KEY = apiStorageKey('telemetry.queue')
const ANONYMOUS_ID_STORAGE_KEY = apiStorageKey('telemetry.anonymous-id')
const TELEMETRY_FLUSH_DELAY_MS = 5000
const TELEMETRY_MAXIMUM_RETRY_DELAY_MS = 60000
const MAXIMUM_QUEUED_EVENTS = 100
const MAXIMUM_BATCH_EVENTS = 20

export const TELEMETRY_EVENT = Object.freeze({
  APP_OPENED: 'app_opened',
  FEATURE_OPENED: 'feature_opened',
  RECORDING_STARTED: 'recording_started',
  RECORDING_PAUSED: 'recording_paused',
  RECORDING_RESUMED: 'recording_resumed',
  RECORDING_COMPLETED: 'recording_completed',
  RECORDING_SAVED: 'recording_saved',
  RECORDING_SAVE_FAILED: 'recording_save_failed',
  RECORDING_SHARE_CLICKED: 'recording_share_clicked',
  RECORDING_SHARE_SUCCEEDED: 'recording_share_succeeded',
  RECORDING_SHARE_FAILED: 'recording_share_failed',
  RECORDING_PLAY_FAILED: 'recording_play_failed',
  CLIENT_ERROR: 'client_error'
} as const)

export type TelemetryEventName = (typeof TELEMETRY_EVENT)[keyof typeof TELEMETRY_EVENT]

interface TelemetryEvent {
  event_id: string
  event_name: TelemetryEventName
  occurred_at: string
  platform: string
  app_version: string
  anonymous_id: string
  session_id: string
  locale: string
  source_page: string
  feature_key?: string
  recording_id?: string
  duration_seconds?: number
  error_code?: string
}

export interface TelemetryEventDetails {
  sourcePage: string
  recordingId?: string
  durationSeconds?: number
  errorCode?: string
  featureKey?: string
}

const sessionId = createTelemetryId()
let queue = readQueue()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let retryDelayMs = TELEMETRY_FLUSH_DELAY_MS

export function initializeTelemetry() {
  trackTelemetry(TELEMETRY_EVENT.APP_OPENED, { sourcePage: 'app' })
}

export function createTelemetryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function trackTelemetry(eventName: TelemetryEventName, details: TelemetryEventDetails) {
  const event: TelemetryEvent = {
    event_id: createTelemetryId(),
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    platform: resolveTelemetryPlatform(),
    app_version: CLIENT_RELEASE.version,
    anonymous_id: getAnonymousId(),
    session_id: sessionId,
    locale: resolveLocale(),
    source_page: details.sourcePage
  }
  if (details.recordingId) event.recording_id = details.recordingId
  if (details.featureKey) event.feature_key = details.featureKey
  if (Number.isFinite(details.durationSeconds)) {
    event.duration_seconds = Math.max(0, Math.min(600, Number(details.durationSeconds)))
  }
  if (details.errorCode) event.error_code = details.errorCode
  queue.push(event)
  if (queue.length > MAXIMUM_QUEUED_EVENTS) queue = queue.slice(-MAXIMUM_QUEUED_EVENTS)
  persistQueue()
  scheduleFlush()
}

export function captureClientError(errorCode: string, sourcePage: string, recordingId?: string) {
  trackTelemetry(TELEMETRY_EVENT.CLIENT_ERROR, { errorCode, sourcePage, recordingId })
}

function scheduleFlush(delayMs = TELEMETRY_FLUSH_DELAY_MS) {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushTelemetry()
  }, delayMs)
}

async function flushTelemetry() {
  if (flushing || queue.length === 0) return
  flushing = true
  const batch = queue.slice(0, MAXIMUM_BATCH_EVENTS)
  try {
    await sendBatch(batch)
    queue.splice(0, batch.length)
    persistQueue()
    retryDelayMs = TELEMETRY_FLUSH_DELAY_MS
  } catch {
    retryDelayMs = Math.min(retryDelayMs * 2, TELEMETRY_MAXIMUM_RETRY_DELAY_MS)
  } finally {
    flushing = false
    if (queue.length > 0) scheduleFlush(retryDelayMs)
  }
}

function sendBatch(events: TelemetryEvent[]) {
  return requestJson<void>('/telemetry/events', {
    method: 'POST',
    data: { events },
    timeoutMs: 10000
  })
}

function readQueue(): TelemetryEvent[] {
  const stored = uni.getStorageSync(TELEMETRY_STORAGE_KEY)
  return Array.isArray(stored) ? stored.slice(-MAXIMUM_QUEUED_EVENTS) : []
}

function persistQueue() {
  uni.setStorageSync(TELEMETRY_STORAGE_KEY, queue)
}

function getAnonymousId() {
  const stored = uni.getStorageSync(ANONYMOUS_ID_STORAGE_KEY)
  if (typeof stored === 'string' && stored.length >= 8) return stored
  const created = createTelemetryId()
  uni.setStorageSync(ANONYMOUS_ID_STORAGE_KEY, created)
  return created
}

function resolveLocale() {
  try {
    return uni.getLocale?.() || 'unknown'
  } catch {
    return 'unknown'
  }
}

function resolveTelemetryPlatform() {
  let platform: string = CLIENT_RELEASE.platform
  // #ifdef H5
  platform = 'web'
  // #endif
  // #ifdef MP-WEIXIN
  platform = 'wx'
  // #endif
  // #ifdef APP-HARMONY
  platform = 'harmony'
  // #endif
  return platform
}
