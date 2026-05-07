import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { Kbd } from '../src/atoms/kbd'

describe('Kbd platform symbols', () => {
  it('renders Cmd as ⌘ on macOS', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    const wrapper = mount(Kbd, { props: { keys: ['Cmd', 'K'] } })
    expect(wrapper.text()).toContain('⌘')
    expect(wrapper.text()).toContain('K')
  })

  it('renders Cmd as Ctrl on non-macOS', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    const wrapper = mount(Kbd, { props: { keys: ['Cmd', 'K'] } })
    expect(wrapper.text()).toContain('Ctrl')
    expect(wrapper.text()).toContain('K')
  })

  it('maps Shift, Alt, Enter, Esc symbols on macOS', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    const wrapper = mount(Kbd, { props: { keys: ['Shift', 'Alt', 'Enter', 'Esc'] } })
    const text = wrapper.text()
    expect(text).toContain('⇧')
    expect(text).toContain('⌥')
    expect(text).toContain('⏎')
    expect(text).toContain('⎋')
  })
})
