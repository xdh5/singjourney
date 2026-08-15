import { requestJson } from '../../utils/http/client'

type DailyPracticeMessageResponse = {
  id: number
  date: string
  content: string
}

export async function fetchDailyPracticeMessage() {
  const response = await requestJson<DailyPracticeMessageResponse>('/practice/daily-message')
  return response.content
}
