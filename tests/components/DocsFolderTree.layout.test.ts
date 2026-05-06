import type { DocFolderNode } from '@/features/docs/types/doc'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DocsFolderTree from '@/features/docs/components/DocsFolderTree.vue'

function makeFolderTree(): DocFolderNode {
  return {
    id: '',
    name: '全部文档',
    parentId: '',
    depth: 0,
    count: 3,
    isPersisted: true,
    children: [{
      id: 'folder:long',
      name: 'Beem-IM 包管理 yarn 迁移至 pnpm',
      parentId: '',
      depth: 1,
      count: 1,
      isPersisted: true,
      children: [],
    }],
  }
}

describe('docsFolderTree layout', () => {
  it('keeps long folder names truncated with a full-title tooltip and Feishu-style overflow menu', async () => {
    const wrapper = mount(DocsFolderTree, {
      props: {
        root: makeFolderTree(),
        activeFolder: 'folder:long',
      },
    })

    const longName = wrapper.findAll('[data-testid="docs-folder-name"]')
      .find(node => node.text().includes('Beem-IM'))

    expect(longName?.attributes('title')).toBeUndefined()
    expect(longName?.attributes('aria-label')).toBe('Beem-IM 包管理 yarn 迁移至 pnpm')
    expect(wrapper.find('[data-testid="docs-folder-rename"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="docs-folder-delete"]').exists()).toBe(false)

    await wrapper.get('[data-testid="docs-folder-more"]').trigger('click')

    expect(wrapper.get('[data-testid="docs-folder-rename"]').text()).toContain('重命名')
    expect(wrapper.get('[data-testid="docs-folder-delete"]').text()).toContain('删除')
  })

  it('keeps inferred folders editable and deletable', async () => {
    const tree = makeFolderTree()
    const inferredFolder = tree.children[0]!
    tree.children[0] = {
      ...inferredFolder,
      name: '未命名文件夹',
      count: 1,
      isPersisted: false,
    }
    const wrapper = mount(DocsFolderTree, {
      props: {
        root: tree,
        activeFolder: 'folder:long',
      },
    })

    await wrapper.get('[data-testid="docs-folder-more"]').trigger('click')

    expect(wrapper.get('[data-testid="docs-folder-rename"]').text()).toContain('重命名')
    expect(wrapper.get('[data-testid="docs-folder-delete"]').attributes('disabled')).toBeUndefined()
  })
})
