export type ClientReleasePlatform = 'web' | 'wx' | 'ios' | 'android' | 'harmony' | 'development'

const DEVELOPMENT_VERSION = '0.0.0-dev'

export const CLIENT_RELEASE = Object.freeze({
  platform: (import.meta.env.VITE_RELEASE_COMPONENT || 'development') as ClientReleasePlatform,
  version: import.meta.env.VITE_RELEASE_VERSION || DEVELOPMENT_VERSION
})
