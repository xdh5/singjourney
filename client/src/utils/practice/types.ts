import type { StoredPitchPoint } from '@singjourney/contracts'
export type PracticeTargetNote = {
  start: number
  end: number
  midi: number
}

export type PracticeManifest = {
  exerciseKey: string
  version: number
  voice: string
  tempoBpm: number
  range: { minimumMidi: number; maximumMidi: number }
  duration: number
  audioPath: string
  audioOffset: number
  audioSegments: Array<{ sourceOffset: number; duration: number }>
  targetNotes: PracticeTargetNote[]
}

export type CompletedPractice = {
  manifest: PracticeManifest
  userCurve: StoredPitchPoint[]
  recordingPath: string
  recordingBlob?: Blob
}
