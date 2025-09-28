/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHROMA_URL: string
  readonly VITE_CHROMA_AUTH_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}