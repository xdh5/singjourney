export type PitchCanvasSurface = {
  context: any
  direct: boolean
  node?: any
  commit: () => void
}

export async function createPitchCanvasSurface(input: {
  id: string
  width: number
  height: number
  pixelRatio: number
  component?: any
}): Promise<PitchCanvasSurface> {
  const pixelRatio = Math.min(2, Math.max(1, input.pixelRatio || 1))

  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    const query = (uni.createSelectorQuery() as any).in(input.component)
    query.select(`#${input.id}`).fields({ node: true, size: true }).exec((result: any[]) => {
      const canvas = result?.[0]?.node
      if (!canvas) {
        reject(new Error('无法初始化微信 Canvas'))
        return
      }
      canvas.width = input.width * pixelRatio
      canvas.height = input.height * pixelRatio
      const context = canvas.getContext('2d')
      context.scale(pixelRatio, pixelRatio)
      resolve({ context, direct: true, node: canvas, commit: () => {} })
    })
  })
  // #endif

  // #ifdef H5
  const canvasHost = document.getElementById(input.id)
  const canvas = (canvasHost instanceof HTMLCanvasElement
    ? canvasHost
    : canvasHost?.querySelector('canvas') ?? null) as HTMLCanvasElement
  if (!canvas) throw new Error('无法初始化 Web Canvas')
  canvas.style.width = `${input.width}px`
  canvas.style.height = `${input.height}px`
  // uni-canvas updates its backing-store size from a resize sensor. Wait for
  // that update before applying the final DPR transform, otherwise it resets
  // the context to identity after our first draw and halves the visible area.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  canvas.width = Math.round(input.width * pixelRatio)
  canvas.height = Math.round(input.height * pixelRatio)
  const webContext = canvas.getContext('2d') as CanvasRenderingContext2D
  if (!webContext) throw new Error('浏览器不支持 Canvas 2D')
  // Use CSS-pixel drawing coordinates with a high-resolution backing store.
  // This prevents mobile WebViews from clipping the pitch rail on the right.
  webContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  return { context: webContext, direct: true, node: canvas, commit: () => {} }
  // #endif

  // #ifndef MP-WEIXIN
  // #ifndef H5
  const legacyContext = uni.createCanvasContext(input.id, input.component)
  return { context: legacyContext, direct: false, commit: () => legacyContext.draw() }
  // #endif
  // #endif
}
