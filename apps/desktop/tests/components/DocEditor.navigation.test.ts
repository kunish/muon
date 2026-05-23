import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import DocEditor from '@/features/docs/components/editor/DocEditor.vue'

const routerPush = vi.hoisted(() => vi.fn())
const mediaViewerOpenImage = vi.hoisted(() => vi.fn())
const docEditorMocks = vi.hoisted(() => ({
  addComment: vi.fn(),
  updateLocalCursor: vi.fn(),
  editor: {
    value: null as null | {
      state: {
        selection: {
          empty: boolean
          from: number
          to: number
        }
      }
      on?: ReturnType<typeof vi.fn>
      off?: ReturnType<typeof vi.fn>
    },
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/features/chat/composables/useMediaViewer', () => ({
  useMediaViewer: () => ({
    openImage: mediaViewerOpenImage,
  }),
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
    useDocEditor: () => ({ editor: shallowRef(docEditorMocks.editor.value) }),
  }
})

vi.mock('@/features/docs/composables/useDocCursor', () => ({
  useDocCursor: () => ({ others: [], updateLocalCursor: docEditorMocks.updateLocalCursor }),
}))

vi.mock('@/features/docs/composables/useDocComments', async () => {
  const { shallowRef } = await import('vue')
  return {
    useDocComments: () => ({
      comments: shallowRef([]),
      draftText: shallowRef(''),
      addComment: docEditorMocks.addComment,
      resolveComment: vi.fn(),
    }),
  }
})

const EmptyStub = defineComponent({ template: '<div />' })
const CommentsPanelStub = defineComponent({
  emits: ['addComment'],
  template:
    '<aside data-testid="doc-comments-panel"><button data-testid="doc-comments-add" @click="$emit(\'addComment\', \'评审意见\')" /></aside>',
})
const ShareDialogStub = defineComponent({ template: '<div data-testid="doc-share-dialog" />' })

function mountDocEditor() {
  return mount(DocEditor, {
    props: { docId: '!doc:localhost' },
    global: {
      stubs: {
        CollaboratorAvatars: EmptyStub,
        CommentsPanel: CommentsPanelStub,
        DocEditorToolbar: EmptyStub,
        DocTitleInput: EmptyStub,
        MediaViewer: EmptyStub,
        ShareDialog: ShareDialogStub,
      },
    },
  })
}

describe('docEditor navigation', () => {
  beforeEach(() => {
    docEditorMocks.addComment.mockReset()
    docEditorMocks.updateLocalCursor.mockReset()
    docEditorMocks.editor.value = null
  })

  it('returns to the document list from the editor toolbar', async () => {
    routerPush.mockReset()
    const wrapper = mountDocEditor()

    await wrapper.get('[data-testid="doc-editor-back"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/docs')
  })

  it('opens the collaboration panels from editor header actions', async () => {
    const wrapper = mountDocEditor()

    expect(wrapper.find('[data-testid="doc-comments-panel"]').exists()).toBe(false)
    await wrapper.get('[data-testid="doc-editor-comments"]').trigger('click')
    expect(wrapper.find('[data-testid="doc-comments-panel"]').exists()).toBe(true)

    expect(wrapper.find('[data-testid="doc-share-dialog"]').exists()).toBe(false)
    await wrapper.get('[data-testid="doc-editor-share"]').trigger('click')
    expect(wrapper.find('[data-testid="doc-share-dialog"]').exists()).toBe(true)
  })

  it('opens inserted document images in the media viewer', () => {
    mediaViewerOpenImage.mockReset()
    const wrapper = mountDocEditor()
    const body = wrapper.get('[data-testid="doc-editor-body"]')
    const image = document.createElement('img')
    image.src = 'data:image/png;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
    body.element.append(image)

    image.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(mediaViewerOpenImage).toHaveBeenCalledWith(image.src)
  })

  it('anchors new comments to the current editor selection', async () => {
    docEditorMocks.editor.value = {
      state: {
        selection: {
          empty: false,
          from: 18,
          to: 6,
        },
      },
    }
    const wrapper = mountDocEditor()

    await wrapper.get('[data-testid="doc-editor-comments"]').trigger('click')
    await wrapper.get('[data-testid="doc-comments-add"]').trigger('click')

    expect(docEditorMocks.addComment).toHaveBeenCalledWith('评审意见', { from: 6, to: 18 })
  })

  it('creates whole-document comments when there is no active editor selection', async () => {
    docEditorMocks.editor.value = {
      state: {
        selection: {
          empty: true,
          from: 6,
          to: 6,
        },
      },
    }
    const wrapper = mountDocEditor()

    await wrapper.get('[data-testid="doc-editor-comments"]').trigger('click')
    await wrapper.get('[data-testid="doc-comments-add"]').trigger('click')

    expect(docEditorMocks.addComment).toHaveBeenCalledWith('评审意见', undefined)
  })

  it('publishes the local collaborator cursor from editor selection updates', () => {
    const selectionHandlers: Array<() => void> = []
    docEditorMocks.editor.value = {
      state: {
        selection: {
          empty: false,
          from: 3,
          to: 9,
        },
      },
      on: vi.fn((eventName: string, handler: () => void) => {
        if (eventName === 'selectionUpdate') selectionHandlers.push(handler)
      }),
      off: vi.fn(),
    }

    mountDocEditor()

    expect(docEditorMocks.updateLocalCursor).toHaveBeenCalledWith(3, 9)
    docEditorMocks.updateLocalCursor.mockClear()
    docEditorMocks.editor.value.state.selection = {
      empty: false,
      from: 11,
      to: 14,
    }
    selectionHandlers[0]?.()

    expect(docEditorMocks.updateLocalCursor).toHaveBeenCalledWith(11, 14)
  })
})
