import { createRouter, createWebHistory } from 'vue-router'
import Life from '../views/Life.vue'

const routes = [
  { path: '/', redirect: '/life' },
  { path: '/life', component: Life },
  { path: '/travel', component: () => import('../views/Travel.vue') },
  { path: '/wealth', component: () => import('../views/Wealth.vue') },
  { path: '/gallery', component: () => import('../views/Gallery.vue') }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
