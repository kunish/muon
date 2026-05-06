<script setup lang="ts">
import type { DocFolderNode } from '../types/doc'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@muon/ui/tooltip'
import { Check, ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Trash2, X } from 'lucide-vue-next'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

const props = defineProps<{
  root: DocFolderNode
  activeFolder: string
}>()

const emit = defineEmits<{
  select: [folderId: string]
  create: [parentId: string, name: string]
  rename: [folderId: string, name: string]
  delete: [folderId: string]
}>()

const expandedFolderIds = shallowRef(new Set<string>(['']))
const creatingParentId = shallowRef<string | null>(null)
const createDraft = shallowRef('新建文件夹')
const renamingFolderId = shallowRef<string | null>(null)
const renameDraft = shallowRef('')
const menuFolderId = shallowRef<string | null>(null)
const createInput = ref<HTMLInputElement>()
const renameInput = ref<HTMLInputElement>()
const titleTooltipContentClass = 'relative max-w-[420px] overflow-visible break-words rounded-lg bg-[#1f2329] px-3 py-2 text-[13px] leading-[18px] text-white shadow-[0_8px_24px_rgba(31,35,41,0.18)] before:absolute before:left-[-4px] before:top-1/2 before:size-2 before:-translate-y-1/2 before:rotate-45 before:bg-[#1f2329]'

const folderById = computed(() => {
  const map = new Map<string, DocFolderNode>()
  function visit(node: DocFolderNode): void {
    map.set(node.id, node)
    node.children.forEach(visit)
  }
  visit(props.root)
  return map
})

const visibleFolders = computed(() => {
  const rows: DocFolderNode[] = []
  function visit(node: DocFolderNode): void {
    rows.push(node)
    if (expandedFolderIds.value.has(node.id)) {
      node.children.forEach(visit)
    }
  }
  visit(props.root)
  return rows
})

watch(() => props.activeFolder, (folderId) => {
  const next = new Set(expandedFolderIds.value)
  let current = folderById.value.get(folderId)
  while (current) {
    next.add(current.parentId)
    if (!current.parentId || current.parentId === current.id)
      break
    current = folderById.value.get(current.parentId)
  }
  next.add('')
  expandedFolderIds.value = next
}, { immediate: true })

watch(() => props.root, () => {
  expandedFolderIds.value = new Set([...expandedFolderIds.value, ''])
})

function rowPadding(node: DocFolderNode): string {
  return `${8 + node.depth * 12}px`
}

function toggleFolder(node: DocFolderNode): void {
  if (node.children.length === 0)
    return

  const next = new Set(expandedFolderIds.value)
  if (next.has(node.id))
    next.delete(node.id)
  else
    next.add(node.id)
  expandedFolderIds.value = next
}

function beginCreate(parentId: string): void {
  const next = new Set(expandedFolderIds.value)
  next.add(parentId)
  expandedFolderIds.value = next
  creatingParentId.value = parentId
  menuFolderId.value = null
  createDraft.value = '新建文件夹'
  void nextTick(() => {
    createInput.value?.focus()
    createInput.value?.select()
  })
}

function cancelCreate(): void {
  creatingParentId.value = null
  createDraft.value = '新建文件夹'
}

function submitCreate(): void {
  if (creatingParentId.value === null)
    return

  const name = createDraft.value.trim()
  if (!name)
    return

  emit('create', creatingParentId.value, name)
  cancelCreate()
}

