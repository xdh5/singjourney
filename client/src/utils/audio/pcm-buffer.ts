export function createPcmBuffer(blockSize = 64 * 1024) {
  let blocks: Uint8Array[] = []
  let block = new Uint8Array(blockSize)
  let blockOffset = 0
  let byteLength = 0

  return {
    append(buffer: ArrayBuffer) {
      const source = new Uint8Array(buffer)
      let sourceOffset = 0
      while (sourceOffset < source.length) {
        const writable = Math.min(source.length - sourceOffset, blockSize - blockOffset)
        block.set(source.subarray(sourceOffset, sourceOffset + writable), blockOffset)
        blockOffset += writable
        byteLength += writable
        sourceOffset += writable
        if (blockOffset === blockSize) {
          blocks.push(block)
          block = new Uint8Array(blockSize)
          blockOffset = 0
        }
      }
    },
    reset() {
      blocks = []
      block = new Uint8Array(blockSize)
      blockOffset = 0
      byteLength = 0
    },
    chunks() {
      return blockOffset > 0 ? [...blocks, block.subarray(0, blockOffset)] : blocks
    },
    get byteLength() {
      return byteLength
    }
  }
}
