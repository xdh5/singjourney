import { requestAuthenticatedJson } from '../../utils/http/authentication'

type PracticeFavoritesResponse = { exercise_ids: string[] }

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
