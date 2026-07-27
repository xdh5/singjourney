/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELEASE_COMPONENT?: string
  readonly VITE_RELEASE_VERSION?: string
  readonly VITE_MINI_PROGRAM_VARIANT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
