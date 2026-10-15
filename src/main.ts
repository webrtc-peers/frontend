import { createApp } from 'vue'
import App from './App.vue'
import '@/style/init.scss'
import { registerComponents } from '@/components'
import router from '@/router'

const app = createApp(App)

// iOS Safari 只有挂了 touchstart 监听才会给按钮加 :active，否则手机上没有按压回弹
document.addEventListener('touchstart', () => {}, { passive: true })

registerComponents(app)
app.use(router)
app.mount('#app')
