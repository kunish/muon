<script setup lang="ts">
import type { Announcement } from '../types/announcement';
import { useSelector } from '@tanstack/vue-store';
import { CheckCheck, ChevronDown, Megaphone, Pin, PinOff, Plus, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  announcementStore,
  selectAnnouncements,
  addAnnouncement as storeAddAnnouncement,
  markAllRead as storeMarkAllRead,
  markRead as storeMarkRead,
  removeAnnouncement as storeRemoveAnnouncement,
  togglePin as storeTogglePin,
} from '../stores/announcementStore';
import { compareAnnouncements, unreadCount } from '../types/announcement';

const { t } = useI18n();

const announcements = useSelector(announcementStore, selectAnnouncements);

const sorted = computed(() => [...announcements.value].sort(compareAnnouncements));
const unread = computed(() => unreadCount(announcements.value));

function formatDate(ts: number): string {
  const date = new Date(ts);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

// ── 发布公告 ──
const composerOpen = shallowRef(false);
const draftTitle = shallowRef('');
const draftBody = shallowRef('');
const draftPinned = shallowRef(false);

function openComposer(): void {
  draftTitle.value = '';
  draftBody.value = '';
  draftPinned.value = false;
  composerOpen.value = true;
}

function submitAnnouncement(): void {
  const title = draftTitle.value.trim();
  if (!title) {
    toast.error(t('announcements.title_required'));
    return;
  }
  storeAddAnnouncement({ title, body: draftBody.value, pinned: draftPinned.value, read: true });
  composerOpen.value = false;
  toast.success(t('announcements.published'));
}

function deleteAnnouncement(announcement: Announcement): void {
  storeRemoveAnnouncement(announcement.id);
  toast.success(t('announcements.deleted'));
}

function markAllRead(): void {
  storeMarkAllRead();
  toast.success(t('announcements.all_read'));
}

// ── 展开（展开即标记已读） ──
const expandedId = shallowRef<string | null>(null);
function toggleExpanded(id: string): void {
  if (expandedId.value === id) {
    expandedId.value = null;
    return;
  }
  expandedId.value = id;
  storeMarkRead(id);
}

// 全局搜索深链：?focus=<announcementId> 时展开该公告并标记已读。
// route 在无路由上下文（如部分组件测试）可能为 undefined，防御式读取。
const route = useRoute();
onMounted(() => {
  const focusParam = route?.query?.focus;
  const focus = typeof focusParam === 'string' ? focusParam : null;
  if (focus && announcements.value.some((item) => item.id === focus)) {
    expandedId.value = focus;
    storeMarkRead(focus);
  }
});
</script>

<template>
  <WorkspacePageFrame :title="t('announcements.title')" :subtitle="t('announcements.subtitle')" :icon="Megaphone">
    <template #actions>
      <span v-if="unread > 0" class="text-[13px] text-muted-foreground">{{
        t('announcements.unread', { count: unread })
      }}</span>
      <button
        v-if="unread > 0"
        type="button"
        class="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
        data-testid="announcements-mark-all"
        @click="markAllRead"
      >
        <CheckCheck :size="15" />{{ t('announcements.mark_all') }}
      </button>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
        data-testid="announcements-new"
        @click="openComposer"
      >
        <Plus :size="16" />{{ t('announcements.publish') }}
      </button>
    </template>

    <!-- 发布面板 -->
    <div v-if="composerOpen" class="flex flex-col gap-2 rounded-xl border border-border bg-sidebar p-4">
      <input
        v-model="draftTitle"
        type="text"
        :placeholder="t('announcements.title_placeholder')"
        class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
        data-testid="announcements-draft-title"
      />
      <textarea
        v-model="draftBody"
        rows="3"
        :placeholder="t('announcements.body_placeholder')"
        class="rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
      />
      <div class="flex items-center justify-between">
        <label class="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <input v-model="draftPinned" type="checkbox" class="size-4 accent-primary" />{{ t('announcements.pin') }}
        </label>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="h-9 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
            @click="composerOpen = false"
          >
            {{ t('announcements.cancel') }}
          </button>
          <button
            type="button"
            class="h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
            data-testid="announcements-submit"
            @click="submitAnnouncement"
          >
            {{ t('announcements.submit') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="sorted.length === 0"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center"
      data-testid="announcements-empty"
    >
      <Megaphone :size="28" class="text-muted-foreground" />
      <p class="text-[14px] font-medium text-foreground">{{ t('announcements.empty_title') }}</p>
      <p class="text-[13px] text-muted-foreground">{{ t('announcements.empty_hint') }}</p>
    </div>

    <!-- 公告列表 -->
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="announcement in sorted"
        :key="announcement.id"
        class="rounded-xl border border-border bg-card"
        :data-testid="`announcements-item-${announcement.id}`"
      >
        <div class="flex items-center gap-3 p-4">
          <button
            type="button"
            class="shrink-0 text-muted-foreground transition hover:text-foreground"
            :aria-label="expandedId === announcement.id ? t('announcements.collapse') : t('announcements.expand')"
            @click="toggleExpanded(announcement.id)"
          >
            <ChevronDown
              :size="18"
              class="transition-transform"
              :class="expandedId === announcement.id ? '' : '-rotate-90'"
            />
          </button>
          <span
            v-if="!announcement.read"
            class="size-2 shrink-0 rounded-full bg-primary"
            data-testid="announcements-unread-dot"
            :aria-label="t('announcements.unread_label')"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <Pin v-if="announcement.pinned" :size="13" class="shrink-0 text-warning" />
              <h3
                class="truncate text-[14px] font-medium text-foreground"
                :class="announcement.read ? '' : 'font-semibold'"
              >
                {{ announcement.title }}
              </h3>
            </div>
            <p class="mt-0.5 text-[12px] text-muted-foreground">
              {{ announcement.author }} · {{ formatDate(announcement.createdAt) }}
            </p>
          </div>
          <button
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent/40 hover:text-foreground"
            :aria-label="announcement.pinned ? t('announcements.unpin') : t('announcements.pin')"
            :data-testid="`announcements-pin-${announcement.id}`"
            @click="storeTogglePin(announcement.id)"
          >
            <component :is="announcement.pinned ? PinOff : Pin" :size="15" />
          </button>
          <button
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            :aria-label="t('announcements.delete')"
            @click="deleteAnnouncement(announcement)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
        <div
          v-if="expandedId === announcement.id"
          class="whitespace-pre-wrap border-t border-border p-4 text-[13px] text-foreground"
        >
          {{ announcement.body || t('announcements.empty_body') }}
        </div>
      </li>
    </ul>
  </WorkspacePageFrame>
</template>
