import { requestAuthenticatedJson } from '../../utils/http/authentication'
import { apiStorageKey } from '../../utils/http/client'
import { mergeCollectionServerFirst } from '../account/sync-policy'

type PracticeFavoritesResponse = { exercise_ids: string[] }
const LOCAL_FAVORITE_IDS_KEY = apiStorageKey('practice.favorite-ids')

export async function fetchPracticeFavorites() {
  const response = await requestAuthenticatedJson<PracticeFavoritesResponse>('/practice/favorites')
  return response.exercise_ids
}

export function addPracticeFavorite(exerciseId: string) {
  return requestAuthenticatedJson<void>(`/practice/favorites/${encodeURIComponent(exerciseId)}`, 'PUT')
}

export function removePracticeFavorite(exerciseId: string) {
  return requestAuthenticatedJson<void>(
    `/practice/favorites/${encodeURIComponent(exerciseId)}`,
    'DELETE'
  )
}

export function readLocalPracticeFavoriteIds() {
  const value = uni.getStorageSync(LOCAL_FAVORITE_IDS_KEY)
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

export function writeLocalPracticeFavoriteIds(ids: string[]) {
  if (ids.length === 0) uni.removeStorageSync(LOCAL_FAVORITE_IDS_KEY)
  else uni.setStorageSync(LOCAL_FAVORITE_IDS_KEY, [...new Set(ids)])
}

export function clearLocalPracticeFavoriteIds() {
  uni.removeStorageSync(LOCAL_FAVORITE_IDS_KEY)
}

/** 登录时收藏取本地与线上并集，全部写入服务器成功后再清本地副本。 */
export async function synchronizePracticeFavoritesToServer() {
  const localIds = readLocalPracticeFavoriteIds()
  const serverIds = await fetchPracticeFavorites()
  const mergedIds = mergeCollectionServerFirst(localIds, serverIds, (id) => id)
  const serverIdSet = new Set(serverIds)
  for (const id of mergedIds) {
    if (!serverIdSet.has(id)) await addPracticeFavorite(id)
  }
  clearLocalPracticeFavoriteIds()
  return mergedIds
}

/** 退出时重新读取线上收藏，与尚未同步的本地收藏取并集后落回本地。 */
export async function synchronizePracticeFavoritesToLocal() {
  const localIds = readLocalPracticeFavoriteIds()
  const serverIds = await fetchPracticeFavorites()
  const mergedIds = mergeCollectionServerFirst(localIds, serverIds, (id) => id)
  writeLocalPracticeFavoriteIds(mergedIds)
  return mergedIds
}
