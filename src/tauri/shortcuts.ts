import { useMagicKeys, whenever } from '@vueuse/core'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const globalSearchVisible = ref(false)

export function useShortcuts() {
  const router = useRouter()
  const keys = useMagicKeys()

  whenever(keys['Meta+k']!, () => {
    globalSearchVisible.value = !globalSearchVisible.value
  })

  whenever(keys['Ctrl+k']!, () => {
    globalSearchVisible.value = !globalSearchVisible.value
  })

  whenever(keys['Meta+,']!, () => {
    router.push('/settings')
  })

  whenever(keys['Ctrl+,']!, () => {
    router.push('/settings')
  })

  return { globalSearchVisible }
}
