import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { Doc } from 'yjs'
import DocTitleInput from '@/features/docs/components/editor/DocTitleInput.vue'

describe('docTitleInput', () => {
  it('initializes from document metadata and commits edits to Yjs plus metadata sync', async () => {
    const ydoc = new Doc()
    const wrapper = mount(DocTitleInput, {
      props: {
        ydoc,
        initialTitle: '新建协作文档',
      },
    })
    const input = wrapper.get('input')
    await nextTick()

    expect((input.element as HTMLInputElement).value).toBe('新建协作文档')
    expect(ydoc.getText('title').toString()).toBe('新建协作文档')

    await input.setValue('产品计划')
    await input.trigger('blur')

    expect(ydoc.getText('title').toString()).toBe('产品计划')
    expect(wrapper.emitted('updateTitle')?.[0]).toEqual(['产品计划'])
  })
})
