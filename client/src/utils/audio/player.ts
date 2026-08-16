const MAXIMUM_PLAYBACK_VOLUME = 1
let headphonesAudioMode = false

function miniProgramAudioOutputOptions() {
  return {
    obeyMuteSwitch: false,
    // 耳机模式必须关闭强制扬声器，否则 iOS 在播放伴奏并录音时会反复切换音频路由。
    speakerOn: !headphonesAudioMode
  } as const
}

/** 切换微信原生音频输出路由；失败时仍交给系统的自动路由继续工作。 */
export function configureHeadphonesAudioMode(enabled: boolean) {
  headphonesAudioMode = enabled

  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  return new Promise<void>((resolve) => {
    if (!wxApi.setInnerAudioOption) {
      resolve()
      return
    }
    wxApi.setInnerAudioOption({
      ...miniProgramAudioOutputOptions(),
      success: resolve,
      fail: resolve
    })
  })
  // #endif

  // #ifndef MP-WEIXIN
  return Promise.resolve()
  // #endif
}

export function createAudibleAudioPlayer() {
  const outputOptions = miniProgramAudioOutputOptions()
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  wxApi.setInnerAudioOption?.(outputOptions)
  // #endif

  const player = uni.createInnerAudioContext()
  player.volume = MAXIMUM_PLAYBACK_VOLUME

  // #ifdef MP-WEIXIN
  ;(player as any).obeyMuteSwitch = outputOptions.obeyMuteSwitch
  // #endif

  return player
}
