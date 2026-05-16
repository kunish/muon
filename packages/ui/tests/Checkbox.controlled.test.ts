import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Checkbox } from '../src/atoms/checkbox'

describe('checkbox controlled / uncontrolled', () => {
  it('uncontrolled: toggles on click', async () => {
    const wrapper = mount(Checkbox, { props: { defaultChecked: false } })
    expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('button').attributes('aria-checked')).toBe('true')
  })

  it('controlled: emits update:modelValue without flipping local state', async () => {
    const wrapper = mount(Checkbox, { props: { modelValue: false } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
  })

  it('renders indeterminate as horizontal bar (no question mark)', () => {
    const wrapper = mount(Checkbox, { props: { modelValue: 'indeterminate' } })
    expect(wrapper.find('[data-testid="checkbox-indeterminate"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('?')
  })
})
