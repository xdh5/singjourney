export type RecordingPlaybackSourceSession = {
  loadedSourcePath: string
}

export function createRecordingPlaybackSourceSession(): RecordingPlaybackSourceSession {
  return { loadedSourcePath: '' }
}

export function canReuseRecordingPlaybackSource(
  session: RecordingPlaybackSourceSession,
  sourcePath: string
) {
  return Boolean(sourcePath) && session.loadedSourcePath === sourcePath
}

export function markRecordingPlaybackSourceLoaded(
  session: RecordingPlaybackSourceSession,
  sourcePath: string
) {
  session.loadedSourcePath = sourcePath
}

/**
 * Native sharing can leave InnerAudioContext holding a stale file handle even
 * when the shared file path did not change. Invalidate the logical source so
 * the next play assigns src again and reloads the complete recording.
 */
export function invalidateRecordingPlaybackSource(session: RecordingPlaybackSourceSession) {
  session.loadedSourcePath = ''
}
