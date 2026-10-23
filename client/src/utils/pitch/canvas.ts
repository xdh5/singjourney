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

  return new Promise((resolve, reject) => {
    const query = (uni.createSelectorQuery() as any).in(input.component)
    query
      .select(`#${input.id}`)
      .fields({ node: true, size: true })
      .exec((result: any[]) => {
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
}
