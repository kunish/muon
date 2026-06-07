<script setup lang="ts">
import type { Minute } from '../types/minute';
import { useSelector } from '@tanstack/vue-store';
import { CalendarClock, ChevronDown, Circle, CircleCheck, NotebookPen, Plus, Trash2, UserRound } from 'lucide-vue-next';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  minuteStore,
  selectMinutes,
  addActionItem as storeAddActionItem,
  addMinute as storeAddMinute,
  removeActionItem as storeRemoveActionItem,
  removeMinute as storeRemoveMinute,
  toggleActionItem as storeToggleActionItem,
  updateActionItem as storeUpdateActionItem,
  updateMinute as storeUpdateMinute,
} from '../stores/minuteStore';
import { openActionCount, todayKey } from '../types/minute';

const { t } = useI18n();

const minutes = useSelector(minuteStore, selectMinutes);

const sortedMinutes = computed(() =>
  [...minutes.value].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
);

// 当前展开编辑的纪要 id
const expandedId = shallowRef<string | null>(null);
function toggleExpanded(id: string): void {
  expandedId.value = expandedId.value === id ? null : id;
}

// 全局搜索深链：?focus=<minuteId> 时展开该纪要。
const route = useRoute();
onMounted(() => {
  const focus = typeof route.query.focus === 'string' ? route.query.focus : null;
  if (focus && minutes.value.some((minute) => minute.id === focus)) expandedId.value = focus;
});

// ── 新建纪要 ──
const composerOpen = shallowRef(false);
const draftTitle = shallowRef('');
const draftDate = shallowRef(todayKey(Date.now()));
const draftAttendees = shallowRef('我');

function openComposer(): void {
  draftTitle.value = '';
  draftDate.value = todayKey(Date.now());
  draftAttendees.value = '我';
  composerOpen.value = true;
}

function submitMinute(): void {
  const title = draftTitle.value.trim();
  if (!title) {
    toast.error(t('minutes.topic_required'));
    return;
  }
  const minute = storeAddMinute({ title, date: draftDate.value, attendees: draftAttendees.value });
  expandedId.value = minute.id;
  composerOpen.value = false;
  toast.success(t('minutes.created'));
}

function deleteMinute(minute: Minute): void {
  storeRemoveMinute(minute.id);
  toast.success(t('minutes.deleted', { title: minute.title }));
}

function onFieldChange(minuteId: string, field: 'agenda' | 'decisions' | 'notes', event: Event): void {
  storeUpdateMinute(minuteId, { [field]: (event.target as HTMLTextAreaElement).value });
}

function onMetaChange(minuteId: string, field: 'title' | 'date' | 'attendees', event: Event): void {
  storeUpdateMinute(minuteId, { [field]: (event.target as HTMLInputElement).value });
}

// ── 行动项 ──
const actionDrafts = ref<Record<string, string>>({});

function submitActionItem(minuteId: string): void {
  const text = (actionDrafts.value[minuteId] ?? '').trim();
  if (!text) return;
  storeAddActionItem(minuteId, text);
  actionDrafts.value = { ...actionDrafts.value, [minuteId]: '' };
}
</script>

