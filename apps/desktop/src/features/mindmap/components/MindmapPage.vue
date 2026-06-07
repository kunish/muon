<script setup lang="ts">
import type { MindMap } from '../types/mindmap';
import { useSelector } from '@tanstack/vue-store';
import { ChevronDown, ListTree, Plus, Trash2 } from 'lucide-vue-next';
import { computed, onMounted, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  mindmapStore,
  selectMaps,
  addChild as storeAddChild,
  addMap as storeAddMap,
  removeMap as storeRemoveMap,
  removeNode as storeRemoveNode,
  renameMap as storeRenameMap,
  toggleCollapse as storeToggleCollapse,
  updateNodeText as storeUpdateNodeText,
} from '../stores/mindmapStore';
import { buildVisibleNodes } from '../types/mindmap';

const { t } = useI18n();

const maps = useSelector(mindmapStore, selectMaps);

const activeMapId = shallowRef<string | null>(null);
const activeMap = computed<MindMap | null>(() => {
  const list = maps.value;
  if (list.length === 0) return null;
  return list.find((map) => map.id === activeMapId.value) ?? list[0];
});

const visibleNodes = computed(() => (activeMap.value ? buildVisibleNodes(activeMap.value) : []));

// 全局搜索深链：?focus=<mapId> 时选中该笔记。route 在无路由上下文可能为 undefined，防御式读取。
const route = useRoute();
onMounted(() => {
  const focusParam = route?.query?.focus;
  const focus = typeof focusParam === 'string' ? focusParam : null;
  if (focus && maps.value.some((map) => map.id === focus)) activeMapId.value = focus;
});

function createMap(): void {
  const map = storeAddMap(t('mindmap.default_title', { n: maps.value.length + 1 }));
  activeMapId.value = map.id;
}

function deleteMap(map: MindMap): void {
  storeRemoveMap(map.id);
  if (activeMapId.value === map.id) activeMapId.value = null;
  toast.success(t('mindmap.deleted', { title: map.title }));
}

function onRenameMap(map: MindMap, event: Event): void {
  storeRenameMap(map.id, (event.target as HTMLInputElement).value);
}

function onNodeText(nodeId: string, event: Event): void {
  const map = activeMap.value;
  if (!map) return;
  storeUpdateNodeText(map.id, nodeId, (event.target as HTMLInputElement).value);
}

function addChild(nodeId: string): void {
  const map = activeMap.value;
  if (!map) return;
  storeAddChild(map.id, nodeId);
}

function removeNode(nodeId: string): void {
  const map = activeMap.value;
  if (!map) return;
  storeRemoveNode(map.id, nodeId);
}

function toggleCollapse(nodeId: string): void {
  const map = activeMap.value;
  if (!map) return;
  storeToggleCollapse(map.id, nodeId);
}
</script>

<template>
  <WorkspacePageFrame :title="t('mindmap.title')" :subtitle="t('mindmap.subtitle')" :icon="ListTree">
    <template #actions>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
        data-testid="mindmap-new"
        @click="createMap"
      >
        <Plus :size="16" />{{ t('mindmap.new') }}
      </button>
    </template>

    <!-- 空状态 -->
    <div
      v-if="!activeMap"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center"
      data-testid="mindmap-empty"
    >
      <ListTree :size="28" class="text-muted-foreground" />
      <p class="text-[14px] font-medium text-foreground">{{ t('mindmap.empty_title') }}</p>
      <p class="text-[13px] text-muted-foreground">{{ t('mindmap.empty_hint') }}</p>
    </div>

    <template v-else>
      <!-- 笔记切换 -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="map in maps"
          :key="map.id"
          type="button"
          class="h-8 rounded-lg border px-3 text-[13px] font-medium transition"
          :class="
            map.id === activeMap.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent/40'
          "
          :data-testid="`mindmap-tab-${map.id}`"
          @click="activeMapId = map.id"
        >
          {{ map.title }}
        </button>
      </div>

      <!-- 工具栏 -->
      <div class="flex items-center justify-between gap-2">
        <input
          :value="activeMap.title"
          type="text"
          class="h-9 rounded-lg border border-border bg-background px-3 text-[14px] font-semibold outline-none focus:border-primary"
          :aria-label="t('mindmap.title_label')"
          @change="onRenameMap(activeMap, $event)"
        />
        <button
          type="button"
          class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          :aria-label="t('mindmap.delete_note')"
          @click="deleteMap(activeMap)"
        >
          <Trash2 :size="16" />
        </button>
      </div>

      <!-- 大纲树 -->
      <div class="rounded-xl border border-border p-2">
        <div
          v-for="item in visibleNodes"
          :key="item.node.id"
          class="flex items-center gap-1.5 py-0.5"
          :style="{ paddingLeft: `${item.depth * 20}px` }"
          data-testid="mindmap-node"
        >
          <button
            v-if="item.hasChildren"
            type="button"
            class="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground"
            :aria-label="item.node.collapsed ? t('mindmap.expand') : t('mindmap.collapse')"
            @click="toggleCollapse(item.node.id)"
          >
            <ChevronDown :size="15" class="transition-transform" :class="item.node.collapsed ? '-rotate-90' : ''" />
          </button>
          <span v-else class="inline-block size-5 shrink-0 text-center text-muted-foreground">·</span>
          <input
            :value="item.node.text"
            type="text"
            class="h-8 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 text-[13px] text-foreground outline-none hover:border-border focus:border-primary"
            :class="item.depth === 0 ? 'font-semibold' : ''"
            :data-testid="`mindmap-node-input-${item.node.id}`"
            @change="onNodeText(item.node.id, $event)"
          />
          <button
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-accent/40 hover:text-foreground"
            :aria-label="t('mindmap.add_child')"
            :data-testid="`mindmap-add-child-${item.node.id}`"
            @click="addChild(item.node.id)"
          >
            <Plus :size="14" />
          </button>
          <button
            v-if="item.depth > 0"
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            :aria-label="t('mindmap.delete_node')"
            @click="removeNode(item.node.id)"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </template>
  </WorkspacePageFrame>
</template>
