import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import RichTextInput from '@/features/chat/components/RichTextInput.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  stopTyping: vi.fn(),
  startTyping: vi.fn(),
  sendTextMessage: vi.fn(),
  replyToMessage: vi.fn(),
  editMessage: vi.fn(),
  setContent: vi.fn(),
  insertContent: vi.fn(() => ({ run: vi.fn() })),
  getClient: vi.fn(() => ({
    getRoom: vi.fn(() => ({
      getMember: vi.fn(() => ({ name: 'Alice' })),
    })),
  })),
  editorText: '',
  editorHtml: '',
  onSubmit: undefined as undefined | ((html: string, text: string) => unknown),
  onPasteFiles: undefined as undefined | ((files: File[]) => unknown),
  onPasteMediaSources: undefined as undefined | ((sources: Array<{ index: number, src: string, name: string, kind: 'image' | 'video' | 'file' }>) => unknown),
  insertPendingMediaAttachment: vi.fn(),
  uploadFile: vi.fn(),
  uploadImage: vi.fn(),
  uploadVideo: vi.fn(),
  uploadMedia: vi.fn((file: File) => Promise.resolve(`mxc://server/${file.name}`)),
  downloadMedia: vi.fn(() => Promise.resolve(new Blob(['image'], { type: 'image/png' }))),
  extractImageMeta: vi.fn(() => Promise.resolve({ width: 640, height: 360 })),
  createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
  revokeObjectURL: vi.fn(),
  openImage: vi.fn(),
  openVideo: vi.fn(),
}))

vi.mock('@tiptap/vue-3', () => ({
  EditorContent: defineComponent({
    name: 'EditorContent',
    setup() {
      return () => h('div', { 'data-testid': 'editor-content' })
    },
  }),
}))

vi.mock('@muon/rich-text/editor', () => ({
  useRichTextEditor: (options: {
    onSubmit: (html: string, text: string) => unknown
    onPasteFiles?: (files: File[]) => unknown
    onPasteMediaSources?: (sources: Array<{ index: number, src: string, name: string, kind: 'image' | 'video' | 'file' }>) => unknown
  }) => {
    mocks.onSubmit = options.onSubmit
    mocks.onPasteFiles = options.onPasteFiles
    mocks.onPasteMediaSources = options.onPasteMediaSources
    return {
      editor: ref({
        getText: vi.fn(() => mocks.editorText),
        getHTML: vi.fn(() => mocks.editorHtml),
        isActive: vi.fn(() => false),
        chain: vi.fn(() => ({
          focus: vi.fn(() => ({
            insertContent: mocks.insertContent,
            toggleBold: vi.fn(() => ({ run: vi.fn() })),
            toggleItalic: vi.fn(() => ({ run: vi.fn() })),
            toggleStrike: vi.fn(() => ({ run: vi.fn() })),
            toggleCode: vi.fn(() => ({ run: vi.fn() })),
            toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
            toggleOrderedList: vi.fn(() => ({ run: vi.fn() })),
            toggleBlockquote: vi.fn(() => ({ run: vi.fn() })),
          })),
        })),
        commands: {
          setContent: mocks.setContent,
          focus: vi.fn(),
          scrollIntoView: vi.fn(),
        },
        on: vi.fn(),
        off: vi.fn(),
      }),
      clear: mocks.clear,
      insertEmoji: vi.fn(),
      insertPendingMediaAttachment: mocks.insertPendingMediaAttachment,
    }
  },
}))

vi.mock('@/features/chat/composables/useTyping', () => ({
  useTyping: () => ({
    startTyping: mocks.startTyping,
    stopTyping: mocks.stopTyping,
  }),
}))

vi.mock('@/features/chat/composables/useCurrentRoom', () => ({
  useCurrentRoom: () => ({ room: ref({ name: 'Room' }) }),
}))

vi.mock('@/features/chat/composables/useMediaUpload', () => ({
  useMediaUpload: () => ({
    uploading: ref(false),
    progress: ref(0),
    uploadImage: mocks.uploadImage,
    uploadVideo: mocks.uploadVideo,
    uploadFile: mocks.uploadFile,
  }),
}))

vi.mock('@/features/chat/composables/useMediaViewer', () => ({
  useMediaViewer: () => ({
    openImage: mocks.openImage,
    openVideo: mocks.openVideo,
  }),
}))

vi.mock('@/features/chat/composables/useMention', () => ({
  useMention: () => ({ filterMembers: vi.fn(() => []) }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('vue-sonner', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('@matrix/index', () => ({
  editMessage: mocks.editMessage,
  downloadMedia: mocks.downloadMedia,
  extractImageMeta: mocks.extractImageMeta,
  getClient: mocks.getClient,
  replyToMessage: mocks.replyToMessage,
  sendContactCard: vi.fn(),
  sendGifMessage: vi.fn(),
  sendImageStickerMessage: vi.fn(),
  sendLocationMessage: vi.fn(),
  sendAudioMessage: vi.fn(),
  sendStickerMessage: vi.fn(),
  sendTextMessage: mocks.sendTextMessage,
  uploadMedia: mocks.uploadMedia,
}))

function mountInput() {
  return mount(RichTextInput, {
    attachTo: document.body,
    global: {
      stubs: {
        AttachmentMenu: true,
        ContactCardPicker: true,
        ExpressionPicker: true,
        LocationPicker: true,
        MentionList: true,
        StickerPackManager: true,
        UploadProgress: true,
        // Do NOT stub Teleport/Transition here — reka-ui's DropdownMenu relies
        // on its portal to actually render the menu content into document.body.
      },
    },
  })
}

describe('richTextInput silent send', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.editorText = 'hi'
    mocks.editorHtml = '<p>hi</p>'
    mocks.onSubmit = undefined
  })

  it('threads silent: true when the silent-send menu item is clicked', async () => {
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    const wrapper = mountInput()
    await nextTick()

    // Expand the editor so the split-send button is rendered
    await wrapper.get('button[title="展开编辑器"]').trigger('click')
    await nextTick()

    // Open the split-send menu
    const trigger = wrapper.find('[data-testid="expanded-send-more-trigger"]')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    await nextTick()

    // DropdownMenuContent portals outside the wrapper root — query the document directly.
    const silentItem = document.querySelector('[data-testid="expanded-send-silent"]')
    expect(silentItem).not.toBeNull()
    silentItem!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()

    expect(mocks.sendTextMessage).toHaveBeenCalledTimes(1)
    const lastCall = mocks.sendTextMessage.mock.calls[0]!
    expect(lastCall[0]).toBe('!room:localhost')
    expect(lastCall[1]).toBe('hi')
    expect(lastCall[3]).toEqual({ silent: true })
  })

  it('passes no options when the regular send button is clicked', async () => {
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    const wrapper = mountInput()
    await nextTick()

    await wrapper.get('button[title="展开编辑器"]').trigger('click')
    await nextTick()

    await wrapper.find('[data-testid="expanded-send"]').trigger('click')
    await nextTick()

    expect(mocks.sendTextMessage).toHaveBeenCalledTimes(1)
    const lastCall = mocks.sendTextMessage.mock.calls[0]!
    // 4th arg is either undefined or { silent: false / undefined } — both acceptable.
    const opts = lastCall[3] as { silent?: boolean } | undefined
    expect(opts?.silent).not.toBe(true)
  })
})
