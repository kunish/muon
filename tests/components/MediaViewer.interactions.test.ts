import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import MediaViewer from '@/features/chat/components/MediaViewer.vue'
import { useMediaViewer } from '@/features/chat/composables/useMediaViewer'

vi.mock('@/electron/dialog', () => ({
  save: vi.fn(),
}))

vi.mock('@/electron/fs', () => ({
  writeFile: vi.fn(),
}))

vi.mock('@/electron/http', () => ({
  fetch: vi.fn(),
}))

function dispatchKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

function getViewerImage(): HTMLImageElement {
  const image = document.body.querySelector<HTMLImageElement>('[data-testid="media-viewer-image"]')
  expect(image).toBeTruthy()
  return image!
}

function getViewerStage(): HTMLElement {
  const stage = document.body.querySelector<HTMLElement>('[data-testid="media-viewer-stage"]')
  expect(stage).toBeTruthy()
  return stage!
}

const wrappers: ReturnType<typeof mount>[] = []

async function openMountedImage() {
  const wrapper = mount(MediaViewer, { attachTo: document.body })
  wrappers.push(wrapper)

  useMediaViewer().openImage('blob:image-preview')
  await nextTick()
}

describe('media viewer interactions', () => {
  beforeEach(() => {
    useMediaViewer().close()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    useMediaViewer().close()
    for (const wrapper of wrappers.splice(0)) {
      wrapper.unmount()
    }
    document.body.innerHTML = ''
  })

  it('handles image keyboard shortcuts even when the overlay is not focused', async () => {
    await openMountedImage()

    dispatchKey('+')
    await nextTick()
    expect(getViewerImage().style.transform).toContain('scale(1.25)')

    dispatchKey('r')
    await nextTick()
    expect(getViewerImage().style.transform).toContain('rotate(90deg)')

    dispatchKey('ArrowRight')
    dispatchKey('ArrowDown')
    await nextTick()
    expect(getViewerImage().style.transform).toContain('translate(40px, 40px)')

    dispatchKey('0')
    await nextTick()
    expect(getViewerImage().style.transform).toContain('translate(0px, 0px) scale(1) rotate(0deg)')

    dispatchKey('Escape')
    await nextTick()
    expect(document.body.querySelector('[data-testid="media-viewer-dialog"]')).toBeNull()
  })

  it('supports wheel zoom and pointer drag panning for images', async () => {
    await openMountedImage()
    const stage = getViewerStage()
    const image = getViewerImage()

    stage.dispatchEvent(new WheelEvent('wheel', { deltaY: -80, bubbles: true, cancelable: true }))
    await nextTick()
    expect(image.style.transform).toContain('scale(1.25)')

    image.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 20, bubbles: true }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 55, clientY: 70, bubbles: true }))
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    await nextTick()

    expect(image.style.transform).toContain('translate(45px, 50px)')

    image.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await nextTick()
    expect(image.style.transform).toContain('translate(0px, 0px) scale(1) rotate(0deg)')
  })
})
