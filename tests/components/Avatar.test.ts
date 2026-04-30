import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Avatar from '@/shared/components/ui/avatar/Avatar.vue'

describe('avatar', () => {
  it('uses custom dimensions as the visible avatar size', () => {
    const wrapper = mount(Avatar, {
      props: {
        src: 'https://example.com/avatar.png',
        alt: 'Tester',
        size: 'xs',
        class: 'h-7 w-7 ring-1 ring-border/30',
      },
    })

    const root = wrapper.get('span')
    const body = wrapper.findAll('span').at(1)

    expect(root.classes()).toEqual(expect.arrayContaining(['h-7', 'w-7']))
    expect(body?.classes()).toEqual(expect.arrayContaining(['h-full', 'w-full']))
    expect(body?.classes()).not.toEqual(expect.arrayContaining(['h-5', 'w-5']))
  })
})
