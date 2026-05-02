import { createApp } from 'vue'
import AdminApp from './AdminApp.vue'
import { getInstallStatus } from './api'
import '@muon/ui/styles.css'

async function bootstrap() {
  const status = await getInstallStatus().catch(() => ({ installed: false }))
  createApp(AdminApp, { initialInstalled: status.installed }).mount('#app')
}

void bootstrap()
