export type VoicePreset = 'male' | 'female'
export type ExerciseCategory = 'natural' | 'connection' | 'passaggio' | 'range' | 'mix'
export const VOICE_PRESET_RANGES: Record<VoicePreset, { label: string; minimumMidi: number; maximumMidi: number }> = {
  male: { label: 'C3–C5', minimumMidi: 48, maximumMidi: 72 },
  female: { label: 'F3–F5', minimumMidi: 53, maximumMidi: 77 }
}

export const ENABLED_EXERCISE_ID = 'connection-mum-octave'

export type VocalExercise = {
  id: string
  titleKey: string
  descriptionKey: string
  category: ExerciseCategory
  pattern: string
  syllables: string
  tempo: number
  repetitions: number
  intensity: 'light' | 'medium' | 'focused'
  enabled: boolean
}

export const EXERCISE_CATEGORIES: readonly ExerciseCategory[] = [
  'natural',
  'connection',
  'passaggio',
  'range',
  'mix'
]

// The course follows a speech-like, connected progression inspired by SLS pedagogy.
// Names, patterns, copy, and future accompaniments are original project material and
// must not be presented as an official or licensed Speech Level Singing course.
export const VOCAL_EXERCISES: readonly VocalExercise[] = [
  {
    id: 'natural-lip-trill-octave',
    titleKey: 'practice.exercises.lipTrillOctave.title',
    descriptionKey: 'practice.exercises.lipTrillOctave.description',
    category: 'natural',
    pattern: '1–3–5–8–5–3–1',
    syllables: 'Brrr',
    tempo: 68,
    repetitions: 4,
    intensity: 'light',
    enabled: false
  },
  {
    id: 'natural-tongue-trill-five',
    titleKey: 'practice.exercises.tongueTrillFive.title',
    descriptionKey: 'practice.exercises.tongueTrillFive.description',
    category: 'natural',
    pattern: '1–2–3–4–5–4–3–2–1',
    syllables: 'Rrr',
    tempo: 72,
    repetitions: 4,
    intensity: 'light',
    enabled: false
  },
  {
    id: 'connection-mum-octave',
    titleKey: 'practice.exercises.mumOctave.title',
    descriptionKey: 'practice.exercises.mumOctave.description',
    category: 'connection',
    pattern: '1–3–5–8–8–8–8–5–3–1',
    syllables: 'Mum',
    tempo: 70,
    repetitions: 13,
    intensity: 'light',
    enabled: true
  },
  {
    id: 'connection-gug-five',
    titleKey: 'practice.exercises.gugFive.title',
    descriptionKey: 'practice.exercises.gugFive.description',
    category: 'connection',
    pattern: '1–2–3–4–5–4–3–2–1',
    syllables: 'Gug',
    tempo: 76,
    repetitions: 5,
    intensity: 'medium',
    enabled: false
  },
  {
    id: 'passaggio-gee-long-scale',
    titleKey: 'practice.exercises.geeLongScale.title',
    descriptionKey: 'practice.exercises.geeLongScale.description',
    category: 'passaggio',
    pattern: '1–2–3–4–5–6–7–8–9–10–11–12–13–12…–1',
    syllables: 'Gee',
    tempo: 80,
    repetitions: 3,
    intensity: 'medium',
    enabled: false
  },
  {
    id: 'passaggio-nay-octave',
    titleKey: 'practice.exercises.nayOctave.title',
    descriptionKey: 'practice.exercises.nayOctave.description',
    category: 'passaggio',
    pattern: '1–3–5–8–8–8–8–5–3–1',
    syllables: 'Nay',
    tempo: 76,
    repetitions: 4,
    intensity: 'medium',
    enabled: false
  },
  {
    id: 'range-lip-trill-twelfth',
    titleKey: 'practice.exercises.lipTrillTwelfth.title',
    descriptionKey: 'practice.exercises.lipTrillTwelfth.description',
    category: 'range',
    pattern: '1–3–5–8–10–12–10–8–5–3–1',
    syllables: 'Brrr',
    tempo: 72,
    repetitions: 3,
    intensity: 'medium',
    enabled: false
  },
  {
    id: 'range-noo-octave-scale',
    titleKey: 'practice.exercises.nooOctave.title',
    descriptionKey: 'practice.exercises.nooOctave.description',
    category: 'range',
    pattern: '1–2–3–4–5–6–7–8–7–6–5–4–3–2–1',
    syllables: 'Noo',
    tempo: 78,
    repetitions: 4,
    intensity: 'medium',
    enabled: false
  },
  {
    id: 'mix-nay-five',
    titleKey: 'practice.exercises.nayFive.title',
    descriptionKey: 'practice.exercises.nayFive.description',
    category: 'mix',
    pattern: '1–2–3–4–5–4–3–2–1',
    syllables: 'Nay',
    tempo: 82,
    repetitions: 5,
    intensity: 'medium',
    enabled: false
  },
  {
    id: 'mix-mum-octave-repeat',
    titleKey: 'practice.exercises.mumOctaveRepeat.title',
    descriptionKey: 'practice.exercises.mumOctaveRepeat.description',
    category: 'mix',
    pattern: '1–3–5–8–8–8–8–5–3–1',
    syllables: 'Mum',
    tempo: 76,
    repetitions: 4,
    intensity: 'focused',
    enabled: false
  },
  {
    id: 'mix-gee-staccato-arpeggio',
    titleKey: 'practice.exercises.geeStaccato.title',
    descriptionKey: 'practice.exercises.geeStaccato.description',
    category: 'mix',
    pattern: '1·3·5·8·5·3·1',
    syllables: 'Gee',
    tempo: 84,
    repetitions: 4,
    intensity: 'focused',
    enabled: false
  }
]
