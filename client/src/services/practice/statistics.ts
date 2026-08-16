import { getStoredAuthSession, requestAuthenticatedJson } from '../../utils/http/authentication'
import { apiStorageKey } from '../../utils/http/client'

const EVENT_STORAGE_KEY = apiStorageKey('practice.statistic-events')
const DEVICE_ID_STORAGE_KEY = apiStorageKey('practice.anonymous-device-id')
const LOCAL_STATISTICS_SNAPSHOT_KEY = apiStorageKey('practice.statistics-local-snapshot')
const FREE_PRACTICE_KEY = 'free-practice'
const FREE_PRACTICE_CATEGORY_KEY = 'natural'

export interface CompletedPracticeEvent {
  clientEventId: string
  exerciseKey: string
  durationSeconds: number
  startedAt: string
  endedAt: string
  title?: string
  primaryCategoryKey?: string
  primaryCategoryName?: string
}

interface StoredPracticeEvent extends CompletedPracticeEvent {
  ownerKey: string
  uploaded: boolean
}

interface PeriodResponse {
  sessions: number
  duration_seconds: number
}

interface ActivityDayResponse extends PeriodResponse {
  date: string
}

interface CategoryResponse extends PeriodResponse {
  category_key: string
  name: string
  percentage: number
}

interface RankingResponse extends PeriodResponse {
  exercise_key: string
  title: string
}

interface PracticeStatisticsResponse {
  week: {
    today: PeriodResponse
    overview: PeriodResponse & { practice_days: number; average_daily_seconds: number }
    daily_activity: ActivityDayResponse[]
    category_distribution: CategoryResponse[]
    top_exercises: RankingResponse[]
  }
  lifetime: {
    history: PeriodResponse & {
      started_on: string | null
      practice_days: number
      longest_streak_days: number
    }
    category_distribution: CategoryResponse[]
    top_exercises: RankingResponse[]
  }
}

export interface PracticeStatisticsView {
  today: { sessions: number; durationSeconds: number }
  week: {
    overview: {
      sessions: number
      durationSeconds: number
      practiceDays: number
      averageDailySeconds: number
    }
    dailyActivity: Array<{ date: string; sessions: number; durationSeconds: number }>
    categories: CategoryView[]
    topExercises: RankingView[]
  }
  lifetime: {
    history: {
      startedOn: string | null
      practiceDays: number
      durationSeconds: number
      sessions: number
      longestStreakDays: number
    }
    categories: CategoryView[]
    topExercises: RankingView[]
  }
}

export interface CategoryView {
  key: string
  name: string
  sessions: number
  durationSeconds: number
  percentage: number
}

export interface RankingView {
  id: string
  title: string
  sessions: number
  durationSeconds: number
}

export function createEmptyPracticeStatistics(): PracticeStatisticsView {
  return {
    today: { sessions: 0, durationSeconds: 0 },
    week: {
      overview: { sessions: 0, durationSeconds: 0, practiceDays: 0, averageDailySeconds: 0 },
      dailyActivity: currentWeekDates().map((date) => ({ date, sessions: 0, durationSeconds: 0 })),
      categories: [],
      topExercises: []
    },
    lifetime: {
      history: {
        startedOn: null,
        practiceDays: 0,
        durationSeconds: 0,
        sessions: 0,
        longestStreakDays: 0
      },
      categories: [],
      topExercises: []
    }
  }
}

