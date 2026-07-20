export function wrapPcmAsWav(pcm: ArrayBuffer, sampleRate: number) {
  const wav = new ArrayBuffer(44 + pcm.byteLength)
  const view = new DataView(wav)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.byteLength, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcm.byteLength, true)
  new Uint8Array(wav, 44).set(new Uint8Array(pcm))
  return wav
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
