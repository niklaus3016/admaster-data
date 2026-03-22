import { createRouter, createWebHistory } from 'vue-router';
import Login from '../pages/Login.vue';
import Home from '../pages/Home.vue';
import LotteryDetail from '../pages/LotteryDetail.vue';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  { path: '/', name: 'Home', component: Home, beforeEnter: (to, from, next) => { const empId = localStorage.getItem('empId'); if (!empId) { next('/login'); } else { next(); } }, },
  { path: '/lottery-detail', name: 'LotteryDetail', component: LotteryDetail, beforeEnter: (to, from, next) => { const empId = localStorage.getItem('empId'); if (!empId) { next('/login'); } else { next(); } }, },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
