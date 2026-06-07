<script setup lang="ts">
import type { Doc } from 'yjs';

const props = defineProps<{ ydoc: Doc; initialTitle?: string }>();
const emit = defineEmits<{ updateTitle: [title: string] }>();

const title = shallowRef('');

let ytitle: ReturnType<Doc['getText']> | null = null;
let applyingExternalTitle = false;

function setTitleFromExternal(value: string): void {
  applyingExternalTitle = true;
  title.value = value;
  void nextTick(() => {
    applyingExternalTitle = false;
  });
}

function handleYjsUpdate(): void {
  setTitleFromExternal(ytitle!.toString());
}

onMounted(() => {
  ytitle = props.ydoc.getText('title');
  setTitleFromExternal(ytitle.toString() || props.initialTitle || '');
  ytitle.observe(handleYjsUpdate);
});

onUnmounted(() => {
  ytitle?.unobserve(handleYjsUpdate);
});

watch(title, (val) => {
  if (applyingExternalTitle || !ytitle || val === ytitle.toString()) return;
  ytitle.delete(0, ytitle.length);
  ytitle.insert(0, val);
});

watch(
  () => props.initialTitle,
  (val) => {
    if (!ytitle || ytitle.length > 0) return;
    setTitleFromExternal(val || '');
  },
);

function commitTitle(): void {
  emit('updateTitle', title.value);
}
</script>

<template>
  <input
    v-model="title"
    data-testid="doc-title-input"
    type="text"
    placeholder="无标题文档"
    class="mb-4 w-full border-none bg-transparent px-0 pb-3 pt-0 text-[32px] font-bold leading-10 text-foreground outline-none placeholder:text-muted-foreground"
    @blur="commitTitle"
    @keydown.enter.prevent="commitTitle"
  />
</template>
