import { createApp } from 'vue'
import './style.css'
import './features/family/theme.css'
// 💡 修复：全局引入图标库
import '@phosphor-icons/web/regular'
import '@phosphor-icons/web/fill'
import App from './App.vue'
import router from './router'
import { modalFocus } from './features/family/focus.js'

const app = createApp(App)
app.use(router)
app.directive('modal-focus',modalFocus)
app.mount('#app')