<template>
  <WorkspacePageFrame :title="t('minutes.title')" :subtitle="t('minutes.subtitle')" :icon="NotebookPen">
    <template #actions>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
        data-testid="minutes-new"
        @click="openComposer"
      >
        <Plus :size="16" />
        {{ t('minutes.new') }}
      </button>
    </template>

    <!-- 新建面板 -->
    <div v-if="composerOpen" class="grid gap-3 rounded-xl border border-border bg-sidebar p-4 sm:grid-cols-2">
      <label class="flex flex-col gap-1 text-[13px] sm:col-span-2">
        <span class="text-muted-foreground">{{ t('minutes.topic') }}</span>
        <input
          v-model="draftTitle"
          type="text"
          :placeholder="t('minutes.topic_placeholder')"
          class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          data-testid="minutes-draft-title"
        />
      </label>
      <label class="flex flex-col gap-1 text-[13px]">
        <span class="text-muted-foreground">{{ t('minutes.date') }}</span>
        <input
          v-model="draftDate"
          type="date"
          class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
        />
      </label>
      <label class="flex flex-col gap-1 text-[13px]">
        <span class="text-muted-foreground">{{ t('minutes.attendees') }}</span>
        <input
          v-model="draftAttendees"
          type="text"
          :placeholder="t('minutes.attendees_placeholder')"
          class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
        />
      </label>
      <div class="flex items-center justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          class="h-9 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
          @click="composerOpen = false"
        >
          {{ t('minutes.cancel') }}
        </button>
        <button
          type="button"
          class="h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
          data-testid="minutes-submit"
          @click="submitMinute"
        >
          {{ t('minutes.create') }}
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="sortedMinutes.length === 0"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center"
      data-testid="minutes-empty"
    >
      <NotebookPen :size="28" class="text-muted-foreground" />
      <p class="text-[14px] font-medium text-foreground">{{ t('minutes.empty_title') }}</p>
      <p class="text-[13px] text-muted-foreground">{{ t('minutes.empty_hint') }}</p>
    </div>

    <!-- 纪要列表 -->
    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="minute in sortedMinutes"
        :key="minute.id"
        class="rounded-xl border border-border bg-card"
        data-testid="minutes-item"
      >
        <div class="flex items-start gap-3 p-4">
          <button
            type="button"
            class="mt-0.5 shrink-0 text-muted-foreground transition hover:text-foreground"
            :aria-label="expandedId === minute.id ? t('minutes.collapse') : t('minutes.expand')"
            @click="toggleExpanded(minute.id)"
          >
            <ChevronDown
              :size="18"
              class="transition-transform"
              :class="expandedId === minute.id ? '' : '-rotate-90'"
            />
          </button>
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-[15px] font-semibold text-foreground">{{ minute.title }}</h3>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
              <span class="inline-flex items-center gap-1"><CalendarClock :size="12" />{{ minute.date }}</span>
              <span class="inline-flex items-center gap-1"><UserRound :size="12" />{{ minute.attendees }}</span>
              <span v-if="openActionCount(minute) > 0" class="text-warning">{{
                t('minutes.open_actions', { count: openActionCount(minute) })
              }}</span>
            </div>
          </div>
          <button
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            :aria-label="t('minutes.delete')"
            @click="deleteMinute(minute)"
          >
            <Trash2 :size="15" />
          </button>
        </div>

        <!-- 编辑区 -->
        <div v-if="expandedId === minute.id" class="border-t border-border p-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
              {{ t('minutes.topic') }}
              <input
                :value="minute.title"
                type="text"
                class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
                @change="onMetaChange(minute.id, 'title', $event)"
              />
            </label>
            <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
              {{ t('minutes.attendees') }}
              <input
                :value="minute.attendees"
                type="text"
                class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
                @change="onMetaChange(minute.id, 'attendees', $event)"
              />
            </label>
            <label class="flex flex-col gap-1 text-[12px] text-muted-foreground sm:col-span-2">
              {{ t('minutes.agenda') }}
              <textarea
                :value="minute.agenda ?? ''"
                rows="2"
                :placeholder="t('minutes.agenda_placeholder')"
                class="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                @change="onFieldChange(minute.id, 'agenda', $event)"
              />
            </label>
            <label class="flex flex-col gap-1 text-[12px] text-muted-foreground sm:col-span-2">
              {{ t('minutes.decisions') }}
              <textarea
                :value="minute.decisions ?? ''"
                rows="2"
                :placeholder="t('minutes.decisions_placeholder')"
                class="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                @change="onFieldChange(minute.id, 'decisions', $event)"
              />
            </label>
            <label class="flex flex-col gap-1 text-[12px] text-muted-foreground sm:col-span-2">
              {{ t('minutes.notes') }}
              <textarea
                :value="minute.notes ?? ''"
                rows="2"
                :placeholder="t('minutes.notes_placeholder')"
                class="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                @change="onFieldChange(minute.id, 'notes', $event)"
              />
            </label>
          </div>

          <!-- 行动项 -->
          <div class="mt-4">
            <p class="mb-2 text-[12px] font-semibold text-muted-foreground">{{ t('minutes.action_items') }}</p>
            <ul v-if="minute.actionItems.length" class="flex flex-col gap-1.5">
              <li
                v-for="item in minute.actionItems"
                :key="item.id"
                class="flex items-center gap-2"
                data-testid="minutes-action"
              >
                <button
                  type="button"
                  class="shrink-0 transition"
                  :class="item.done ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
                  :aria-label="item.done ? t('minutes.mark_undone') : t('minutes.mark_done')"
                  data-testid="minutes-action-toggle"
                  @click="storeToggleActionItem(minute.id, item.id)"
                >
                  <component :is="item.done ? CircleCheck : Circle" :size="16" />
                </button>
                <input
                  :value="item.text"
                  type="text"
                  class="h-8 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[13px] outline-none hover:border-border focus:border-primary"
                  :class="item.done ? 'text-muted-foreground line-through' : 'text-foreground'"
                  @change="
                    storeUpdateActionItem(minute.id, item.id, { text: ($event.target as HTMLInputElement).value })
                  "
                />
                <input
                  :value="item.assignee"
                  type="text"
                  class="h-8 w-24 shrink-0 rounded border border-transparent bg-transparent px-1 text-[12px] text-muted-foreground outline-none hover:border-border focus:border-primary"
                  :aria-label="t('minutes.assignee')"
                  @change="
                    storeUpdateActionItem(minute.id, item.id, { assignee: ($event.target as HTMLInputElement).value })
                  "
                />
                <button
                  type="button"
                  class="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  :aria-label="t('minutes.delete_action')"
                  @click="storeRemoveActionItem(minute.id, item.id)"
                >
                  <Trash2 :size="13" />
                </button>
              </li>
            </ul>
            <div class="mt-2 flex items-center gap-2">
              <input
                :value="actionDrafts[minute.id] ?? ''"
                type="text"
                :placeholder="t('minutes.add_action_placeholder')"
                class="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
                @input="actionDrafts = { ...actionDrafts, [minute.id]: ($event.target as HTMLInputElement).value }"
                @keyup.enter="submitActionItem(minute.id)"
              />
              <button
                type="button"
                class="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
                @click="submitActionItem(minute.id)"
              >
                <Plus :size="15" />{{ t('minutes.add') }}
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </WorkspacePageFrame>
</template>
