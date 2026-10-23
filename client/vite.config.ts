import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import clientRelease from './package.json'

const releaseVersion = clientRelease.version

export default defineConfig({
  define: {
    'import.meta.env.VITE_RELEASE_VERSION': JSON.stringify(releaseVersion)
  },
  plugins: [uni()]
})
