import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import webRelease from './targets/web/package.json'
import appRelease from './targets/app/package.json'
import wxRelease from './targets/wx/package.json'

const releaseTarget =
  process.env.VITE_RELEASE_COMPONENT || process.env.UNI_PLATFORM || 'development'
const releaseVersion =
  releaseTarget === 'web' || releaseTarget === 'h5'
    ? webRelease.version
    : releaseTarget === 'wx' || releaseTarget === 'mp-weixin'
      ? wxRelease.version
      : releaseTarget === 'app' || releaseTarget === 'app-plus' || releaseTarget === 'app-harmony'
        ? appRelease.version
        : '0.0.0-dev'

export default defineConfig({
  define: {
    'import.meta.env.VITE_RELEASE_VERSION': JSON.stringify(releaseVersion)
  },
  plugins: [uni()]
})
