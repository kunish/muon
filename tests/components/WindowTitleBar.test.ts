import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WindowTitleBar from '@/app/components/window/WindowTitleBar.vue'
import { currentMonitor, getCurrentWindow, getDesktopPlatform } from '@/electron/window'

const windowControls = vi.hoisted(() => ({
  close: vi.fn(),
  isFocused: vi.fn(),
  isMaximized: vi.fn(),
  maximize: vi.fn(),
  minimize: vi.fn(),
  onBlurred: vi.fn(),
  onFocused: vi.fn(),
  onMoved: vi.fn(),
  onResized: vi.fn(),
  outerPosition: vi.fn(),
  outerSize: vi.fn(),
  setPosition: vi.fn(),
  setSize: vi.fn(),
  unmaximize: vi.fn(),
}))

const workAreaMonitor = {
  name: 'Built-in Display',
  position: { x: 0, y: 0 },
  scaleFactor: 2,
  size: { height: 1800, width: 2880 },
  workArea: {
    position: { x: 0, y: 50 },
    size: { height: 1650, width: 2880 },
  },
}

describe('windowTitleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.classList.remove('muon-window-maximized')
    document.documentElement.classList.remove('muon-window-flush-frame')
    vi.mocked(currentMonitor).mockResolvedValue(null)
    vi.mocked(getDesktopPlatform).mockReturnValue(undefined)
    windowControls.isFocused.mockResolvedValue(true)
    windowControls.isMaximized.mockResolvedValue(false)
    windowControls.maximize.mockResolvedValue(undefined)
    windowControls.onBlurred.mockResolvedValue(vi.fn())
    windowControls.onFocused.mockResolvedValue(vi.fn())
    windowControls.outerPosition.mockResolvedValue({ x: 0, y: 0 })
    windowControls.outerSize.mockResolvedValue({ height: 768, width: 1024 })
    windowControls.onMoved.mockResolvedValue(vi.fn())
    windowControls.onResized.mockResolvedValue(vi.fn())
    windowControls.setPosition.mockResolvedValue(undefined)
    windowControls.setSize.mockResolvedValue(undefined)
    windowControls.unmaximize.mockResolvedValue(undefined)
    vi.mocked(getCurrentWindow).mockReturnValue(windowControls as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a compact custom title bar with accessible window controls', () => {
    const wrapper = mount(WindowTitleBar)

    expect(wrapper.get('[data-testid="window-titlebar"]').text()).toContain('Muon')
    expect(wrapper.get('[data-testid="window-minimize"]').attributes('aria-label')).toBe('最小化窗口')
    expect(wrapper.get('[data-testid="window-maximize"]').attributes('aria-label')).toBe('最大化窗口')
    expect(wrapper.get('[data-testid="window-close"]').attributes('aria-label')).toBe('关闭窗口')
  })

  it('renders the Muon logo in the custom title bar brand', () => {
    const wrapper = mount(WindowTitleBar)
    const logo = wrapper.get('[data-testid="window-titlebar-logo"]')

    expect(logo.attributes('alt')).toBe('Muon')
    expect(logo.attributes('src')).toContain('muon-logo')
  })

  it('uses the Electron platform for macOS title bar controls', () => {
    vi.mocked(getDesktopPlatform).mockReturnValue('darwin')

    const wrapper = mount(WindowTitleBar)

    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).toContain('window-titlebar--mac')
    expect(wrapper.get('[data-testid="window-close"]').classes()).toContain('window-titlebar__control--close-dot')
  })

  it('keeps macOS title bar controls when the platform is reported with a mac alias', () => {
    vi.mocked(getDesktopPlatform).mockReturnValue('macos')

    const wrapper = mount(WindowTitleBar)

    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).toContain('window-titlebar--mac')
    expect(wrapper.get('[data-testid="window-maximize"]').classes()).toContain('window-titlebar__control--maximize-dot')
  })

  it('delegates control button clicks to the current Electron window', async () => {
    const wrapper = mount(WindowTitleBar)

    vi.mocked(currentMonitor).mockResolvedValue(workAreaMonitor as never)
    await wrapper.get('[data-testid="window-minimize"]').trigger('click')
    await wrapper.get('[data-testid="window-maximize"]').trigger('click')
    await wrapper.get('[data-testid="window-close"]').trigger('click')

    expect(windowControls.minimize).toHaveBeenCalledTimes(1)
    expect(windowControls.setPosition).toHaveBeenCalledTimes(1)
    expect(windowControls.setSize).toHaveBeenCalledTimes(1)
    expect(windowControls.close).toHaveBeenCalledTimes(1)
  })

  it('delegates macOS traffic light clicks to the current Electron window', async () => {
    vi.mocked(getDesktopPlatform).mockReturnValue('darwin')
    vi.mocked(currentMonitor).mockResolvedValue(workAreaMonitor as never)

    const wrapper = mount(WindowTitleBar)

    await wrapper.get('[data-testid="window-close"]').trigger('click')
    await wrapper.get('[data-testid="window-minimize"]').trigger('click')
    await wrapper.get('[data-testid="window-maximize"]').trigger('click')
    await flushPromises()

    expect(windowControls.close).toHaveBeenCalledTimes(1)
    expect(windowControls.minimize).toHaveBeenCalledTimes(1)
    expect(windowControls.setPosition).toHaveBeenCalledTimes(1)
    expect(windowControls.setSize).toHaveBeenCalledTimes(1)
  })

  it('marks the title region as draggable and expands to the current work area on double-click', async () => {
    const wrapper = mount(WindowTitleBar)
    const dragRegion = wrapper.get('[data-testid="window-titlebar-drag-region"]')

    expect(dragRegion.attributes()).toHaveProperty('data-electron-drag-region')

    vi.mocked(currentMonitor).mockResolvedValue(workAreaMonitor as never)
    windowControls.outerPosition.mockResolvedValue({ x: 360, y: 180 })
    windowControls.outerSize.mockResolvedValue({ height: 900, width: 1024 })

    await dragRegion.trigger('dblclick')
    await flushPromises()

    expect(windowControls.setPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 0, y: 50 }))
    expect(windowControls.setSize).toHaveBeenCalledWith(expect.objectContaining({ height: 1650, width: 2880 }))
    expect(document.documentElement.classList.contains('muon-window-flush-frame')).toBe(true)
  })

  it('uses the restore label when the window is maximized', async () => {
    windowControls.isMaximized.mockResolvedValue(true)

    const wrapper = mount(WindowTitleBar)
    await flushPromises()

    expect(wrapper.get('[data-testid="window-maximize"]').attributes('aria-label')).toBe('还原窗口')
    expect(document.documentElement.classList.contains('muon-window-maximized')).toBe(false)
    expect(document.documentElement.classList.contains('muon-window-flush-frame')).toBe(false)
  })

  it('reflects the Electron window focus state in the title bar', async () => {
    let focusedHandler: (() => void) | undefined
    let blurredHandler: (() => void) | undefined

    windowControls.onFocused.mockImplementation(async (handler: () => void) => {
      focusedHandler = handler
      return vi.fn()
    })
    windowControls.onBlurred.mockImplementation(async (handler: () => void) => {
      blurredHandler = handler
      return vi.fn()
    })

    const wrapper = mount(WindowTitleBar)
    await flushPromises()

    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).not.toContain('window-titlebar--inactive')

    blurredHandler?.()
    await flushPromises()

    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).toContain('window-titlebar--inactive')

    focusedHandler?.()
    await flushPromises()

    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).not.toContain('window-titlebar--inactive')
  })

  it('removes rounded frame styling when a native snap fills the monitor height', async () => {
    vi.mocked(currentMonitor).mockResolvedValue(workAreaMonitor as never)
    windowControls.outerPosition.mockResolvedValue({ x: 0, y: 50 })
    windowControls.outerSize.mockResolvedValue({ height: 1650, width: 1440 })

    mount(WindowTitleBar)
    await flushPromises()

    expect(windowControls.outerPosition).toHaveBeenCalled()
    expect(windowControls.outerSize).toHaveBeenCalled()
    expect(document.documentElement.classList.contains('muon-window-maximized')).toBe(false)
    expect(document.documentElement.classList.contains('muon-window-flush-frame')).toBe(true)
  })

  it('keeps the rounded frame when Electron reports maximized but the window is not work-area height', async () => {
    windowControls.isMaximized.mockResolvedValue(true)
    vi.mocked(currentMonitor).mockResolvedValue(workAreaMonitor as never)
    windowControls.outerPosition.mockResolvedValue({ x: 0, y: 120 })
    windowControls.outerSize.mockResolvedValue({ height: 1200, width: 2880 })

    const wrapper = mount(WindowTitleBar)
    await flushPromises()

    expect(wrapper.get('[data-testid="window-maximize"]').attributes('aria-label')).toBe('还原窗口')
    expect(document.documentElement.classList.contains('muon-window-maximized')).toBe(false)
    expect(document.documentElement.classList.contains('muon-window-flush-frame')).toBe(false)
  })

  it('restores the saved bounds after custom work-area expansion', async () => {
    vi.mocked(currentMonitor).mockResolvedValue(workAreaMonitor as never)
    windowControls.outerPosition.mockResolvedValue({ x: 360, y: 180 })
    windowControls.outerSize.mockResolvedValue({ height: 900, width: 1024 })

    const wrapper = mount(WindowTitleBar)
    await flushPromises()

    await wrapper.get('[data-testid="window-maximize"]').trigger('click')
    await flushPromises()

    windowControls.setPosition.mockClear()
    windowControls.setSize.mockClear()

    await wrapper.get('[data-testid="window-maximize"]').trigger('click')
    await flushPromises()

    expect(windowControls.setPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 360, y: 180 }))
    expect(windowControls.setSize).toHaveBeenCalledWith(expect.objectContaining({ height: 900, width: 1024 }))
  })

  it('refreshes snapped frame styling after window movement settles', async () => {
    vi.useFakeTimers()

    let movedHandler: (() => void) | undefined
    vi.mocked(currentMonitor).mockResolvedValue(workAreaMonitor as never)
    windowControls.onMoved.mockImplementation(async (handler: () => void) => {
      movedHandler = handler
      return vi.fn()
    })
    windowControls.outerPosition.mockResolvedValueOnce({ x: 360, y: 180 })
    windowControls.outerSize.mockResolvedValueOnce({ height: 900, width: 1024 })

    mount(WindowTitleBar)
    await flushPromises()

    expect(document.documentElement.classList.contains('muon-window-flush-frame')).toBe(false)

    windowControls.outerPosition.mockResolvedValue({ x: 0, y: 50 })
    windowControls.outerSize.mockResolvedValue({ height: 1650, width: 1440 })
    windowControls.outerPosition.mockClear()
    windowControls.outerSize.mockClear()

    movedHandler?.()
    await flushPromises()

    expect(windowControls.outerPosition).not.toHaveBeenCalled()
    expect(windowControls.outerSize).not.toHaveBeenCalled()
    expect(document.documentElement.classList.contains('muon-window-flush-frame')).toBe(false)

    await vi.advanceTimersByTimeAsync(180)
    await flushPromises()

    expect(document.documentElement.classList.contains('muon-window-flush-frame')).toBe(true)
  })
})
