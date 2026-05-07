import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Radio, RadioGroup } from '../src/atoms/radio'

describe('Radio controlled / uncontrolled', () => {
  it('uncontrolled: clicking sets checked', async () => {
    const wrapper = mount({
      components: { RadioGroup, Radio },
      template: `
        <RadioGroup>
          <Radio value="a" data-testid="a" />
          <Radio value="b" data-testid="b" />
        </RadioGroup>
      `,
    })
    await wrapper.get('[data-testid="b"]').trigger('click')
    expect(wrapper.get('[data-testid="b"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="a"]').attributes('aria-checked')).toBe('false')
  })

  it('controlled: emits update:modelValue and waits for parent', async () => {
    const updates: string[] = []
    const wrapper = mount({
      components: { RadioGroup, Radio },
      data: () => ({ value: 'a' }),
      methods: { onUpdate(v: string) { updates.push(v) } },
      template: `
        <RadioGroup :model-value="value" @update:model-value="onUpdate">
          <Radio value="a" data-testid="a" />
          <Radio value="b" data-testid="b" />
        </RadioGroup>
      `,
    })
    await wrapper.get('[data-testid="b"]').trigger('click')
    expect(updates).toEqual(['b'])
    // local state still 'a' until parent updates
    expect(wrapper.get('[data-testid="a"]').attributes('aria-checked')).toBe('true')
  })
})
