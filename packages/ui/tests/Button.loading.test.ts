import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Button } from '../src/atoms/button'

describe('Button loading state', () => {
  it('renders a spinner in place of leading icon when loading=true', () => {
    const wrapper = mount(Button, {
      props: { loading: true, leadingIcon: 'check' },
      slots: { default: 'Submit' },
    })
    expect(wrapper.find('[data-testid="button-spinner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="button-leading-icon"]').exists()).toBe(false)
  })

  it('keeps the same width when toggling loading', async () => {
    const wrapper = mount(Button, {
      props: { loading: false, leadingIcon: 'check' },
      slots: { default: 'Submit' },
      attachTo: document.body,
    })
    const widthBefore = wrapper.element.getBoundingClientRect().width
    await wrapper.setProps({ loading: true })
    const widthAfter = wrapper.element.getBoundingClientRect().width
    expect(widthAfter).toBe(widthBefore)
    wrapper.unmount()
  })

  it('disables click when loading=true', async () => {
    let clicks = 0
    const wrapper = mount(Button, {
      props: { loading: true, onClick: () => { clicks += 1 } },
      slots: { default: 'Submit' },
    })
    await wrapper.trigger('click')
    expect(clicks).toBe(0)
  })
})
