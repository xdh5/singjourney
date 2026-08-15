export type PitchWorker = {
  postMessage: (message: unknown) => void
  terminate?: () => void
  onMessage: (callback: (message: any) => void) => void
  onError?: (callback: () => void) => void
}

export function createPitchWorker(
  onMessage: (message: any) => void,
  onError: () => void
): PitchWorker | null {
  // #ifdef MP-WEIXIN
  const wxApi = (globalThis as any).wx
  if (!wxApi?.createWorker) return null
  const worker = wxApi.createWorker('static/workers/pitch.js') as PitchWorker
  worker.onMessage(onMessage)
  worker.onError?.(onError)
  return worker
  // #endif

  return null
}
