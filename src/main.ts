import { createApp } from 'vue'
import App from './App.vue'
import '@/style/init.scss'
import { registerComponents } from '@/components'

const app = createApp(App)

registerComponents(app)
app.mount('#app')
