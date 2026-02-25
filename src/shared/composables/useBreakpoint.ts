import { useMediaQuery } from '@vueuse/core'
import { computed } from 'vue'

export function useBreakpoint() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  const isDesktop = useMediaQuery('(min-width: 1025px)')

  const current = computed(() => {
    if (isMobile.value)
      return 'mobile' as const
    if (isTablet.value)
      return 'tablet' as const
    return 'desktop' as const
  })

  return { isMobile, isTablet, isDesktop, current }
}
