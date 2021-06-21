
import '@/style/init.scss'
import '@/components'
import Vue from 'vue'
import App from './App'
Vue.config.productionTip = false

window.vm = new Vue({
  el: '#app',
  render:h => h(App)
})
