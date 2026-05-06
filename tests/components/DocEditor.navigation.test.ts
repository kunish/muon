import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import DocEditor from '@/features/docs/components/editor/DocEditor.vue'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/features/docs/composables/useDocSync', async () => {
  const { shallowRef } = await import('vue')
  const { Doc } = await import('yjs')
  return {
    useDocSync: () => ({
      ydoc: shallowRef(new Doc()),
      provider: shallowRef(null),
      connected: shallowRef(true),
      error: shallowRef(null),
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  }
})

vi.mock('@/features/docs/composables/useDocEditor', async () => {
  const { shallowRef } = await import('vue')
  return {
    useDocEditor: () => ({ editor: shallowRef(null) }),
  }
})

vi.mock('@/features/docs/composables/useDocCursor', () => ({
  useDocCursor: () => ({ others: [] }),
}))

vi.mock('@/features/docs/composables/useDocComments', async () => {
  const { shallowRef } = await import('vue')
  return {
    useDocComments: () => ({
      comments: shallowRef([]),
      draftText: shallowRef(''),
      addComment: vi.fn(),
      resolveComment: vi.fn(),
    }),
  }
})

const EmptyStub = defineComponent({ template: '<div />' })

describe('docEditor navigation', () => {
  it('returns to the document list from the editor toolbar', async () => {
    routerPush.mockReset()
    const wrapper = mount(DocEditor, {
      props: { docId: '!doc:localhost' },
      global: {
        stubs: {
          CollaboratorAvatars: EmptyStub,
          CommentsPanel: EmptyStub,
          DocEditorToolbar: EmptyStub,
          DocTitleInput: EmptyStub,
        },
      },
    })

    await wrapper.get('[data-testid="doc-editor-back"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/docs')
  })
})
