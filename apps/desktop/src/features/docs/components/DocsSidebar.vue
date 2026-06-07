<script setup lang="ts">
import { useSelector } from '@tanstack/vue-store';
import { Clock3, Star, Users } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { ask } from '@/desktop/dialog';
import {
  appendMarkdown,
  createDocument,
  createFolder as createFolderAction,
  deleteFolder as deleteFolderAction,
  docsStore,
  renameFolder as renameFolderAction,
  selectFolderTree,
  setActiveFolder,
  setActiveSection,
  setSearchQuery,
} from '../stores/docsStore';
import DocsCreateButton from './DocsCreateButton.vue';
import DocsFolderTree from './DocsFolderTree.vue';
import DocsSidebarNav from './DocsSidebarNav.vue';

const { t } = useI18n();
const router = useRouter();

const activeSection = useSelector(docsStore, (s) => s.activeSection);
const activeFolder = useSelector(docsStore, (s) => s.activeFolder);
const folderTree = useSelector(docsStore, selectFolderTree);

const IMPORT_DOC_MAX_BYTES = 1024 * 1024;

const sections = [
  { id: 'recent' as const, label: '最近更新', icon: Clock3 },
  { id: 'starred' as const, label: '已收藏', icon: Star },
  { id: 'shared' as const, label: '共享给我', icon: Users },
];

function selectSection(id: (typeof sections)[number]['id']): void {
  setActiveSection(id);
  setSearchQuery('');
  void router.push('/docs');
}

function selectFolder(folderId: string): void {
  setActiveFolder(folderId);
  setSearchQuery('');
  void router.push('/docs');
}

async function handleCreate(): Promise<void> {
  try {
    const docId = await createDocument('新建协作文档', activeFolder.value);
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
    const docId = await createDocument(title, activeFolder.value);
    await appendMarkdown(docId, text);
  } catch {
    toast.error(t('docs.import_failed'));
  }
}

async function createFolder(parentId: string, name: string): Promise<void> {
  const folderId = await createFolderAction(name, parentId);
  setActiveFolder(folderId);
  setSearchQuery('');
  await router.push('/docs');
}

async function renameFolder(folderId: string, name: string): Promise<void> {
  await renameFolderAction(folderId, name);
}

async function deleteFolder(folderId: string): Promise<void> {
  const confirmed = await ask(t('docs.delete_folder_confirm'), {
    title: t('docs.delete_folder_title'),
    kind: 'warning',
  });
  if (!confirmed) return;
  try {
    await deleteFolderAction(folderId);
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

    <DocsSidebarNav :sections="sections" :active-section="activeSection" @select="selectSection" />

    <div class="mt-6 px-3 pb-2 text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
      文件夹
    </div>

    <DocsFolderTree
      :root="folderTree"
      :active-folder="activeFolder"
      @select="selectFolder"
      @create="createFolder"
      @rename="renameFolder"
      @delete="deleteFolder"
    />
  </div>
</template>