export function createPracticeEventId() {
  return `practice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export async function recordCompletedPractice(event: CompletedPracticeEvent) {
  const normalized = normalizeEvent(event)
  if (!normalized) return
  const events = readEvents()
  if (!events.some((item) => item.clientEventId === normalized.clientEventId)) {
    events.push({ ...normalized, ownerKey: currentOwnerKey(), uploaded: false })
    writeEvents(events)
  }
  await flushPendingPracticeEvents()
}

export async function flushPendingPracticeEvents() {
  const session = getStoredAuthSession()
  if (!session) return
  const ownerKey = userOwnerKey(session.user.id)
  const events = claimAnonymousEvents(readEvents(), ownerKey)
  writeEvents(events)
  // 练声事件以 clientEventId 作为稳定标识；服务端幂等约束负责同 ID 冲突时保留线上记录。
  for (const event of events) {
    if (event.ownerKey !== ownerKey || event.uploaded) continue
    await requestAuthenticatedJson('/practice/sessions', 'POST', {
      client_event_id: event.clientEventId,
      exercise_key: event.exerciseKey,
      duration_seconds: event.durationSeconds,
      started_at: event.startedAt,
      ended_at: event.endedAt
    })
    event.uploaded = true
    writeEvents(events)
  }
  writeEvents(events.filter((event) => event.ownerKey !== ownerKey || !event.uploaded))
}

export async function fetchPracticeStatistics(): Promise<PracticeStatisticsView> {
  const session = getStoredAuthSession()
  if (!session) {
    return mergeStatistics(readLocalStatisticsSnapshot(), eventsForOwner(currentOwnerKey()))
  }

  const ownerKey = userOwnerKey(session.user.id)
  let events = claimAnonymousEvents(readEvents(), ownerKey)
  writeEvents(events)
  let synchronizationSucceeded = true
  try {
    await flushPendingPracticeEvents()
  } catch {
    // 网络恢复后继续同步；统计仍使用本地事件与上次服务器快照。
    synchronizationSucceeded = false
  }
  events = readEvents().filter((event) => event.ownerKey === ownerKey)
  if (!synchronizationSucceeded) {
    const cached = uni.getStorageSync(
      statisticsCacheKey(session.user.id)
    ) as PracticeStatisticsResponse | undefined
    return mergeStatistics(cached ? mapResponse(cached) : createEmptyPracticeStatistics(), events)
  }
  try {
    const timezoneOffset = new Date().getTimezoneOffset()
    const response = await requestAuthenticatedJson<PracticeStatisticsResponse>(
      `/practice/statistics?timezone_offset_minutes=${timezoneOffset}`
    )
    uni.setStorageSync(statisticsCacheKey(session.user.id), response)
    writeEvents(readEvents().filter((event) => event.ownerKey !== ownerKey || !event.uploaded))
    return mergeStatistics(mapResponse(response), events.filter((event) => !event.uploaded))
  } catch {
    const cached = uni.getStorageSync(
      statisticsCacheKey(session.user.id)
    ) as PracticeStatisticsResponse | undefined
    const base = cached ? mapResponse(cached) : createEmptyPracticeStatistics()
    return mergeStatistics(base, events)
  }
}

export async function persistCurrentStatisticsForLogout() {
  const session = getStoredAuthSession()
  if (!session) return

  try {
    await flushPendingPracticeEvents()
  } catch {
    // 未上传的练声事件仍保留在事件队列，并会合并进退出后的本地统计。
  }

  const timezoneOffset = new Date().getTimezoneOffset()
  let response: PracticeStatisticsResponse
  try {
    response = await requestAuthenticatedJson<PracticeStatisticsResponse>(
      `/practice/statistics?timezone_offset_minutes=${timezoneOffset}`
    )
    uni.setStorageSync(statisticsCacheKey(session.user.id), response)
  } catch (error) {
    const cached = uni.getStorageSync(
      statisticsCacheKey(session.user.id)
    ) as PracticeStatisticsResponse | undefined
    if (!cached) throw error
    response = cached
  }

  const ownerEvents = eventsForOwner(userOwnerKey(session.user.id))
  const statistics = mergeStatistics(mapResponse(response), ownerEvents)
  uni.setStorageSync(LOCAL_STATISTICS_SNAPSHOT_KEY, statistics)
}

export function clearLocalStatisticsSnapshot() {
  uni.removeStorageSync(LOCAL_STATISTICS_SNAPSHOT_KEY)
}

/** 登录同步成功后清理本地统计快照，原始本地事件由 flushPendingPracticeEvents 单独上传。 */
export async function synchronizePracticeStatisticsToServer() {
  await flushPendingPracticeEvents()
  clearLocalStatisticsSnapshot()
}

function mapResponse(response: PracticeStatisticsResponse): PracticeStatisticsView {
  return {
    today: {
      sessions: response.week.today.sessions,
      durationSeconds: response.week.today.duration_seconds
    },
    week: {
      overview: {
        sessions: response.week.overview.sessions,
        durationSeconds: response.week.overview.duration_seconds,
        practiceDays: response.week.overview.practice_days,
        averageDailySeconds: response.week.overview.average_daily_seconds
      },
      dailyActivity: response.week.daily_activity.map((day) => ({
        date: day.date,
        sessions: day.sessions,
        durationSeconds: day.duration_seconds
      })),
      categories: response.week.category_distribution.map(mapCategory),
      topExercises: response.week.top_exercises.map(mapRanking)
    },
    lifetime: {
      history: {
        startedOn: response.lifetime.history.started_on,
        practiceDays: response.lifetime.history.practice_days,
        durationSeconds: response.lifetime.history.duration_seconds,
        sessions: response.lifetime.history.sessions,
        longestStreakDays: response.lifetime.history.longest_streak_days
      },
      categories: response.lifetime.category_distribution.map(mapCategory),
      topExercises: response.lifetime.top_exercises.map(mapRanking)
    }
  }
}

function mapCategory(category: CategoryResponse): CategoryView {
  return {
    key: category.category_key,
    name: category.name,
    sessions: category.sessions,
    durationSeconds: category.duration_seconds,
    percentage: category.percentage
  }
}

function mapRanking(exercise: RankingResponse): RankingView {
  return {
    id: exercise.exercise_key,
    title: exercise.title,
    sessions: exercise.sessions,
    durationSeconds: exercise.duration_seconds
  }
}

function readLocalStatisticsSnapshot() {
  const stored = uni.getStorageSync(LOCAL_STATISTICS_SNAPSHOT_KEY) as
    | PracticeStatisticsView
    | undefined
  if (!stored?.lifetime?.history) return createEmptyPracticeStatistics()

  const snapshot = structuredStatisticsClone(stored)
  const currentDates = currentWeekDates()
  const snapshotDates = snapshot.week.dailyActivity.map((day) => day.date)
  if (snapshotDates.join(',') !== currentDates.join(',')) {
    const empty = createEmptyPracticeStatistics()
    snapshot.today = empty.today
    snapshot.week = empty.week
  }
  return snapshot
}

function mergeStatistics(base: PracticeStatisticsView, events: StoredPracticeEvent[]) {
  const result = structuredStatisticsClone(base)
  const weekDates = new Set(result.week.dailyActivity.map((day) => day.date))
  const serverWeekPracticeDates = new Set(
    result.week.dailyActivity.filter((day) => day.sessions > 0).map((day) => day.date)
  )
  const knownWeekPracticeDates = new Set(
    serverWeekPracticeDates
  )
  const localLifetimeDates = new Set<string>()
  const today = localDateKey(new Date())

  for (const event of events) {
    const eventDate = localDateKey(new Date(event.startedAt))
    localLifetimeDates.add(eventDate)
    result.lifetime.history.sessions += 1
    result.lifetime.history.durationSeconds += event.durationSeconds
    if (!result.lifetime.history.startedOn || eventDate < result.lifetime.history.startedOn) {
      result.lifetime.history.startedOn = eventDate
    }
    addRanking(result.lifetime.topExercises, event)
    addCategory(result.lifetime.categories, event)

    if (!weekDates.has(eventDate)) continue
    const day = result.week.dailyActivity.find((item) => item.date === eventDate)
    if (!day) continue
    day.sessions += 1
    day.durationSeconds += event.durationSeconds
    result.week.overview.sessions += 1
    result.week.overview.durationSeconds += event.durationSeconds
    knownWeekPracticeDates.add(eventDate)
    addRanking(result.week.topExercises, event)
    addCategory(result.week.categories, event)
    if (eventDate === today) {
      result.today.sessions += 1
      result.today.durationSeconds += event.durationSeconds
    }
  }

  result.week.overview.practiceDays = knownWeekPracticeDates.size
  result.week.overview.averageDailySeconds = result.week.overview.practiceDays
    ? result.week.overview.durationSeconds / result.week.overview.practiceDays
    : 0
  result.lifetime.history.practiceDays += [...localLifetimeDates].filter(
    (date) => !serverWeekPracticeDates.has(date)
  ).length
  result.lifetime.history.longestStreakDays = Math.max(
    result.lifetime.history.longestStreakDays,
    longestStreak([...localLifetimeDates])
  )
  finishCollection(result.week.categories, result.week.topExercises)
  finishCollection(result.lifetime.categories, result.lifetime.topExercises)
  return result
}

function addCategory(categories: CategoryView[], event: StoredPracticeEvent) {
  const key = event.primaryCategoryKey || inferCategory(event.exerciseKey)
  const existing = categories.find((category) => category.key === key)
  if (existing) {
    existing.sessions += 1
    existing.durationSeconds += event.durationSeconds
    return
  }
  categories.push({
    key,
    name: event.primaryCategoryName || key,
    sessions: 1,
    durationSeconds: event.durationSeconds,
    percentage: 0
  })
}

function addRanking(ranking: RankingView[], event: StoredPracticeEvent) {
  const existing = ranking.find((exercise) => exercise.id === event.exerciseKey)
  if (existing) {
    existing.sessions += 1
    existing.durationSeconds += event.durationSeconds
    return
  }
  ranking.push({
    id: event.exerciseKey,
    title: event.title || event.exerciseKey,
    sessions: 1,
    durationSeconds: event.durationSeconds
  })
}

function finishCollection(categories: CategoryView[], ranking: RankingView[]) {
  const totalDuration = categories.reduce((total, category) => total + category.durationSeconds, 0)
  for (const category of categories) {
    category.percentage = totalDuration ? (category.durationSeconds / totalDuration) * 100 : 0
  }
  categories.sort((left, right) => right.durationSeconds - left.durationSeconds)
  ranking.sort(
    (left, right) =>
      right.sessions - left.sessions ||
      right.durationSeconds - left.durationSeconds ||
      left.title.localeCompare(right.title)
  )
  ranking.splice(5)
}

function normalizeEvent(event: CompletedPracticeEvent): CompletedPracticeEvent | null {
  const durationSeconds = Math.min(10 * 60, Math.max(0, Number(event.durationSeconds)))
  if (!event.clientEventId || !event.exerciseKey || durationSeconds < 1) return null
  return { ...event, durationSeconds }
}

function currentOwnerKey() {
  const session = getStoredAuthSession()
  return session ? userOwnerKey(session.user.id) : anonymousOwnerKey()
}

function userOwnerKey(userId: string) {
  return `user:${userId}`
}

function anonymousOwnerKey() {
  let deviceId = uni.getStorageSync(DEVICE_ID_STORAGE_KEY) as string
  if (!deviceId) {
    deviceId = `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    uni.setStorageSync(DEVICE_ID_STORAGE_KEY, deviceId)
  }
  return `anonymous:${deviceId}`
}

