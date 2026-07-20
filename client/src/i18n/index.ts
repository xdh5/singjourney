import { createI18n } from 'vue-i18n'
import en from '../locale/en.json'
import zhHans from '../locale/zh-Hans.json'

export type SupportedLocale = 'en' | 'zh-Hans'

const DEFAULT_LOCALE: SupportedLocale = 'en'
const CHINESE_LANGUAGE_PREFIX = 'zh'

function detectSystemLocale(): SupportedLocale {
  const systemLanguage = uni.getSystemInfoSync().language || ''
  return systemLanguage.toLowerCase().startsWith(CHINESE_LANGUAGE_PREFIX) ? 'zh-Hans' : DEFAULT_LOCALE
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
