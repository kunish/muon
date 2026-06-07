import { fetchMediaBlobUrl } from '@matrix/media'
import { setAuthMediaResolver } from '@muon/ui/media'
import { toast } from 'vue-sonner'
import App from './App.vue'
import { setupPlugins } from './plugins'
import { i18n } from './plugins/i18n'
import './main.css'

setAuthMediaResolver(fetchMediaBlobUrl)

const app = createApp(App)
setupPlugins(app)

app.config.errorHandler = (err, _instance, info) => {
  console.error(`[Muon] Unhandled error (${info}):`, err)
  toast.error(i18n.global.t('common.unexpected_error'))
}

app.mount('#app')
