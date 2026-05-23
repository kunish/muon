import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import DocsPage from '@/features/docs/components/DocsPage.vue'
import { useDocsStore } from '@/features/docs/stores/docsStore'

vi.mock('vue-sonner', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {},
    query: {},
    hash: '',
    fullPath: '/docs',
    path: '/docs',
    name: 'docs',
    matched: [],
    meta: {},
  }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/features/docs/components/DocsCreateButton.vue', () => ({
  default: defineComponent({
    name: 'DocsCreateButton',
    emits: ['createDoc', 'createFolder', 'importDoc'],
    methods: {
      triggerImport(file: File) {
        this.$emit('importDoc', file)
      },
    },
    render() {
      return null
    },
  }),
}))

describe('docsPage import-doc handler', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('creates a document then appends the file body', async () => {
    const store = useDocsStore()
    const createDocument = vi.spyOn(store, 'createDocument').mockResolvedValue('!room:localhost')
    const appendMarkdown = vi.spyOn(store, 'appendMarkdown').mockResolvedValue()

    const wrapper = mount(DocsPage)
    await nextTick()

    const button = wrapper.findComponent({ name: 'DocsCreateButton' })
    const file = new File(['# Title\n\nbody'], 'note.md', { type: 'text/markdown' })
    ;(button.vm as { triggerImport: (file: File) => void }).triggerImport(file)
    await nextTick()
    // allow promise chain to settle
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(createDocument).toHaveBeenCalledTimes(1)
    const [title] = createDocument.mock.calls[0]!
    expect(title).toBe('note')

    expect(appendMarkdown).toHaveBeenCalledWith('!room:localhost', '# Title\n\nbody')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('rejects files larger than 1 MB without creating a document', async () => {
    const store = useDocsStore()
    const createDocument = vi.spyOn(store, 'createDocument')
    const appendMarkdown = vi.spyOn(store, 'appendMarkdown')

    const wrapper = mount(DocsPage)
    await nextTick()

    const button = wrapper.findComponent({ name: 'DocsCreateButton' })
    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'big.md', { type: 'text/markdown' })
    ;(button.vm as { triggerImport: (file: File) => void }).triggerImport(big)
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(createDocument).not.toHaveBeenCalled()
    expect(appendMarkdown).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })
})