function claimAnonymousEvents(events: StoredPracticeEvent[], ownerKey: string) {
  return events.map((event) =>
    event.ownerKey.startsWith('anonymous:') ? { ...event, ownerKey } : event
  )
}

function eventsForOwner(ownerKey: string) {
  return readEvents().filter((event) => event.ownerKey === ownerKey)
}

function readEvents(): StoredPracticeEvent[] {
  const stored = uni.getStorageSync(EVENT_STORAGE_KEY)
  return Array.isArray(stored) ? stored : []
}

function writeEvents(events: StoredPracticeEvent[]) {
  if (events.length) uni.setStorageSync(EVENT_STORAGE_KEY, events)
  else uni.removeStorageSync(EVENT_STORAGE_KEY)
}

function statisticsCacheKey(userId: string) {
  return apiStorageKey(`practice.statistics-cache.${userId}`)
}

function structuredStatisticsClone(value: PracticeStatisticsView): PracticeStatisticsView {
  return JSON.parse(JSON.stringify(value)) as PracticeStatisticsView
}

function currentWeekDates() {
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return localDateKey(date)
  })
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function longestStreak(dates: string[]) {
  const sorted = [...new Set(dates)].sort()
  let longest = 0
  let current = 0
  let previous: Date | null = null
  for (const value of sorted) {
    const date = new Date(`${value}T00:00:00`)
    current = previous && date.getTime() - previous.getTime() === 86_400_000 ? current + 1 : 1
    longest = Math.max(longest, current)
    previous = date
  }
  return longest
}

function inferCategory(exerciseKey: string) {
  if (exerciseKey === FREE_PRACTICE_KEY || exerciseKey.startsWith('natural-'))
    return FREE_PRACTICE_CATEGORY_KEY
  if (exerciseKey.startsWith('closure-') || exerciseKey === 'connection-gug-five')
    return 'connection'
  if (exerciseKey.startsWith('connection-') || exerciseKey.startsWith('register-'))
    return 'passaggio'
  if (exerciseKey.startsWith('range-')) return 'range'
  return 'mix'
}
