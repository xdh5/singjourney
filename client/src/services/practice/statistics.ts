import { requestAuthenticatedJson } from '../../utils/http/authentication'

export const PRACTICE_ACTIVITY_WEEKS = 20
export const PRACTICE_ACTIVITY_DAYS_PER_WEEK = 7
export const PRACTICE_ACTIVITY_LEVELS = 5

const PENDING_EVENTS_STORAGE_KEY = 'singjourney.practice.pending-statistic-events'
const ACTIVITY_DURATION_LEVEL_SECONDS = [0, 60, 5 * 60, 15 * 60, 30 * 60] as const
const ACTIVITY_SESSION_LEVEL_COUNTS = [0, 1, 2, 3, 5] as const

export interface CompletedPracticeEvent {
  clientEventId: string
  exerciseKey: string
  durationSeconds: number
  startedAt: string
  endedAt: string
}

interface PracticeActivityDayResponse {
  date: string
  sessions: number
  duration_seconds: number
}

interface PracticeExerciseResponse {
  exercise_key: string
  title: string
  sessions: number
  duration_seconds: number
}

interface PracticeStatisticsResponse {
  today: { sessions: number; duration_seconds: number }
  total: { sessions: number; duration_seconds: number }
  activity: PracticeActivityDayResponse[]
  today_exercises: PracticeExerciseResponse[]
}

export interface PracticeStatisticsView {
  today: { sessions: number; duration: string; durationSeconds: number }
  total: { sessions: number; duration: string; durationSeconds: number }
  activity: Array<PracticeActivityDayResponse & { level: number }>
  todayExercises: Array<{
    id: string
    title: string
    sessions: number
    duration: string
    progress: number
  }>
}

export const EMPTY_PRACTICE_STATISTICS: PracticeStatisticsView = {
  today: { sessions: 0, duration: '00:00', durationSeconds: 0 },
  total: { sessions: 0, duration: '00:00', durationSeconds: 0 },
  activity: [],
  todayExercises: []
}

export function createPracticeEventId() {
  return `practice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export async function recordCompletedPractice(event: CompletedPracticeEvent) {
  const pending = readPendingEvents()
  if (!pending.some((item) => item.clientEventId === event.clientEventId)) pending.push(event)
  writePendingEvents(pending)
  await flushPendingPracticeEvents()
}

export async function flushPendingPracticeEvents() {
  const pending = readPendingEvents()
  const remaining: CompletedPracticeEvent[] = []
  for (let index = 0; index < pending.length; index += 1) {
    const event = pending[index]
    try {
      await requestAuthenticatedJson('/practice/sessions', 'POST', {
        client_event_id: event.clientEventId,
        exercise_key: event.exerciseKey,
        duration_seconds: event.durationSeconds,
        started_at: event.startedAt,
        ended_at: event.endedAt
      })
    } catch (error) {
      remaining.push(...pending.slice(index))
      writePendingEvents(remaining)
      throw error
    }
  }
  writePendingEvents([])
}

export async function fetchPracticeStatistics(): Promise<PracticeStatisticsView> {
  const timezoneOffset = new Date().getTimezoneOffset()
  const response = await requestAuthenticatedJson<PracticeStatisticsResponse>(
    `/practice/statistics?timezone_offset_minutes=${timezoneOffset}`
  )
  const maximumExerciseDuration = Math.max(
    1,
    ...response.today_exercises.map((item) => item.duration_seconds)
  )
  return {
    today: {
      sessions: response.today.sessions,
      duration: formatDuration(response.today.duration_seconds),
      durationSeconds: response.today.duration_seconds
    },
    total: {
      sessions: response.total.sessions,
      duration: formatDuration(response.total.duration_seconds),
      durationSeconds: response.total.duration_seconds
    },
    activity: response.activity.map((day) => ({ ...day, level: activityLevel(day) })),
    todayExercises: response.today_exercises.map((exercise) => ({
      id: exercise.exercise_key,
      title: exercise.title,
      sessions: exercise.sessions,
      duration: formatDuration(exercise.duration_seconds),
      progress: Math.round((exercise.duration_seconds / maximumExerciseDuration) * 100)
    }))
  }
}

function activityLevel(day: PracticeActivityDayResponse) {
  let level = 0
  for (let candidate = 1; candidate < PRACTICE_ACTIVITY_LEVELS; candidate += 1) {
    if (
      day.duration_seconds >= ACTIVITY_DURATION_LEVEL_SECONDS[candidate] ||
      day.sessions >= ACTIVITY_SESSION_LEVEL_COUNTS[candidate]
    )
      level = candidate
  }
  return level
}

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const remainder = whole % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function readPendingEvents(): CompletedPracticeEvent[] {
  const stored = uni.getStorageSync(PENDING_EVENTS_STORAGE_KEY)
  return Array.isArray(stored) ? stored : []
}

function writePendingEvents(events: CompletedPracticeEvent[]) {
  if (events.length === 0) uni.removeStorageSync(PENDING_EVENTS_STORAGE_KEY)
  else uni.setStorageSync(PENDING_EVENTS_STORAGE_KEY, events)
}
