import type { StoredPitchPoint } from '@singjourney/contracts'
import type { VoicePreset } from '../../services/practice/catalog'

export type PracticeTargetNote = {
  start: number
  end: number
  midi: number
}

export type PracticeManifest = {
  exerciseKey: string
  version: number
  voice: VoicePreset
  tempoBpm: number
  range: { minimumMidi: number; maximumMidi: number }
  duration: number
  audioPath: string
  audioOffset: number
  targetNotes: PracticeTargetNote[]
}

export type CompletedPractice = {
  manifest: PracticeManifest
  userCurve: StoredPitchPoint[]
  recordingPath: string
  recordingBlob?: Blob
}
