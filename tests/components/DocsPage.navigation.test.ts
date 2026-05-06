import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import DocsPage from '@/features/docs/components/DocsPage.vue'

const routeParams = vi.hoisted(() => vi.fn(() => ({})))
const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: routeParams(),
    query: {},
    hash: '',
    fullPath: '/docs',
    path: '/docs',
    name: 'docs',
    matched: [],
    meta: {},
  }),
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getRooms: vi.fn(() => [
      {
        roomId: '!doc:localhost',
        getLiveTimeline: () => ({
          getEvents: () => [
            {
              getType: () => 'org.muon.doc.metadata',
              getContent: () => ({
                title: '接口设计评审',
                owner: '@alice:localhost',
                updated: '刚刚',
                type: '文档',
                status: '评审中',
                folder: '工程文档',
                sectionIds: ['recent'],
              }),
            },
          ],
        }),
      },
    ]),
    getRoom: vi.fn(() => ({
      roomId: '!doc:localhost',
      getLiveTimeline: () => ({
        getEvents: () => [
          {
            getType: () => 'org.muon.doc.metadata',
            getContent: () => ({
              title: '接口设计评审',
              owner: '@alice:localhost',
              updated: '刚刚',
              type: '文档',
              status: '评审中',
              folder: '工程文档',
              sectionIds: ['recent'],
            }),
          },
        ],
      }),
    })),
    createRoom: vi.fn().mockResolvedValue({ room_id: '!new:localhost' }),
    getUserId: vi.fn(() => '@test:localhost'),
    sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$metadata' }),
    setRoomName: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
    getAccountData: vi.fn(() => null),
    setAccountData: vi.fn().mockResolvedValue(undefined),
  })),
}))

const DocEditorStub = defineComponent({
  name: 'DocEditor',
  template: '<div data-testid="doc-editor" />',
})

function mountDocsPage() {
  return mount(DocsPage, {
    global: {
      mocks: {
        $router: { push: routerPush },
      },
      stubs: {
        DocEditor: DocEditorStub,
      },
    },
  })
}

describe('docsPage navigation', () => {
  beforeEach(() => {
    routeParams.mockReturnValue({})
    routerPush.mockReset()
  })

  it('keeps the docs home on the document list even when documents exist', () => {
    const wrapper = mountDocsPage()

    expect(wrapper.text()).toContain('接口设计评审')
    expect(wrapper.find('[data-testid="doc-editor"]').exists()).toBe(false)
  })

  it('renders folders from document metadata instead of the previous built-in list', () => {
    const wrapper = mountDocsPage()

    expect(wrapper.text()).toContain('工程文档')
    expect(wrapper.text()).not.toContain('产品规划')
    expect(wrapper.text()).not.toContain('设计资产')
    expect(wrapper.text()).not.toContain('发布复盘')
  })

  it('opens the editor only for an explicit document route', () => {
    routeParams.mockReturnValue({ docId: '!doc:localhost' })

    const wrapper = mountDocsPage()

    expect(wrapper.find('[data-testid="doc-editor"]').exists()).toBe(true)
  })

  it('navigates from the list to a selected document route', async () => {
    const wrapper = mountDocsPage()
    const docRow = wrapper.findAll('button').find(button => button.text().includes('接口设计评审'))

    expect(docRow).toBeDefined()
    await docRow!.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/docs/!doc:localhost')
  })

  it('opens documents from the list quick action', async () => {
    const wrapper = mountDocsPage()

    await wrapper.get('[data-testid="docs-open"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/docs/!doc:localhost')
  })

  it('renames documents from the list quick action', async () => {
    const wrapper = mountDocsPage()

    await wrapper.get('[data-testid="docs-rename"]').trigger('click')
    await wrapper.get('[data-testid="docs-rename-input"]').setValue('更新后的设计评审')
    await wrapper.get('[data-testid="docs-rename-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('更新后的设计评审')
  })

  it('deletes documents from the list quick action', async () => {
    const wrapper = mountDocsPage()

    await wrapper.get('[data-testid="docs-delete"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('接口设计评审')
  })

  it('moves documents to another folder from the list quick action', async () => {
    const wrapper = mountDocsPage()

    await wrapper.findAll('[data-testid="docs-folder-row"]').find(row => row.text().includes('工程文档'))!.trigger('click')
    expect(wrapper.text()).toContain('接口设计评审')

    await wrapper.get('[data-testid="docs-move"]').trigger('click')
    await wrapper.get('[data-testid="docs-move-select"]').setValue('')
    await wrapper.get('[data-testid="docs-move-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).not.toContain('接口设计评审')
  })

  it('navigates to a newly created document', async () => {
    const wrapper = mountDocsPage()
    const createButton = wrapper.findAll('button').find(button => button.text().includes('新建文档'))

    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith('/docs/!new:localhost')
  })

  it('returns from an open document when selecting a sidebar section', async () => {
    routeParams.mockReturnValue({ docId: '!doc:localhost' })
    const wrapper = mountDocsPage()

    await wrapper.findAll('button').find(button => button.text().includes('最近更新'))!.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/docs')
  })
})
