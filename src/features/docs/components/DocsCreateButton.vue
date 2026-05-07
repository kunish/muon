<script setup lang="ts">
import { FilePlus2, FolderPlus, Upload } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits<{
  createDoc: []
  createFolder: []
}>()

const open = ref(false)
const btnRef = ref<HTMLElement>()
const menuRef = ref<HTMLElement>()

function toggle() {
  open.value = !open.value
}

function handleCreateDoc() {
  open.value = false
  emit('createDoc')
}

function handleCreateFolder() {
  open.value = false
  emit('createFolder')
}

function onClickOutside(e: MouseEvent) {
  if (!open.value)
    return
  const target = e.target as HTMLElement
  if (btnRef.value?.contains(target) || menuRef.value?.contains(target))
    return
  open.value = false
}

onMounted(() => document.addEventListener('pointerdown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onClickOutside))
</script>

<template>
  <div ref="btnRef" class="relative mx-2 mb-4">
    <button
      class="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      @click="toggle"
    >
      <FilePlus2 :size="16" />
      <span>新建</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="fixed z-50 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-lg"
        :style="{ left: `${btnRef?.getBoundingClientRect().left ?? 0}px`, top: `${(btnRef?.getBoundingClientRect().bottom ?? 0) + 4}px` }"
      >
        <button
          class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent"
          @click="handleCreateDoc"
        >
          <FilePlus2 :size="15" class="text-primary" />
          <span>新建文档</span>
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent"
          @click="handleCreateFolder"
        >
          <FolderPlus :size="15" class="text-amber-500" />
          <span>新建文件夹</span>
        </button>
        <div class="mx-2 my-1 h-px bg-border" />
        <button
          class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent"
        >
          <Upload :size="15" />
          <span>导入文档</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
