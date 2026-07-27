export const MINI_PROGRAM_VARIANTS = {
  pitchMeter: 'pitch-meter',
  vocalPractice: 'vocal-practice'
} as const

export type MiniProgramVariant = typeof MINI_PROGRAM_VARIANTS[keyof typeof MINI_PROGRAM_VARIANTS]

export const activeMiniProgramVariant = import.meta.env.VITE_MINI_PROGRAM_VARIANT || ''
export const isVocalPracticeMiniProgram = activeMiniProgramVariant === MINI_PROGRAM_VARIANTS.vocalPractice
