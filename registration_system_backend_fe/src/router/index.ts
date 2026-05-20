import { createRouter, createWebHistory } from 'vue-router'
import { getToken, isSuperAdmin } from '@/utils/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/components/Layout.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/Dashboard.vue'),
          meta: { title: '仪表盘' },
        },
        {
          path: 'teams',
          name: 'teams',
          component: () => import('@/views/teams/TeamList.vue'),
          meta: { title: '球队管理' },
        },
        {
          path: 'teams/:id',
          name: 'team-detail',
          component: () => import('@/views/teams/TeamDetail.vue'),
          meta: { title: '球队详情' },
        },
        {
          path: 'activities',
          name: 'activities',
          component: () => import('@/views/activities/ActivityList.vue'),
          meta: { title: '活动报名' },
        },
        {
          path: 'individual-registrations',
          name: 'individual-registrations',
          component: () => import('@/views/challenges/ChallengeList.vue'),
          meta: { title: '散人报名', challengeKind: 'individual' },
        },
        {
          path: 'challenges',
          name: 'challenges',
          component: () => import('@/views/challenges/ChallengeList.vue'),
          meta: { title: '约队管理' },
        },
        {
          path: 'challenges/:id',
          name: 'challenge-detail',
          component: () => import('@/views/challenges/ChallengeDetail.vue'),
          meta: { title: '约队详情' },
        },
        {
          path: 'activities/:id',
          name: 'activity-detail',
          component: () => import('@/views/activities/ActivityDetail.vue'),
          meta: { title: '活动详情' },
        },
        {
          path: 'billing',
          name: 'billing',
          component: () => import('@/views/billing/BillingList.vue'),
          meta: { title: '账单管理' },
        },
        {
          path: 'players',
          name: 'players',
          component: () => import('@/views/players/PlayerList.vue'),
          meta: { title: '球员管理' },
        },
        {
          path: 'admins',
          name: 'admins',
          component: () => import('@/views/admins/AdminList.vue'),
          meta: { title: '管理员管理', requireSuperAdmin: true },
        },
        {
          path: 'system/settings',
          name: 'system-settings',
          component: () => import('@/views/system/SystemSettings.vue'),
          meta: { title: '系统设置', requireSuperAdmin: true },
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
})

router.beforeEach((to, _from) => {
  document.title = `${to.meta.title || '管理后台'} - 球队管理后台`

  if (to.name === 'login') {
    if (getToken()) return { name: 'dashboard' }
    return true
  }

  if (!getToken()) return { name: 'login' }

  if (to.meta.requireSuperAdmin && !isSuperAdmin()) return { name: 'dashboard' }

  return true
})

export default router
