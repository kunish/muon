import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import DocsPage from '@/features/docs/components/DocsPage.vue'
import { resetDocsStore } from '@/features/docs/stores/docsStore'

const routeParams = vi.hoisted(() => vi.fn(() => ({})))
const routerPush = vi.hoisted(() => vi.fn())

vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn().mockResolvedValue(true),
}))

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
    // 重置持久化的文档元数据覆盖，避免重命名等用例污染后续用例
    localStorage.clear()
    // docsStore is now a module singleton — reset its UI/doc state between tests.
    resetDocsStore()
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

  it('shows a useful empty state when search filters out every document', async () => {
    const wrapper = mountDocsPage()

    await wrapper.get('input[placeholder="搜索文档..."]').setValue('不存在')

    expect(wrapper.get('[data-testid="docs-empty-state"]').text()).toContain('没有找到匹配文档')
    expect(wrapper.find('[data-testid="docs-empty-create"]').exists()).toBe(false)
  })

  it('lets the empty state create a document from an empty normal list', async () => {
    const wrapper = mountDocsPage()

    await wrapper.get('[data-testid="docs-review-filter"]').trigger('click')
    await wrapper.get('[data-testid="docs-status-select"]').setValue('草稿')
    await flushPromises()

    expect(wrapper.get('[data-testid="docs-empty-state"]').text()).toContain('暂无评审中文档')
    await wrapper.get('[data-testid="docs-empty-create"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith('/docs/!new:localhost')
  })

  it('opens the editor only for an explicit document route', () => {
    routeParams.mockReturnValue({ docId: '!doc:localhost' })

    const wrapper = mountDocsPage()

    expect(wrapper.find('[data-testid="doc-editor"]').exists()).toBe(true)
  })

  it('navigates from the list to a selected document route', async () => {
    const wrapper = mountDocsPage()
    const docRow = wrapper.findAll('button').find((button) => button.text().includes('接口设计评审'))

    expect(docRow).toBeDefined()
    await docRow!.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/docs/!doc:localhost')
  })

  it('opens documents from the list quick action', async () => {
    const wrapper = mountDocsPage()

    await wrapper.get('[data-testid="docs-open"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/docs/!doc:localhost')
  })

  it('toggles the review-status filter from the docs list header', async () => {
    const wrapper = mountDocsPage()
    const filter = wrapper.get('[data-testid="docs-review-filter"]')

    expect(filter.attributes('aria-pressed')).toBe('false')
    await filter.trigger('click')

    expect(filter.attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('接口设计评审')
  })

  it('updates document status from the list row', async () => {
    const wrapper = mountDocsPage()

    await wrapper.get('[data-testid="docs-status-select"]').setValue('稳定')
    await flushPromises()

    expect((wrapper.get('[data-testid="docs-status-select"]').element as HTMLSelectElement).value).toBe('稳定')
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

    await wrapper
      .findAll('[data-testid="docs-folder-row"]')
      .find((row) => row.text().includes('工程文档'))!
      .trigger('click')
    expect(wrapper.text()).toContain('接口设计评审')

    await wrapper.get('[data-testid="docs-move"]').trigger('click')
    await wrapper.get('[data-testid="docs-move-select"]').setValue('')
    await wrapper.get('[data-testid="docs-move-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).not.toContain('接口设计评审')
  })

  it('lets documents be collected into the starred section from the list row', async () => {
    const wrapper = mountDocsPage()

    await wrapper.get('[data-testid="docs-star"]').trigger('click')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('已收藏'))!
      .trigger('click')

    expect(wrapper.text()).toContain('接口设计评审')
  })

  it('navigates to a newly created document', async () => {
    const wrapper = mountDocsPage()
    const createButton = wrapper.findAll('button').find((button) => button.text().includes('新建文档'))

    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith('/docs/!new:localhost')
  })

  it('returns from an open document when selecting a sidebar section', async () => {
    routeParams.mockReturnValue({ docId: '!doc:localhost' })
    const wrapper = mountDocsPage()

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('最近更新'))!
      .trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/docs')
  })
})
