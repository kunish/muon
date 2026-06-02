<script setup lang="ts">
import type { Editor } from '@tiptap/core';
import type { DocVersion } from '../../db/docsDb';
import { History, RotateCcw, Trash2, X } from 'lucide-vue-next';
import { nanoid } from 'nanoid';
import { onMounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { docsRepo } from '../../db/docsDb';

const props = defineProps<{
  docId: string;
  editor: Editor | null;
  authorName: string;
}>();

const emit = defineEmits<{ close: [] }>();

const { t, locale } = useI18n();

const versions = shallowRef<DocVersion[]>([]);
const labelDraft = ref('');
const saving = ref(false);

async function loadVersions(): Promise<void> {
  versions.value = await docsRepo.listVersions(props.docId);
}

function defaultLabel(): string {
  return t('docs.version_default_label', {
    time: new Date().toLocaleString(locale.value, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  });
}

async function saveVersion(): Promise<void> {
  if (!props.editor || saving.value) return;
  saving.value = true;
  try {
    await docsRepo.saveVersion({
      id: nanoid(),
      docId: props.docId,
      label: labelDraft.value.trim() || defaultLabel(),
      author: props.authorName,
      contentJson: JSON.stringify(props.editor.getJSON()),
      createdAt: Date.now(),
    });
    labelDraft.value = '';
    await loadVersions();
  } finally {
    saving.value = false;
  }
}

function restoreVersion(version: DocVersion): void {
  if (!props.editor) return;
  // 经 Collaboration 扩展回写 Yjs 文档并同步给协作者
  props.editor.commands.setContent(JSON.parse(version.contentJson));
}

async function removeVersion(id: string): Promise<void> {
  await docsRepo.deleteVersion(id);
  await loadVersions();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(loadVersions);
</script>

<template>
  <aside class="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar">
    <div class="flex h-10 items-center justify-between border-b border-border px-3">
      <span class="flex items-center gap-1.5 text-xs font-semibold">
        <History :size="13" />
        {{ t('docs.version_history') }}
      </span>
      <button class="flex size-6 items-center justify-center rounded hover:bg-accent" @click="emit('close')">
        <X :size="14" />
      </button>
    </div>

    <div class="flex items-center gap-2 border-b border-border p-3">
      <input
        v-model="labelDraft"
        type="text"
        data-testid="doc-version-label"
        :placeholder="t('docs.version_label_placeholder')"
        class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        @keyup.enter="saveVersion"
      />
      <button
        data-testid="doc-version-save"
        class="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        :disabled="saving || !editor"
        @click="saveVersion"
      >
        {{ t('docs.save_version') }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <div v-if="versions.length === 0" class="py-8 text-center text-xs text-muted-foreground">
        {{ t('docs.no_versions') }}
      </div>
      <div
        v-for="version in versions"
        :key="version.id"
        class="mb-2 rounded-md border border-border bg-background p-2"
        data-testid="doc-version-entry"
      >
        <div class="text-[12px] font-semibold">{{ version.label }}</div>
        <div class="mt-0.5 text-[11px] text-muted-foreground">
          {{ version.author }} · {{ formatTime(version.createdAt) }}
        </div>
        <div class="mt-1.5 flex gap-1.5">
          <button
            :data-testid="`doc-version-restore-${version.id}`"
            class="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent"
            @click="restoreVersion(version)"
          >
            <RotateCcw :size="11" />
            {{ t('docs.restore_version') }}
          </button>
          <button
            class="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/10"
            @click="removeVersion(version.id)"
          >
            <Trash2 :size="11" />
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
