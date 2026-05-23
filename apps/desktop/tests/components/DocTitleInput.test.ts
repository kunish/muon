import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs'
import DocTitleInput from '@/features/docs/components/editor/DocTitleInput.vue'

describe('docTitleInput', () => {
  it('displays document metadata without writing a duplicate title into Yjs', async () => {
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
    expect(ydoc.getText('title').toString()).toBe('')

    await input.setValue('产品计划')
    await input.trigger('blur')

    expect(ydoc.getText('title').toString()).toBe('产品计划')
    expect(wrapper.emitted('updateTitle')?.[0]).toEqual(['产品计划'])
  })

  it('does not duplicate a metadata title when the persisted Yjs title arrives later', async () => {
    const sourceDoc = new Doc()
    sourceDoc.getText('title').insert(0, '1111')
    const ydoc = new Doc()
    const wrapper = mount(DocTitleInput, {
      props: {
        ydoc,
        initialTitle: '1111',
      },
    })
    await nextTick()

    applyUpdate(ydoc, encodeStateAsUpdate(sourceDoc))
    await nextTick()

    expect(wrapper.get('input').element.value).toBe('1111')
    expect(ydoc.getText('title').toString()).toBe('1111')
  })
})
