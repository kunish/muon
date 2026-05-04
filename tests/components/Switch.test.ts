import { Switch } from '@muon/ui/switch'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

describe('ui switch', () => {
  it('maps checked to the Reka model value and emits update:checked', async () => {
    const wrapper = mount(Switch, {
      props: {
        checked: true,
      },
    })

    const button = wrapper.get('button[role="switch"]')
    expect(button.attributes('aria-checked')).toBe('true')

    await button.trigger('click')

    expect(wrapper.emitted('update:checked')?.[0]).toEqual([false])
  })
})
