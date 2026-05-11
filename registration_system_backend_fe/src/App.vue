<template>
  <RouterView />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { getToken } from '@/utils/auth'

const adminStore = useAdminStore()

onMounted(async () => {
  // 有 token 时始终向后端验证并刷新用户信息
  // 保证页面刷新、直接输入 URL 等场景下用户信息始终正确
  if (getToken()) {
    await adminStore.initFromToken()
  }
})
</script>
