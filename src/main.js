import { createApp } from 'vue'
import './style.css'
// 💡 修复：全局引入图标库
import '@phosphor-icons/web/regular'
import '@phosphor-icons/web/fill'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
