import { createApp } from 'vue'
import { toast } from 'vue-sonner'
import App from './App.vue'
import { setupPlugins } from './plugins'
import './main.css'

const app = createApp(App)
setupPlugins(app)

app.config.errorHandler = (err, _instance, info) => {
  console.error(`[Muon] Unhandled error (${info}):`, err)
  toast.error('An unexpected error occurred')
}

app.mount('#app')
