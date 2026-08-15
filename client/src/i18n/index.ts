import { createI18n } from 'vue-i18n'
import en from '../locale/en.json'
import zhHans from '../locale/zh-Hans.json'

export type SupportedLocale = 'en' | 'zh-Hans'

const DEFAULT_LOCALE: SupportedLocale = 'zh-Hans'
const CHINESE_LANGUAGE_PREFIX = 'zh'
const ENGLISH_LANGUAGE_PREFIX = 'en'

export function resolveSupportedLocale(systemLanguage?: string | null): SupportedLocale {
  const normalizedLanguage = (systemLanguage || '').toLowerCase()
  if (normalizedLanguage.startsWith(CHINESE_LANGUAGE_PREFIX)) return 'zh-Hans'
  if (normalizedLanguage.startsWith(ENGLISH_LANGUAGE_PREFIX)) return 'en'
  return DEFAULT_LOCALE
}

function detectSystemLocale(): SupportedLocale {
  try {
    const appBaseInfo = uni.getAppBaseInfo?.() as { hostLanguage?: string } | undefined
    if (appBaseInfo?.hostLanguage) return resolveSupportedLocale(appBaseInfo.hostLanguage)
  } catch {
    // 部分旧运行环境不提供 hostLanguage，继续使用下方的应用语言。
  }
  return resolveSupportedLocale(uni.getLocale?.())
}

export const i18n = createI18n({
  legacy: false,
  locale: detectSystemLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, 'zh-Hans': zhHans }
})

export function setPageTitle(key: string) {
  uni.setNavigationBarTitle({ title: i18n.global.t(key) })
}
