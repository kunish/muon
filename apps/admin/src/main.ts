import { createApp } from 'vue'
import AdminApp from './AdminApp.vue'
import { getInstallStatus } from './api'
import { createAdminRouter, normalizeLegacyAdminHash } from './router'
import './main.css'

async function bootstrap() {
  const status = await getInstallStatus().catch(() => ({ installed: false }))
  normalizeLegacyAdminHash()

  const router = createAdminRouter()
  const app = createApp(AdminApp, { initialInstalled: status.installed })
  app.use(router)
  await router.isReady()
  app.mount('#app')
}

void bootstrap()
