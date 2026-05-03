import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RichTextInput from '@/features/chat/components/RichTextInput.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

const matrixMocks = vi.hoisted(() => ({
  sendTextMessage: vi.fn().mockResolvedValue('$event'),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@matrix/index', () => ({
  editMessage: vi.fn(),
  getClient: () => ({ getRoom: vi.fn(() => null) }),
  replyToMessage: vi.fn(),
  sendAudioMessage: vi.fn(),
  sendContactCard: vi.fn(),
  sendGifMessage: vi.fn(),
  sendImageStickerMessage: vi.fn(),
  sendLocationMessage: vi.fn(),
  sendStickerMessage: vi.fn(),
  sendTextMessage: matrixMocks.sendTextMessage,
}))

vi.mock('@/features/chat/composables/useCurrentRoom', async () => {
  const { shallowRef } = await import('vue')

  return {
    useCurrentRoom: () => ({
      room: shallowRef({ name: 'Muon' }),
    }),
  }
})

vi.mock('@muon/rich-text/editor', async () => {
  const { shallowRef } = await import('vue')

  return {
    useRichTextEditor: () => ({
      clear: vi.fn(),
      editor: shallowRef({
        getHTML: vi.fn(() => '<p>Hello body</p>'),
        getText: vi.fn(() => 'Hello body'),
        isActive: vi.fn(() => false),
      }),
      insertEmoji: vi.fn(),
    }),
  }
})

vi.mock('@/features/chat/composables/useFloatingPosition', () => ({
  getFloatingPosition: () => ({ left: '0px', top: '0px' }),
}))

vi.mock('@/features/chat/composables/useMediaUpload', async () => {
  const { shallowRef } = await import('vue')

  return {
    useMediaUpload: () => ({
      progress: shallowRef(0),
      uploadFile: vi.fn(),
      uploadImage: vi.fn(),
      uploading: shallowRef(false),
      uploadVideo: vi.fn(),
    }),
  }
})

vi.mock('@/features/chat/composables/useMention', () => ({
  useMention: () => ({
    filterMembers: vi.fn(() => []),
  }),
}))

vi.mock('@/features/chat/composables/useTyping', () => ({
  useTyping: () => ({
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
  }),
}))

describe('rich text input editor expansion', () => {
  it('gives the editor a visibly taller minimum height when expanded', async () => {
    const wrapper = mount(RichTextInput, {
      global: {
        stubs: {
          AttachmentMenu: { template: '<button type="button" data-testid="attachment-menu" />' },
          ContactCardPicker: true,
          EditorContent: {
            props: ['editor'],
            template: '<div data-testid="rich-editor" v-bind="$attrs" />',
          },
          ExpressionPicker: true,
          LocationPicker: true,
          MentionList: true,
          StickerPackManager: true,
          UploadProgress: true,
          VoiceRecorder: { template: '<button type="button" data-testid="voice-recorder" />' },
        },
      },
    })

    const editor = wrapper.get('[data-testid="rich-editor"]')
    expect(editor.classes()).toContain('overflow-hidden')
    expect(editor.classes()).toContain('min-h-[40px]')
    expect(editor.classes()).toContain('max-h-[40px]')
    expect(editor.classes()).toContain('[&_.tiptap]:min-h-[24px]')
    expect(editor.classes()).toContain('[&_.tiptap]:whitespace-nowrap')
    expect(editor.classes()).toContain('[&_.tiptap_p]:truncate')
    expect(editor.classes()).not.toContain('overflow-y-auto')

    await wrapper.get('button[title="展开编辑器"]').trigger('click')

    const expandedEditor = wrapper.get('[data-testid="rich-editor"]')
    expect(expandedEditor.classes()).toContain('overflow-y-auto')
    expect(expandedEditor.classes()).toContain('min-h-[320px]')
    expect(expandedEditor.classes()).toContain('max-h-[60vh]')
    expect(expandedEditor.classes()).toContain('[&_.tiptap]:min-h-[304px]')
    expect(expandedEditor.classes()).not.toContain('min-h-[40px]')
    expect(expandedEditor.classes()).not.toContain('[&_.tiptap]:min-h-[24px]')

    wrapper.unmount()
  })

  it('uses a Feishu-like post composer layout when expanded', async () => {
    const wrapper = mount(RichTextInput, {
      global: {
        stubs: {
          AttachmentMenu: {
            props: ['triggerIcon'],
            template: '<button type="button" data-testid="attachment-menu" :data-trigger-icon="triggerIcon" />',
          },
          ContactCardPicker: true,
          EditorContent: {
            props: ['editor'],
            template: '<div data-testid="rich-editor" v-bind="$attrs" />',
          },
          ExpressionPicker: true,
          LocationPicker: true,
          MentionList: true,
          ScreenshotButton: { template: '<button type="button" data-testid="screenshot-button" />' },
          StickerPackManager: true,
          UploadProgress: true,
          VoiceRecorder: { template: '<button type="button" data-testid="voice-recorder" />' },
        },
      },
    })

    expect(wrapper.find('[data-testid="expanded-composer"]').exists()).toBe(false)

    await wrapper.get('button[title="展开编辑器"]').trigger('click')

    expect(wrapper.find('[data-testid="compact-composer"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="expanded-composer"]').classes()).toContain('min-h-[420px]')
    expect(wrapper.get('[data-testid="expanded-format-toolbar"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="expanded-composer-title"]').attributes('placeholder')).toBe('无标题帖子')
    expect(wrapper.get('[data-testid="expanded-action-bar"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="screenshot-button"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="attachment-menu"]').attributes('data-trigger-icon')).toBe('image')
    expect(wrapper.get('[data-testid="expanded-send"]').attributes('title')).toBe('发送')

    wrapper.unmount()
  })

  it('sends the expanded post with its title from the send button', async () => {
    matrixMocks.sendTextMessage.mockClear()
    const wrapper = mount(RichTextInput, {
      global: {
        stubs: {
          AttachmentMenu: { template: '<button type="button" data-testid="attachment-menu" />' },
          ContactCardPicker: true,
          EditorContent: {
            props: ['editor'],
            template: '<div data-testid="rich-editor" v-bind="$attrs" />',
          },
          ExpressionPicker: true,
          LocationPicker: true,
          MentionList: true,
          ScreenshotButton: true,
          StickerPackManager: true,
          UploadProgress: true,
          VoiceRecorder: { template: '<button type="button" data-testid="voice-recorder" />' },
        },
      },
    })
    useChatStore().setCurrentRoom('!room:localhost')

    await wrapper.get('button[title="展开编辑器"]').trigger('click')
    await wrapper.get('[data-testid="expanded-composer-title"]').setValue('Release notes')
    await wrapper.get('[data-testid="expanded-send"]').trigger('click')

    expect(matrixMocks.sendTextMessage).toHaveBeenCalledWith(
      '!room:localhost',
      'Release notes\n\nHello body',
      '<p><strong>Release notes</strong></p><p>Hello body</p>',
    )

    wrapper.unmount()
  })
})
