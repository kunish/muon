/// <reference types="vite/client" />
/// <reference types="unplugin-vue-router/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_MUON_API_BASE_URL?: string
  readonly VITE_MUON_MEDIA_UPLOAD_URL?: string
  /** 企业管理控制台（apps/admin）的访问地址，用于桌面端组织页外链直达 */
  readonly VITE_MUON_ADMIN_URL?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, any>
  export default component
}
