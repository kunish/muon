import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Switch } from '../src/atoms/switch'

describe('switch controlled / uncontrolled', () => {
  it('uncontrolled: toggles internal state on click', async () => {
    const wrapper = mount(Switch, { props: { defaultChecked: false } })
    const btn = wrapper.find('button')
    expect(btn.attributes('aria-checked')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-checked')).toBe('true')
  })

  it('controlled: emits update:modelValue and respects parent state', async () => {
    const wrapper = mount(Switch, { props: { modelValue: false } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    // Without parent flipping the prop, aria-checked stays false
    expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.find('button').attributes('aria-checked')).toBe('true')
  })
})
