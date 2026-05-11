import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAdminInfo, setAdminInfo, removeToken, type AdminInfo } from '@/utils/auth'
import { verifyToken } from '@/services/auth'

export const useAdminStore = defineStore('admin', () => {
  const adminInfo = ref<AdminInfo | null>(getAdminInfo())
  const initializing = ref(false)

  const isSuperAdmin = computed(() => adminInfo.value?.is_super_admin ?? false)
  const displayName = computed(() => adminInfo.value?.nickname || adminInfo.value?.username || '')
  const avatarLetter = computed(() => displayName.value.charAt(0).toUpperCase() || 'A')

  const setAdmin = (info: AdminInfo) => {
    adminInfo.value = info
    setAdminInfo(info)
  }

  const clearAdmin = () => {
    adminInfo.value = null
    removeToken()
  }

  /**
   * 启动时调用 verify 接口刷新用户信息
   * 如果 token 过期或无效，清除并跳转到登录页
   */
  const initFromToken = async () => {
    if (initializing.value) return
    initializing.value = true
    try {
      const res = await verifyToken()
      const info: AdminInfo = {
        id: res.admin.id,
        username: res.admin.username,
        nickname: res.admin.nickname,
        is_super_admin: res.admin.is_super_admin,
      }
      setAdmin(info)
    } catch {
      // token 无效，清除本地状态（request.ts 会处理跳转）
      clearAdmin()
    } finally {
      initializing.value = false
    }
  }

  return {
    adminInfo,
    initializing,
    isSuperAdmin,
    displayName,
    avatarLetter,
    setAdmin,
    clearAdmin,
    initFromToken,
  }
})
