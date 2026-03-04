import { useStorage } from '@vueuse/core'

const enabled = useStorage('muon_watermark_enabled', false)

function createWatermarkCanvas(text: string): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const dpr = window.devicePixelRatio || 1

  canvas.width = 300 * dpr
  canvas.height = 200 * dpr
  ctx.scale(dpr, dpr)

  ctx.rotate((-45 * Math.PI) / 180)
  ctx.font = '14px sans-serif'
  ctx.fillStyle = 'rgba(128, 128, 128, 0.15)'
  ctx.textAlign = 'center'
  ctx.fillText(text, 60, 160)

  return canvas.toDataURL()
}

function applyWatermark(el: HTMLElement, text: string) {
  const dataUrl = createWatermarkCanvas(text)
  el.style.backgroundImage = `url(${dataUrl})`
  el.style.backgroundRepeat = 'repeat'
  el.style.backgroundSize = '300px 200px'
}

function removeWatermark(el: HTMLElement) {
  el.style.backgroundImage = ''
  el.style.backgroundRepeat = ''
  el.style.backgroundSize = ''
}

export function useWatermark() {
  function toggle() {
    enabled.value = !enabled.value
  }

  return { applyWatermark, removeWatermark, enabled, toggle }
}

/**
 * 创建 MutationObserver 防止水印被 DevTools 删除
 * 当水印元素被移除或属性被修改时自动恢复
 */
export function useWatermarkGuard(
  getContainer: () => HTMLElement | null,
  getOverlay: () => HTMLElement | null,
) {
  let observer: MutationObserver | null = null

  function startGuard(restoreFn: () => void) {
    const container = getContainer()
    if (!container)
      return

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // 水印节点被删除
        if (mutation.type === 'childList') {
          const overlay = getOverlay()
          if (overlay && !document.contains(overlay)) {
            restoreFn()
            break
          }
        }
        // 水印样式被修改
        if (mutation.type === 'attributes' && mutation.target === getOverlay()) {
          restoreFn()
          break
        }
      }
    })

    observer.observe(container, {
      childList: true,
      attributes: true,
      subtree: true,
    })
  }

  function stopGuard() {
    observer?.disconnect()
    observer = null
  }

  return { startGuard, stopGuard }
}
