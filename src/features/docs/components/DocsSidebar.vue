<script setup lang="ts">
import { Clock3, Star, Users } from 'lucide-vue-next'
import { useDocsStore } from '../stores/docsStore'
import DocsSidebarNav from './DocsSidebarNav.vue'
import DocsFolderTree from './DocsFolderTree.vue'
import DocsCreateButton from './DocsCreateButton.vue'

const store = useDocsStore()

const sections = [
  { id: 'recent' as const, label: '最近更新', icon: Clock3 },
  { id: 'starred' as const, label: '已收藏', icon: Star },
  { id: 'shared' as const, label: '共享给我', icon: Users },
]

const folders = ['全部文档', '产品规划', '设计资产', '工程文档', '发布复盘']

function selectSection(id: typeof sections[number]['id']): void {
  store.activeSection = id
  store.searchQuery = ''
}

function selectFolder(folder: string): void {
  store.activeFolder = folder
  store.searchQuery = ''
}

async function handleCreate(): Promise<void> {
  await store.createDocument('新建协作文档', store.activeFolder)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden px-2 py-6">
    <div class="mb-6 px-3">
      <h1 class="text-[18px] font-semibold leading-6 text-foreground">文档</h1>
      <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">团队资料与项目文档</p>
    </div>

    <DocsCreateButton @create="handleCreate" />

    <DocsSidebarNav
      :sections="sections"
      :active-section="store.activeSection"
      @select="selectSection"
    />

    <div class="mt-6 px-3 pb-2 text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
      文件夹
    </div>

    <DocsFolderTree
      :folders="folders"
      :active-folder="store.activeFolder"
      @select="selectFolder"
    />
  </div>
</template>
