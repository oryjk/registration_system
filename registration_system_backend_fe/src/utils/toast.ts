import { ref } from 'vue'

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

const toasts = ref<ToastItem[]>([])
let nextId = 0

const DURATION = 3000

const add = (message: string, type: ToastItem['type']) => {
  const id = nextId++
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, DURATION)
}

export const toast = {
  success: (message: string) => add(message, 'success'),
  error: (message: string) => add(message, 'error'),
  warning: (message: string) => add(message, 'warning'),
  info: (message: string) => add(message, 'info'),
}

export const useToasts = () => toasts
