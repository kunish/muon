import { editMessage, replyToMessage, sendTextMessage } from '@matrix/index'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { toast } from 'vue-sonner'
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
  getClient: vi.fn(() => ({
    getRoom: vi.fn(() => ({
      getMember: vi.fn(() => ({ name: 'Alice' })),
    })),
  })),
  editorText: '',
  editorHtml: '',
  onSubmit: undefined as undefined | ((html: string, text: string) => unknown),
  onPasteFiles: undefined as undefined | ((files: File[]) => unknown),
  insertPendingMediaAttachment: vi.fn(),
  uploadFile: vi.fn(),
  uploadImage: vi.fn(),
  uploadVideo: vi.fn(),
  uploadMedia: vi.fn((file: File) => Promise.resolve(`mxc://server/${file.name}`)),
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

vi.mock('@/features/chat/composables/useEditor', () => ({
  useEditor: (options: {
    onSubmit: (html: string, text: string) => unknown
    onPasteFiles?: (files: File[]) => unknown
  }) => {
    mocks.onSubmit = options.onSubmit
    mocks.onPasteFiles = options.onPasteFiles
    return {
      editor: ref({
        getText: vi.fn(() => mocks.editorText),
        getHTML: vi.fn(() => mocks.editorHtml),
        isActive: vi.fn(() => false),
        chain: vi.fn(() => ({
          focus: vi.fn(() => ({
            insertContent: vi.fn(() => ({ run: vi.fn() })),
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
        },
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

function createEvent(eventId: string | undefined) {
  return {
    getId: () => eventId,
    getSender: () => '@alice:localhost',
    getContent: () => ({ body: 'Original message' }),
    getType: () => 'm.room.message',
  } as any
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function mountInput() {
  return mount(RichTextInput, {
    global: {
      stubs: {
        AttachmentMenu: true,
        ContactCardPicker: true,
        ExpressionPicker: true,
        LocationPicker: true,
        MentionList: true,
        StickerPackManager: true,
        UploadProgress: true,
        Teleport: true,
        Transition: true,
      },
    },
  })
}

describe('richTextInput send recovery', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: mocks.createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: mocks.revokeObjectURL,
    })
    mocks.editorText = ''
    mocks.editorHtml = ''
    mocks.onSubmit = undefined
    mocks.onPasteFiles = undefined
  })

  it('stages pasted media files and only uploads them when the composer is submitted', async () => {
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    const wrapper = mountInput()
    const imageFile = new File(['image'], 'pasted.png', { type: 'image/png' })
    const videoFile = new File(['video'], 'pasted.mp4', { type: 'video/mp4' })
    const otherFile = new File(['pdf'], 'pasted.pdf', { type: 'application/pdf' })

    expect(mocks.onPasteFiles).toBeTypeOf('function')
    await mocks.onPasteFiles?.([imageFile, videoFile, otherFile])
    await nextTick()

    expect(mocks.uploadImage).not.toHaveBeenCalled()
    expect(mocks.uploadVideo).not.toHaveBeenCalled()
    expect(mocks.uploadFile).not.toHaveBeenCalled()
    expect(mocks.insertPendingMediaAttachment).toHaveBeenCalledTimes(3)
    expect(mocks.createObjectURL).toHaveBeenCalledWith(imageFile)
    expect(mocks.createObjectURL).toHaveBeenCalledWith(videoFile)
    const editorContent = wrapper.get('[data-testid="editor-content"]')
    expect(editorContent.classes()).toContain('min-h-[80px]')
    expect(editorContent.classes()).toContain('[&_.tiptap]:whitespace-normal')
    expect(editorContent.classes()).not.toContain('max-h-[40px]')

    const pendingMediaHtml = mocks.insertPendingMediaAttachment.mock.calls
      .map(([id]) => `<div data-pending-media-id="${id}"></div>`)
      .join('')
    await mocks.onSubmit?.(pendingMediaHtml, '')

    expect(mocks.uploadMedia).toHaveBeenCalledWith(imageFile)
    expect(mocks.uploadMedia).toHaveBeenCalledWith(videoFile)
    expect(mocks.uploadMedia).toHaveBeenCalledWith(otherFile)
    expect(mocks.uploadImage).not.toHaveBeenCalled()
    expect(mocks.uploadVideo).not.toHaveBeenCalled()
    expect(mocks.uploadFile).not.toHaveBeenCalled()
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:pasted.png')
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:pasted.mp4')
  })

  it('sends rich text and staged media together from one composer submission', async () => {
    mocks.sendTextMessage.mockResolvedValueOnce('$text')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    mountInput()
    const imageFile = new File(['image'], 'mixed.png', { type: 'image/png' })
    mocks.editorText = 'Bold caption'
    mocks.editorHtml = '<p><strong>Bold caption</strong></p>'

    await mocks.onPasteFiles?.([imageFile])
    const insertedId = mocks.insertPendingMediaAttachment.mock.calls[0]?.[0] as string
    await mocks.onSubmit?.(`<p><strong>Bold caption</strong></p><div data-pending-media-id="${insertedId}"></div>`, 'Bold caption')

    expect(mocks.uploadMedia).toHaveBeenCalledWith(imageFile)
    expect(mocks.extractImageMeta).toHaveBeenCalledWith(imageFile)
    expect(mocks.uploadImage).not.toHaveBeenCalled()
    expect(sendTextMessage).toHaveBeenCalledWith(
      '!room:localhost',
      'Bold caption\n[mixed.png]',
      '<p><strong>Bold caption</strong></p><p><img src="mxc://server/mixed.png" alt="mixed.png" title="mixed.png" data-width="640" data-height="360"></p>',
    )
  })

  it('keeps editor and typing state when text send fails', async () => {
    mocks.sendTextMessage.mockRejectedValueOnce(new Error('send failed'))
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    mocks.editorText = 'Hello'
    mocks.editorHtml = '<p>Hello</p>'
    mountInput()

    await mocks.onSubmit?.('<p>Hello</p>', 'Hello')

    expect(sendTextMessage).toHaveBeenCalledWith('!room:localhost', 'Hello', '<p>Hello</p>')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('clears editor and typing state after successful text send', async () => {
    mocks.sendTextMessage.mockResolvedValueOnce('$event-success')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    mocks.editorText = 'Hello'
    mocks.editorHtml = '<p>Hello</p>'
    mountInput()

    await mocks.onSubmit?.('<p>Hello</p>', 'Hello')

    expect(sendTextMessage).toHaveBeenCalledWith('!room:localhost', 'Hello', '<p>Hello</p>')
    expect(mocks.clear).toHaveBeenCalledTimes(1)
    expect(mocks.stopTyping).toHaveBeenCalledTimes(1)
    expect(store.replyingTo).toBeNull()
    expect(store.editingEvent).toBeNull()
  })

  it('clears editor, compose state, and typing state after successful reply', async () => {
    mocks.replyToMessage.mockResolvedValueOnce('$reply')
    const replyEvent = createEvent('$event-1')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setReplyingTo(replyEvent)
    mocks.editorText = 'Reply'
    mocks.editorHtml = '<p>Reply</p>'
    mountInput()

    await mocks.onSubmit?.('<p>Reply</p>', 'Reply')

    expect(replyToMessage).toHaveBeenCalledWith('!room:localhost', '$event-1', 'Reply', '<p>Reply</p>')
    expect(mocks.clear).toHaveBeenCalledTimes(1)
    expect(store.replyingTo).toBeNull()
    expect(store.editingEvent).toBeNull()
    expect(mocks.stopTyping).toHaveBeenCalledTimes(1)
  })

  it('keeps reply context when reply send fails', async () => {
    mocks.replyToMessage.mockRejectedValueOnce(new Error('reply failed'))
    const replyEvent = createEvent('$event-2')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setReplyingTo(replyEvent)
    mocks.editorText = 'Retry reply'
    mocks.editorHtml = '<p>Retry reply</p>'
    mountInput()

    await mocks.onSubmit?.('<p>Retry reply</p>', 'Retry reply')

    expect(replyToMessage).toHaveBeenCalledWith('!room:localhost', '$event-2', 'Retry reply', '<p>Retry reply</p>')
    expect(store.replyingTo?.getId()).toBe('$event-2')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('does not clear new editor content when a pending text send resolves', async () => {
    const pendingSend = deferred<string>()
    mocks.sendTextMessage.mockReturnValueOnce(pendingSend.promise)
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    mocks.editorText = 'Original'
    mocks.editorHtml = '<p>Original</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Original</p>', 'Original') as Promise<void>
    mocks.editorText = 'New draft'
    mocks.editorHtml = '<p>New draft</p>'
    pendingSend.resolve('$event-3')
    await submitPromise

    expect(sendTextMessage).toHaveBeenCalledWith('!room:localhost', 'Original', '<p>Original</p>')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('ignores a duplicate text submit while the first send is pending', async () => {
    const pendingSend = deferred<string>()
    mocks.sendTextMessage.mockReturnValueOnce(pendingSend.promise)
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    mocks.editorText = 'Hello'
    mocks.editorHtml = '<p>Hello</p>'
    mountInput()

    const firstSubmit = mocks.onSubmit?.('<p>Hello</p>', 'Hello') as Promise<void>
    const secondSubmit = mocks.onSubmit?.('<p>Hello</p>', 'Hello') as Promise<void>

    expect(sendTextMessage).toHaveBeenCalledTimes(1)

    pendingSend.resolve('$event-duplicate-guard')
    await firstSubmit
    await secondSubmit

    expect(sendTextMessage).toHaveBeenCalledWith('!room:localhost', 'Hello', '<p>Hello</p>')
    expect(mocks.clear).toHaveBeenCalledTimes(1)
    expect(mocks.stopTyping).toHaveBeenCalledTimes(1)
  })

  it('does not clear a new reply context when a pending reply send resolves', async () => {
    const pendingReply = deferred<string>()
    mocks.replyToMessage.mockReturnValueOnce(pendingReply.promise)
    const firstReplyEvent = createEvent('$event-4')
    const secondReplyEvent = createEvent('$event-5')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setReplyingTo(firstReplyEvent)
    mocks.editorText = 'Reply one'
    mocks.editorHtml = '<p>Reply one</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Reply one</p>', 'Reply one') as Promise<void>
    store.setReplyingTo(secondReplyEvent)
    pendingReply.resolve('$reply-2')
    await submitPromise

    expect(replyToMessage).toHaveBeenCalledWith('!room:localhost', '$event-4', 'Reply one', '<p>Reply one</p>')
    expect(store.replyingTo?.getId()).toBe('$event-5')
  })

  it('keeps same reply context when editor content changes before pending reply resolves', async () => {
    const pendingReply = deferred<string>()
    mocks.replyToMessage.mockReturnValueOnce(pendingReply.promise)
    const replyEvent = createEvent('$event-6')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setReplyingTo(replyEvent)
    mocks.editorText = 'First reply'
    mocks.editorHtml = '<p>First reply</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>First reply</p>', 'First reply') as Promise<void>
    mocks.editorText = 'Second reply draft'
    mocks.editorHtml = '<p>Second reply draft</p>'
    pendingReply.resolve('$reply-3')
    await submitPromise

    expect(replyToMessage).toHaveBeenCalledWith('!room:localhost', '$event-6', 'First reply', '<p>First reply</p>')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
    expect(store.replyingTo?.getId()).toBe('$event-6')
  })

  it('does not clear when pending reply context changes but text stays the same', async () => {
    const pendingReply = deferred<string>()
    mocks.replyToMessage.mockReturnValueOnce(pendingReply.promise)
    const firstReplyEvent = createEvent('$event-7')
    const secondReplyEvent = createEvent('$event-8')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setReplyingTo(firstReplyEvent)
    mocks.editorText = 'Same reply'
    mocks.editorHtml = '<p>Same reply</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Same reply</p>', 'Same reply') as Promise<void>
    store.setReplyingTo(secondReplyEvent)
    pendingReply.resolve('$reply-4')
    await submitPromise

    expect(replyToMessage).toHaveBeenCalledWith('!room:localhost', '$event-7', 'Same reply', '<p>Same reply</p>')
    expect(store.replyingTo?.getId()).toBe('$event-8')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('does not clear when room changes before a pending text send resolves', async () => {
    const pendingSend = deferred<string>()
    mocks.sendTextMessage.mockReturnValueOnce(pendingSend.promise)
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    mocks.editorText = 'Same room text'
    mocks.editorHtml = '<p>Same room text</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Same room text</p>', 'Same room text') as Promise<void>
    store.setCurrentRoom('!other:localhost')
    await nextTick()
    mocks.clear.mockClear()
    mocks.stopTyping.mockClear()
    pendingSend.resolve('$event-9')
    await submitPromise

    expect(sendTextMessage).toHaveBeenCalledWith('!room:localhost', 'Same room text', '<p>Same room text</p>')
    expect(store.currentRoomId).toBe('!other:localhost')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('deletes submitted room draft after pending send succeeds from another room', async () => {
    const pendingSend = deferred<string>()
    mocks.sendTextMessage.mockReturnValueOnce(pendingSend.promise)
    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')
    mocks.editorText = 'Hello'
    mocks.editorHtml = '<p>Hello</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Hello</p>', 'Hello') as Promise<void>
    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    mocks.setContent.mockClear()
    pendingSend.resolve('$event-13')
    await submitPromise

    store.setCurrentRoom('!room-a:localhost')
    await nextTick()

    expect(sendTextMessage).toHaveBeenCalledWith('!room-a:localhost', 'Hello', '<p>Hello</p>')
    expect(mocks.setContent).not.toHaveBeenCalledWith('<p>Hello</p>')
  })

  it('does not delete a newer draft for the submitted room when old send succeeds', async () => {
    const pendingSend = deferred<string>()
    mocks.sendTextMessage.mockReturnValueOnce(pendingSend.promise)
    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')
    mocks.editorText = 'Hello'
    mocks.editorHtml = '<p>Hello</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Hello</p>', 'Hello') as Promise<void>
    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    store.setCurrentRoom('!room-a:localhost')
    await nextTick()
    mocks.editorText = 'Newer draft'
    mocks.editorHtml = '<p>Newer draft</p>'
    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    mocks.setContent.mockClear()

    pendingSend.resolve('$event-14')
    await submitPromise
    store.setCurrentRoom('!room-a:localhost')
    await nextTick()

    expect(sendTextMessage).toHaveBeenCalledWith('!room-a:localhost', 'Hello', '<p>Hello</p>')
    expect(mocks.setContent).toHaveBeenCalledWith('<p>Newer draft</p>')
    expect(mocks.setContent).not.toHaveBeenCalledWith('<p>Hello</p>')
  })

  it('does not delete a matching normal draft after reply succeeds', async () => {
    const pendingReply = deferred<string>()
    mocks.replyToMessage.mockReturnValueOnce(pendingReply.promise)
    const replyEvent = createEvent('$event-17')
    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')
    mocks.editorText = 'Saved draft'
    mocks.editorHtml = '<p>Saved draft</p>'
    mountInput()

    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    store.setCurrentRoom('!room-a:localhost')
    await nextTick()
    store.setReplyingTo(replyEvent)
    mocks.setContent.mockClear()

    const submitPromise = mocks.onSubmit?.('<p>Saved draft</p>', 'Saved draft') as Promise<void>
    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    mocks.setContent.mockClear()
    pendingReply.resolve('$reply-6')
    await submitPromise

    store.setCurrentRoom('!room-a:localhost')
    await nextTick()

    expect(replyToMessage).toHaveBeenCalledWith('!room-a:localhost', '$event-17', 'Saved draft', '<p>Saved draft</p>')
    expect(mocks.setContent).toHaveBeenCalledWith('<p>Saved draft</p>')
  })

  it('does not delete a matching normal draft after edit succeeds', async () => {
    const pendingEdit = deferred<string>()
    mocks.editMessage.mockReturnValueOnce(pendingEdit.promise)
    const editEvent = createEvent('$event-18')
    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')
    mocks.editorText = 'Saved draft'
    mocks.editorHtml = '<p>Saved draft</p>'
    mountInput()

    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    store.setCurrentRoom('!room-a:localhost')
    await nextTick()
    store.setEditingEvent(editEvent)
    mocks.setContent.mockClear()

    const submitPromise = mocks.onSubmit?.('<p>Saved draft</p>', 'Saved draft') as Promise<void>
    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    mocks.setContent.mockClear()
    pendingEdit.resolve('$edit-3')
    await submitPromise

    store.setCurrentRoom('!room-a:localhost')
    await nextTick()

    expect(editMessage).toHaveBeenCalledWith('!room-a:localhost', '$event-18', 'Saved draft', '<p>Saved draft</p>')
    expect(mocks.setContent).toHaveBeenCalledWith('<p>Saved draft</p>')
  })

  it('does not clear when editor html changes but text stays the same before pending send resolves', async () => {
    const pendingSend = deferred<string>()
    mocks.sendTextMessage.mockReturnValueOnce(pendingSend.promise)
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    mocks.editorText = 'Formatted text'
    mocks.editorHtml = '<p>Formatted text</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Formatted text</p>', 'Formatted text') as Promise<void>
    mocks.editorHtml = '<p><strong>Formatted text</strong></p>'
    pendingSend.resolve('$event-10')
    await submitPromise

    expect(sendTextMessage).toHaveBeenCalledWith('!room:localhost', 'Formatted text', '<p>Formatted text</p>')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('clears editor, compose state, and typing state after successful edit', async () => {
    mocks.editMessage.mockResolvedValueOnce('$edit')
    const editEvent = createEvent('$event-11')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setEditingEvent(editEvent)
    mocks.editorText = 'Edited message'
    mocks.editorHtml = '<p>Edited message</p>'
    mountInput()

    await mocks.onSubmit?.('<p>Edited message</p>', 'Edited message')

    expect(editMessage).toHaveBeenCalledWith('!room:localhost', '$event-11', 'Edited message', '<p>Edited message</p>')
    expect(mocks.clear).toHaveBeenCalledTimes(1)
    expect(store.editingEvent).toBeNull()
    expect(store.replyingTo).toBeNull()
    expect(mocks.stopTyping).toHaveBeenCalledTimes(1)
  })

  it('keeps edit context when edit send fails', async () => {
    mocks.editMessage.mockRejectedValueOnce(new Error('edit failed'))
    const editEvent = createEvent('$event-12')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setEditingEvent(editEvent)
    mocks.editorText = 'Retry edit'
    mocks.editorHtml = '<p>Retry edit</p>'
    mountInput()

    await mocks.onSubmit?.('<p>Retry edit</p>', 'Retry edit')

    expect(editMessage).toHaveBeenCalledWith('!room:localhost', '$event-12', 'Retry edit', '<p>Retry edit</p>')
    expect(store.editingEvent?.getId()).toBe('$event-12')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('keeps reply context when reply event id is missing', async () => {
    const replyEvent = createEvent(undefined)
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setReplyingTo(replyEvent)
    mocks.editorText = 'Reply without id'
    mocks.editorHtml = '<p>Reply without id</p>'
    mountInput()

    await mocks.onSubmit?.('<p>Reply without id</p>', 'Reply without id')

    expect(replyToMessage).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
    expect(store.replyingTo).toBeTruthy()
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('keeps edit context when edit event id is missing', async () => {
    const editEvent = createEvent(undefined)
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setEditingEvent(editEvent)
    mocks.editorText = 'Edit without id'
    mocks.editorHtml = '<p>Edit without id</p>'
    mountInput()

    await mocks.onSubmit?.('<p>Edit without id</p>', 'Edit without id')

    expect(editMessage).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
    expect(store.editingEvent).toBeTruthy()
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('does not clear when input event occurs before pending text send resolves', async () => {
    const pendingSend = deferred<string>()
    mocks.sendTextMessage.mockReturnValueOnce(pendingSend.promise)
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    mocks.editorText = 'Same text'
    mocks.editorHtml = '<p>Same text</p>'
    const wrapper = mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Same text</p>', 'Same text') as Promise<void>
    await wrapper.find('[class*="bg-input"]').trigger('input')
    pendingSend.resolve('$event-19')
    await submitPromise

    expect(sendTextMessage).toHaveBeenCalledWith('!room:localhost', 'Same text', '<p>Same text</p>')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('does not clear reselected same reply context when pending reply resolves', async () => {
    const pendingReply = deferred<string>()
    mocks.replyToMessage.mockReturnValueOnce(pendingReply.promise)
    const replyEvent = createEvent('$event-15')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setReplyingTo(replyEvent)
    mocks.editorText = 'Same reply again'
    mocks.editorHtml = '<p>Same reply again</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Same reply again</p>', 'Same reply again') as Promise<void>
    store.setReplyingTo(null)
    store.setReplyingTo(replyEvent)
    pendingReply.resolve('$reply-5')
    await submitPromise

    expect(replyToMessage).toHaveBeenCalledWith('!room:localhost', '$event-15', 'Same reply again', '<p>Same reply again</p>')
    expect(store.replyingTo?.getId()).toBe('$event-15')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })

  it('does not clear reselected same edit context when pending edit resolves', async () => {
    const pendingEdit = deferred<string>()
    mocks.editMessage.mockReturnValueOnce(pendingEdit.promise)
    const editEvent = createEvent('$event-16')
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setEditingEvent(editEvent)
    mocks.editorText = 'Same edit again'
    mocks.editorHtml = '<p>Same edit again</p>'
    mountInput()

    const submitPromise = mocks.onSubmit?.('<p>Same edit again</p>', 'Same edit again') as Promise<void>
    store.setEditingEvent(null)
    store.setEditingEvent(editEvent)
    pendingEdit.resolve('$edit-2')
    await submitPromise

    expect(editMessage).toHaveBeenCalledWith('!room:localhost', '$event-16', 'Same edit again', '<p>Same edit again</p>')
    expect(store.editingEvent?.getId()).toBe('$event-16')
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.stopTyping).not.toHaveBeenCalled()
  })
})
