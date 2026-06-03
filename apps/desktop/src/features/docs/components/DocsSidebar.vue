<script setup lang="ts">
import { Clock3, Star, Users } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { ask } from '@/desktop/dialog';
import { useDocsStore } from '../stores/docsStore';
import DocsCreateButton from './DocsCreateButton.vue';
import DocsFolderTree from './DocsFolderTree.vue';
import DocsSidebarNav from './DocsSidebarNav.vue';

const { t } = useI18n();
const store = useDocsStore();
const router = useRouter();

const IMPORT_DOC_MAX_BYTES = 1024 * 1024;

const sections = [
  { id: 'recent' as const, label: '最近更新', icon: Clock3 },
  { id: 'starred' as const, label: '已收藏', icon: Star },
  { id: 'shared' as const, label: '共享给我', icon: Users },
];

function selectSection(id: (typeof sections)[number]['id']): void {
  store.activeSection = id;
  store.searchQuery = '';
  void router.push('/docs');
}

function selectFolder(folderId: string): void {
  store.activeFolder = folderId;
  store.searchQuery = '';
  void router.push('/docs');
}

async function handleCreate(): Promise<void> {
  try {
    const docId = await store.createDocument('新建协作文档', store.activeFolder);
    await router.push(`/docs/${docId}`);
  } catch {
    toast.error(t('docs.create_failed'));
  }
}

async function importDoc(file: File): Promise<void> {
  if (file.size > IMPORT_DOC_MAX_BYTES) {
    toast.error(t('docs.import_too_large'));
    return;
  }
  try {
    const text = await file.text();
    const title = file.name.replace(/\.(md|markdown|txt)$/i, '') || t('docs.untitled_import');
    const docId = await store.createDocument(title, store.activeFolder);
    await store.appendMarkdown(docId, text);
  } catch {
    toast.error(t('docs.import_failed'));
  }
}

async function createFolder(parentId: string, name: string): Promise<void> {
  const folderId = await store.createFolder(name, parentId);
  store.activeFolder = folderId;
  store.searchQuery = '';
  await router.push('/docs');
}

async function renameFolder(folderId: string, name: string): Promise<void> {
  await store.renameFolder(folderId, name);
}

async function deleteFolder(folderId: string): Promise<void> {
  const confirmed = await ask(t('docs.delete_folder_confirm'), {
    title: t('docs.delete_folder_title'),
    kind: 'warning',
  });
  if (!confirmed) return;
  try {
    await store.deleteFolder(folderId);
    await router.push('/docs');
  } catch (error) {
    console.error('Failed to delete folder:', error);
    toast.error(t('docs.delete_folder_failed'));
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden px-2 py-6">
    <div class="mb-6 px-3">
      <h1 class="text-[18px] font-semibold leading-6 text-foreground">文档</h1>
      <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">团队资料与项目文档</p>
    </div>

    <DocsCreateButton
      @create-doc="handleCreate"
      @create-folder="createFolder('', '新建文件夹')"
      @import-doc="importDoc"
    />

    <DocsSidebarNav :sections="sections" :active-section="store.activeSection" @select="selectSection" />

    <div class="mt-6 px-3 pb-2 text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
      文件夹
    </div>

    <DocsFolderTree
      :root="store.folderTree"
      :active-folder="store.activeFolder"
      @select="selectFolder"
      @create="createFolder"
      @rename="renameFolder"
      @delete="deleteFolder"
    />
  </div>
</template>
