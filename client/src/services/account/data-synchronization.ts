import {
  clearLocalUserSnapshot,
  readLocalUserSnapshot,
  storeLocalUserSnapshot,
  updateCurrentUserProfile,
  type StoredAuthSession
} from '../../utils/http/authentication'
import {
  clearLocalVocalRange,
  isVocalRange,
  readStoredLocalVocalRange,
  storeLocalVocalRange,
  vocalRangeFromLegacyVoice,
  type VocalRange
} from './preferences'
import { resolveScalarServerFirst } from './sync-policy'
import {
  synchronizePracticeFavoritesToLocal,
  synchronizePracticeFavoritesToServer
} from '../practice/favorites'
import {
  persistCurrentStatisticsForLogout,
  synchronizePracticeStatisticsToServer
} from '../practice/statistics'

/**
 * 所有按用户写入服务器的数据都在这里登记登录同步。
 * 集合数据取并集；单值冲突线上优先；每一类数据只有同步成功后才清自己的本地副本。
 */
export async function synchronizeAllUserDataAfterLogin(session: StoredAuthSession) {
  let synchronizedSession = session
  const localRange = readStoredLocalVocalRange()
  const serverRange = readServerVocalRange(session)
  const range = resolveScalarServerFirst(
    localRange,
    serverRange,
    isVocalRange
  )

  if (range.source === 'server') {
    clearLocalVocalRange()
  } else if (range.source === 'local' && range.value) {
    try {
      synchronizedSession = await updateCurrentUserProfile({
        preferredRangeMinimumMidi: range.value.minimumMidi,
        preferredRangeMaximumMidi: range.value.maximumMidi
      })
      clearLocalVocalRange()
    } catch {
      // 单值同步失败时保留本地值，但不阻塞其他用户数据继续同步。
    }
  }

  // 用户资料只允许登录后编辑，因此发生冲突时服务器资料直接作为当前版本。
  resolveScalarServerFirst(readLocalUserSnapshot(), synchronizedSession.user, isStoredUser)
  clearLocalUserSnapshot()

  const results = await Promise.allSettled([
    synchronizePracticeFavoritesToServer(),
    synchronizePracticeStatisticsToServer()
  ])
  // 某类同步失败时其本地副本仍保留，下次登录或进入对应页面继续重试。
  void results
  return synchronizedSession
}

/**
 * 退出前把所有服务器用户数据落回本地。任一项失败就抛错，调用方不得清除登录态。
 */
export async function synchronizeAllUserDataBeforeLogout(session: StoredAuthSession) {
  await Promise.all([
    synchronizePracticeFavoritesToLocal(),
    persistCurrentStatisticsForLogout()
  ])
  const range = readServerVocalRange(session)
  if (range) storeLocalVocalRange(range)
  storeLocalUserSnapshot(session.user)
}

function readServerVocalRange(session: StoredAuthSession): VocalRange | null {
  const range = {
    minimumMidi: session.user.preferred_range_min_midi,
    maximumMidi: session.user.preferred_range_max_midi
  }
  if (isVocalRange(range)) return range
  return vocalRangeFromLegacyVoice(session.user.preferred_voice_preset)
}

function isStoredUser(value: unknown): value is StoredAuthSession['user'] {
  return Boolean(value && typeof value === 'object' && 'id' in value)
}