function beginRename(node: DocFolderNode): void {
  if (!node.id || !node.isPersisted)
    return

  renamingFolderId.value = node.id
  menuFolderId.value = null
  renameDraft.value = node.name
  void nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

function cancelRename(): void {
  renamingFolderId.value = null
  renameDraft.value = ''
}

function submitRename(folderId: string): void {
  const name = renameDraft.value.trim()
  if (!name)
    return

  emit('rename', folderId, name)
  cancelRename()
}

function toggleMenu(folderId: string): void {
  menuFolderId.value = menuFolderId.value === folderId ? null : folderId
}

function requestDelete(folderId: string): void {
  menuFolderId.value = null
  emit('delete', folderId)
}
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
      <template
        v-for="folder in visibleFolders"
        :key="folder.id || 'root'"
      >
        <div
          class="workspace-row group/folder relative flex min-w-0 items-center gap-1 py-2 pr-2 text-muted-foreground"
          :class="{ 'workspace-row-active': activeFolder === folder.id }"
          :style="{ paddingLeft: rowPadding(folder) }"
          @mouseleave="menuFolderId = null"
        >
          <button
            type="button"
            class="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            :class="{ invisible: folder.children.length === 0 }"
            :aria-label="expandedFolderIds.has(folder.id) ? '收起文件夹' : '展开文件夹'"
            @click.stop="toggleFolder(folder)"
          >
            <ChevronDown v-if="expandedFolderIds.has(folder.id)" :size="14" />
            <ChevronRight v-else :size="14" />
          </button>

          <button
            v-if="renamingFolderId !== folder.id"
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            data-testid="docs-folder-row"
            @click="emit('select', folder.id)"
          >
            <span class="inline-flex size-5 items-center justify-center">
              <FolderOpen v-if="activeFolder === folder.id || expandedFolderIds.has(folder.id)" :size="18" />
              <Folder v-else :size="18" />
            </span>
            <Tooltip>
              <TooltipTrigger as-child>
                <span
                  class="min-w-0 flex-1 truncate text-[13px]"
                  data-testid="docs-folder-name"
                  :aria-label="folder.name"
                >
                  {{ folder.name }}
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                :side-offset="12"
                :class="titleTooltipContentClass"
              >
                {{ folder.name }}
              </TooltipContent>
            </Tooltip>
            <span
              v-if="folder.count > 0"
              class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] leading-none text-muted-foreground transition-opacity group-hover/folder:opacity-0"
            >
              {{ folder.count }}
            </span>
          </button>

          <form
            v-else
            class="flex min-w-0 items-center gap-1"
            data-testid="docs-folder-rename-form"
            @submit.prevent="submitRename(folder.id)"
          >
            <input
              ref="renameInput"
              v-model="renameDraft"
              data-testid="docs-folder-rename-input"
              class="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
              @keydown.esc.prevent="cancelRename"
            >
            <button
              type="submit"
              class="inline-flex size-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-sidebar-accent"
              title="保存"
              aria-label="保存"
            >
              <Check :size="15" />
            </button>
            <button
              type="button"
              class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              title="取消"
              aria-label="取消"
              @click="cancelRename"
            >
              <X :size="15" />
            </button>
          </form>

          <div
            v-if="renamingFolderId !== folder.id"
            class="flex shrink-0 items-center justify-end gap-0.5"
          >
            <button
              type="button"
              data-testid="docs-folder-create"
              class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
              :class="folder.id ? 'opacity-0 group-hover/folder:opacity-100 focus:opacity-100' : 'opacity-100'"
              title="新建子文件夹"
              aria-label="新建子文件夹"
              @click.stop="beginCreate(folder.id)"
            >
              <FolderPlus :size="15" />
            </button>
            <button
              v-if="folder.id && folder.isPersisted"
              type="button"
              data-testid="docs-folder-more"
              class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
              :class="menuFolderId === folder.id ? 'opacity-100' : 'opacity-0 group-hover/folder:opacity-100 focus:opacity-100'"
              title="更多"
              aria-label="更多"
              @click.stop="toggleMenu(folder.id)"
            >
              <MoreHorizontal :size="16" />
            </button>
          </div>

          <div
            v-if="menuFolderId === folder.id"
            class="workspace-menu absolute right-1 top-9 w-36"
            data-testid="docs-folder-menu"
            @click.stop
          >
            <button
              type="button"
              class="workspace-menu-item w-full"
              data-testid="docs-folder-rename"
              @click="beginRename(folder)"
            >
              <Pencil :size="15" />
              <span>重命名</span>
            </button>
            <button
              type="button"
              class="workspace-menu-item workspace-menu-item-destructive w-full disabled:pointer-events-none disabled:opacity-50"
              data-testid="docs-folder-delete"
              :disabled="folder.count > 0"
              @click="requestDelete(folder.id)"
            >
              <Trash2 :size="15" />
              <span>删除</span>
            </button>
          </div>
        </div>

        <form
          v-if="creatingParentId === folder.id"
          class="flex items-center gap-1 py-1 pr-1"
          data-testid="docs-folder-create-form"
          :style="{ paddingLeft: `${28 + (folder.depth + 1) * 12}px` }"
          @submit.prevent="submitCreate"
        >
          <input
            ref="createInput"
            v-model="createDraft"
            data-testid="docs-folder-create-input"
            class="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
            @keydown.esc.prevent="cancelCreate"
          >
          <button
            type="submit"
            class="inline-flex size-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-sidebar-accent"
            title="保存"
            aria-label="保存"
          >
            <Check :size="15" />
          </button>
          <button
            type="button"
            class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            title="取消"
            aria-label="取消"
            @click="cancelCreate"
          >
            <X :size="15" />
          </button>
        </form>
      </template>
    </div>
  </TooltipProvider>
</template>
