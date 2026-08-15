const MAXIMUM_PLAYBACK_VOLUME = 1
const MINI_PROGRAM_AUDIO_OUTPUT_OPTIONS = {
  obeyMuteSwitch: false,
  speakerOn: true
} as const

export function createAudibleAudioPlayer() {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  wxApi.setInnerAudioOption?.(MINI_PROGRAM_AUDIO_OUTPUT_OPTIONS)
  // #endif

  const player = uni.createInnerAudioContext()
  player.volume = MAXIMUM_PLAYBACK_VOLUME

  // #ifdef MP-WEIXIN
  ;(player as any).obeyMuteSwitch = MINI_PROGRAM_AUDIO_OUTPUT_OPTIONS.obeyMuteSwitch
  // #endif

  return player
}
