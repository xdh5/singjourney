import { requestJson, resolveApiUrl } from '../../utils/http/client'
import type { PracticeManifest } from '../../utils/practice/types'
import type { VocalRange } from '../account/preferences'

export type PracticeCategory = { key: string; name: string }

export type PracticeExercise = {
  id: string
  title: string
  tip: string
  category_keys: string[]
  category_names: string[]
  pattern: string
  recommended_syllables: string
  tempo: number
  repetitions: number
  intensity: string
  enabled: boolean
}

export type PracticeCatalog = {
  categories: PracticeCategory[]
  exercises: PracticeExercise[]
}

export function fetchPracticeCatalog() {
  return requestJson<PracticeCatalog>('/practice/catalog')
}

type PracticeManifestResponse = {
  exercise_key: string
  version: number
  voice: string
  tempo_bpm: number
  range: { minimum_midi: number; maximum_midi: number }
  duration: number
  audio_path: string
  audio_offset: number
  audio_segments: Array<{ source_offset: number; duration: number }>
  target_notes: Array<{ start: number; end: number; midi: number }>
}

export async function fetchPracticeManifest(exerciseId: string, range: VocalRange) {
  const response = await requestJson<PracticeManifestResponse>(
    `/practice/exercises/${encodeURIComponent(exerciseId)}/manifest?minimum_midi=${range.minimumMidi}&maximum_midi=${range.maximumMidi}`
  )
  return {
    exerciseKey: response.exercise_key,
    version: response.version,
    voice: response.voice,
    tempoBpm: response.tempo_bpm,
    range: {
      minimumMidi: response.range.minimum_midi,
      maximumMidi: response.range.maximum_midi
    },
    duration: response.duration,
    audioPath: resolveApiUrl(response.audio_path),
    audioOffset: response.audio_offset,
    audioSegments: response.audio_segments.map((segment) => ({
      sourceOffset: segment.source_offset,
      duration: segment.duration
    })),
    targetNotes: response.target_notes
  } satisfies PracticeManifest
}
