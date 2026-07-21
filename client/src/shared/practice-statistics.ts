export const PRACTICE_ACTIVITY_WEEKS = 20
export const PRACTICE_ACTIVITY_DAYS_PER_WEEK = 7
export const PRACTICE_ACTIVITY_LEVELS = 5

export interface PracticeSummary {
  sessions: number
  duration: string
}

export interface PracticeExerciseSummary {
  id: string
  titleKey: string
  sessions: number
  duration: string
  progress: number
}

export const DEMO_PRACTICE_SUMMARY: { today: PracticeSummary, total: PracticeSummary } = {
  today: { sessions: 5, duration: '18:40' },
  total: { sessions: 86, duration: '06:48:20' }
}

export const DEMO_TODAY_EXERCISES: readonly PracticeExerciseSummary[] = [
  { id: 'mum-octave', titleKey: 'practiceStats.exercises.mumOctave', sessions: 3, duration: '09:50', progress: 78 },
  { id: 'lip-trill-octave', titleKey: 'practiceStats.exercises.lipTrillOctave', sessions: 1, duration: '05:20', progress: 42 },
  { id: 'tongue-trill-five', titleKey: 'practiceStats.exercises.tongueTrillFive', sessions: 1, duration: '03:30', progress: 28 }
]

const DEMO_ACTIVITY_PATTERN = [
  0, 0, 1, 0, 2, 0, 0,
  0, 1, 0, 1, 3, 0, 0,
  1, 0, 2, 0, 2, 1, 0,
  0, 2, 1, 0, 3, 0, 1,
  1, 2, 0, 2, 4, 1, 0
] as const

const ACTIVITY_CELL_COUNT = PRACTICE_ACTIVITY_WEEKS * PRACTICE_ACTIVITY_DAYS_PER_WEEK

export const DEMO_PRACTICE_ACTIVITY = Array.from(
  { length: ACTIVITY_CELL_COUNT },
  (_, index) => DEMO_ACTIVITY_PATTERN[index % DEMO_ACTIVITY_PATTERN.length]
)
