import { getCurrentWindow } from '@tauri-apps/api/window'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WindowTitleBar from '@/app/components/window/WindowTitleBar.vue'

const windowControls = vi.hoisted(() => ({
  close: vi.fn(),
  isMaximized: vi.fn(),
  minimize: vi.fn(),
  onResized: vi.fn(),
  startDragging: vi.fn(),
  toggleMaximize: vi.fn(),
}))

describe('windowTitleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.classList.remove('muon-window-maximized')
    windowControls.isMaximized.mockResolvedValue(false)
    windowControls.onResized.mockResolvedValue(vi.fn())
    vi.mocked(getCurrentWindow).mockReturnValue(windowControls as never)
  })

  it('renders a compact custom title bar with accessible window controls', () => {
    const wrapper = mount(WindowTitleBar)

    expect(wrapper.get('[data-testid="window-titlebar"]').text()).toContain('Muon')
    expect(wrapper.get('[data-testid="window-minimize"]').attributes('aria-label')).toBe('最小化窗口')
    expect(wrapper.get('[data-testid="window-maximize"]').attributes('aria-label')).toBe('最大化窗口')
    expect(wrapper.get('[data-testid="window-close"]').attributes('aria-label')).toBe('关闭窗口')
  })

  it('delegates control button clicks to the current Tauri window', async () => {
    const wrapper = mount(WindowTitleBar)

    await wrapper.get('[data-testid="window-minimize"]').trigger('click')
    await wrapper.get('[data-testid="window-maximize"]').trigger('click')
    await wrapper.get('[data-testid="window-close"]').trigger('click')

    expect(windowControls.minimize).toHaveBeenCalledTimes(1)
    expect(windowControls.toggleMaximize).toHaveBeenCalledTimes(1)
    expect(windowControls.close).toHaveBeenCalledTimes(1)
  })

  it('marks the title region as draggable and supports double-click maximize', async () => {
    const wrapper = mount(WindowTitleBar)
    const dragRegion = wrapper.get('[data-testid="window-titlebar-drag-region"]')

    expect(dragRegion.attributes()).toHaveProperty('data-tauri-drag-region')

    await dragRegion.trigger('dblclick')

    expect(windowControls.toggleMaximize).toHaveBeenCalledTimes(1)
  })

  it('uses the restore label when the window is maximized', async () => {
    windowControls.isMaximized.mockResolvedValue(true)

    const wrapper = mount(WindowTitleBar)
    await flushPromises()

    expect(wrapper.get('[data-testid="window-maximize"]').attributes('aria-label')).toBe('还原窗口')
    expect(document.documentElement.classList.contains('muon-window-maximized')).toBe(true)
  })
})
