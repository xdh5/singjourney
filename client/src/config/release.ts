export type ClientReleasePlatform = 'wx'

const DEVELOPMENT_VERSION = '0.0.0-dev'

export const CLIENT_RELEASE = Object.freeze({
  platform: 'wx' as ClientReleasePlatform,
  version: import.meta.env.VITE_RELEASE_VERSION || DEVELOPMENT_VERSION
})
