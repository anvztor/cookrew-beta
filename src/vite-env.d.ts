/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KREWAUTH_URL?: string
  readonly VITE_KREWHUB_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
