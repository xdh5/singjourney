export function hideMiniProgramShareMenu() {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  wxApi?.hideShareMenu?.({
    menus: ['shareAppMessage', 'shareTimeline']
  })
  // #endif
}
