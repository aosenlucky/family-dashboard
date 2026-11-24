import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import Life from '../views/Life.vue'

const routes = [
  { path: '/', redirect: '/life' },
  { path: '/life', component: Life },
  { path: '/life/coupons', component: () => import('../views/Coupons.vue') },
  { path: '/diary', component: () => import('../views/Diary.vue') },
  { path: '/travel', component: () => import('../views/Travel.vue') },
  { path: '/wealth', component: () => import('../views/Wealth.vue') },
  { path: '/gallery', component: () => import('../views/Gallery.vue') }
]

const positions = new Map();
const router = createRouter({
  history: import.meta.env.VITE_ROUTER_MODE === 'hash' ? createWebHashHistory() : createWebHistory(),
  routes,
  scrollBehavior(to,from,saved) { return saved || positions.get(to.fullPath) || {top:0}; }
})
router.beforeEach((to,from)=>{positions.set(from.fullPath,{top:window.scrollY});});
export default router;
