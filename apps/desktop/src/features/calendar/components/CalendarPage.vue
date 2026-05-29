<script setup lang="ts">
import type { CalendarEvent } from '../types/event';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Users } from 'lucide-vue-next';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import GroupMemberPicker from '@/features/contacts/components/GroupMemberPicker.vue';
import { projectRepo } from '@/features/projects/db/projectDb';
import { useContactList } from '@/shared/composables/useContactList';
import { useCalendarStore } from '../stores/calendarStore';

const { t } = useI18n();
const contactList = useContactList();
const calendarStore = useCalendarStore();

// ── View mode ──
type CalendarView = 'month' | 'week' | 'day';
const viewMode = ref<CalendarView>('month');

// ── Date state ──
const today = new Date();
const cursorDate = ref(new Date(today.getFullYear(), today.getMonth(), 1));
const selectedDate = ref(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

const cursorYear = computed(() => cursorDate.value.getFullYear());
const cursorMonth = computed(() => cursorDate.value.getMonth());

// ── Weekday labels ──
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// ── Navigation ──
function goToday() {
  cursorDate.value = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate.value = new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function prevMonth() {
  cursorDate.value = new Date(cursorYear.value, cursorMonth.value - 1, 1);
}

function nextMonth() {
  cursorDate.value = new Date(cursorYear.value, cursorMonth.value + 1, 1);
}

function prevWeek() {
  const d = new Date(selectedDate.value);
  d.setDate(d.getDate() - 7);
  selectedDate.value = d;
  cursorDate.value = new Date(d.getFullYear(), d.getMonth(), 1);
}

function nextWeek() {
  const d = new Date(selectedDate.value);
  d.setDate(d.getDate() + 7);
  selectedDate.value = d;
  cursorDate.value = new Date(d.getFullYear(), d.getMonth(), 1);
}

function prevDay() {
  const d = new Date(selectedDate.value);
  d.setDate(d.getDate() - 1);
  selectedDate.value = d;
  cursorDate.value = new Date(d.getFullYear(), d.getMonth(), 1);
}

function nextDay() {
  const d = new Date(selectedDate.value);
  d.setDate(d.getDate() + 1);
  selectedDate.value = d;
  cursorDate.value = new Date(d.getFullYear(), d.getMonth(), 1);
}

// ── Month label ──
const monthLabel = computed(() => {
  const y = cursorYear.value;
  const m = cursorMonth.value + 1;
  return `${y} 年 ${m} 月`;
});

// ── Week range label for week view ──
const weekStartDate = computed(() => {
  const d = new Date(selectedDate.value);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
});

const weekRangeLabel = computed(() => {
  const start = weekStartDate.value;
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(start)} - ${fmt(end)}`;
});

// ── Day label ──
const selectedDayLabel = computed(() => {
  const d = selectedDate.value;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`;
});

// ── Month grid ──
interface CalendarCell {
  date: number;
  fullDate: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

const monthGrid = computed(() => {
  const year = cursorYear.value;
  const month = cursorMonth.value;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];

  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const fullDate = new Date(year, month - 1, d);
    cells.push({
      date: d,
      fullDate,
      isCurrentMonth: false,
      isToday: isSameDay(fullDate, today),
      isSelected: isSameDay(fullDate, selectedDate.value),
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const fullDate = new Date(year, month, d);
    cells.push({
      date: d,
      fullDate,
      isCurrentMonth: true,
      isToday: isSameDay(fullDate, today),
      isSelected: isSameDay(fullDate, selectedDate.value),
    });
  }

  // Next month fill
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const fullDate = new Date(year, month + 1, d);
    cells.push({
      date: d,
      fullDate,
      isCurrentMonth: false,
      isToday: isSameDay(fullDate, today),
      isSelected: isSameDay(fullDate, selectedDate.value),
    });
  }

  return cells;
});

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Week grid (for week view: 7 columns × 24 hours) ──
const weekViewDays = computed(() => {
  const start = weekStartDate.value;
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
});

const dayViewHours = computed(() => {
  return Array.from({ length: 14 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`);
});

// ── Events ──
// 用户事件由持久化的 calendarStore 提供（跨会话保留）；项目任务事件只读派生自 projectRepo。
const projectTaskEvents = shallowRef<CalendarEvent[]>([]);

onMounted(async () => {
  contactList.ensureContactsLoaded();

  // Load project tasks asynchronously
  try {
    const projects = await projectRepo.listProjects();
    const results: CalendarEvent[] = [];
    for (const p of projects) {
      const items = await projectRepo.listWorkItems(p.id);
      for (const item of items) {
        if (item.dueDate) {
          const d = new Date(item.dueDate);
          results.push({
            id: `proj-${item.id}`,
            title: `${p.name}: ${item.title}`,
            date: fmtDate(d),
            time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            participants: '项目任务',
            color: 'violet',
            rsvpStatus: item.status,
          });
        }
      }
    }
    projectTaskEvents.value = results;
  } catch {
    /* Dexie unavailable */
  }
});

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const allEvents = computed(() => [...calendarStore.events, ...projectTaskEvents.value]);

// ── Events for a specific day ──
function eventsForDay(date: Date): CalendarEvent[] {
  const key = fmtDate(date);
  return allEvents.value.filter((e) => e.date === key);
}

const selectedDayEvents = computed(() => eventsForDay(selectedDate.value));

function eventsForCell(cell: CalendarCell): CalendarEvent[] {
  return eventsForDay(cell.fullDate);
}

const selectedEventId = ref<string>('');

const selectedEvent = computed(() => {
  return selectedDayEvents.value.find((e) => e.id === selectedEventId.value) ?? selectedDayEvents.value[0];
});

// ── Statistics cards ──
const statMeetings = computed(() => allEvents.value.filter((e) => e.rsvpStatus !== '无需回复').length);
const statPending = computed(() => allEvents.value.filter((e) => e.rsvpStatus === '待回复').length);
const statFocus = computed(() => allEvents.value.filter((e) => e.title.includes('专注')).length);

// ── Select day ──
function selectDay(date: Date) {
  selectedDate.value = date;
  selectedEventId.value = '';
}

// ── Event editor ──
const showEventEditor = ref(false);
const eventDraft = ref({
  title: '',
  date: '',
  time: '',
  endTime: '',
  participantIds: [] as string[],
});

function openNewEvent() {
  eventDraft.value = {
    title: '',
    date: fmtDate(selectedDate.value),
    time: '09:00',
    endTime: '10:00',
    participantIds: [],
  };
  showEventEditor.value = true;
}

function saveNewEvent() {
  if (!eventDraft.value.title.trim()) return;
  const participants =
    eventDraft.value.participantIds.length > 0
      ? eventDraft.value.participantIds
          .map((id) => contactList.contacts.find((c) => c.userId === id)?.displayName ?? id)
          .join('、')
      : '我';

  calendarStore.addEvent({
    title: eventDraft.value.title,
    date: eventDraft.value.date,
    time: eventDraft.value.time,
    endTime: eventDraft.value.endTime || undefined,
    participants,
  });

  showEventEditor.value = false;
}

// ── RSVP actions ──
function acceptEvent(event: CalendarEvent) {
  calendarStore.setRsvp(event.id, '已接受');
}

interface RescheduleDraft {
  date: string;
  time: string;
  endTime: string;
}

const showReschedule = ref(false);
const rescheduleDraft = ref<RescheduleDraft>({ date: '', time: '', endTime: '' });

function openReschedule(event: CalendarEvent) {
  rescheduleDraft.value = {
    date: event.date,
    time: event.time,
    endTime: event.endTime ?? event.time,
  };
  showReschedule.value = true;
}

function rescheduleConfirmDisabled(): boolean {
  const { date, time, endTime } = rescheduleDraft.value;
  return !date || !time || !endTime || endTime <= time;
}

function rescheduleEvent(event: CalendarEvent) {
  if (rescheduleConfirmDisabled()) return;
  const { date, time, endTime } = rescheduleDraft.value;
  calendarStore.reschedule(event.id, { date, time, endTime });
  const parts = date.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    selectedDate.value = new Date(parts[0], parts[1] - 1, parts[2]);
  }
  selectedEventId.value = event.id;
  showReschedule.value = false;
}

function colorBar(color: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    slate: 'bg-slate-400',
    violet: 'bg-violet-500',
  };
  return map[color] ?? 'bg-blue-500';
}

function colorBg(color: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600',
    orange: 'bg-orange-500/10 text-orange-600',
    green: 'bg-green-500/10 text-green-600',
    purple: 'bg-purple-500/10 text-purple-600',
    slate: 'bg-slate-400/10 text-slate-500',
    violet: 'bg-violet-500/10 text-violet-600',
  };
  return map[color] ?? 'bg-blue-500/10 text-blue-600';
}
</script>

<template>
  <WorkspacePageFrame :title="t('sidebar.calendar')" :subtitle="t('calendar.subtitle')" :icon="CalendarDays">
    <template #actions>
      <!-- 今天按钮 -->
      <button
        class="flex h-8 items-center rounded-md border border-border px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
        @click="goToday"
      >
        {{ t('calendar.today') }}
      </button>

      <!-- 导航箭头 -->
      <button
        v-if="viewMode === 'month'"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('calendar.prev_month')"
        @click="prevMonth"
      >
        <ChevronLeft :size="18" />
      </button>
      <button
        v-else-if="viewMode === 'week'"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('calendar.prev_week')"
        @click="prevWeek"
      >
        <ChevronLeft :size="18" />
      </button>
      <button
        v-else
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="prevDay"
      >
        <ChevronLeft :size="18" />
      </button>

      <!-- 日期标签 -->
      <span class="min-w-[120px] text-center text-[15px] font-semibold text-foreground">
        {{ viewMode === 'month' ? monthLabel : viewMode === 'week' ? weekRangeLabel : selectedDayLabel }}
      </span>

      <button
        v-if="viewMode === 'month'"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('calendar.next_month')"
        @click="nextMonth"
      >
        <ChevronRight :size="18" />
      </button>
      <button
        v-else-if="viewMode === 'week'"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('calendar.next_week')"
        @click="nextWeek"
      >
        <ChevronRight :size="18" />
      </button>
      <button
        v-else
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="nextDay"
      >
        <ChevronRight :size="18" />
      </button>

      <!-- 视图切换 -->
      <div class="flex items-center rounded-md border border-border p-0.5">
        <button
          v-for="mode in ['month', 'week', 'day'] as CalendarView[]"
          :key="mode"
          class="flex h-7 items-center rounded-sm px-3 text-[12px] font-medium transition-colors"
          :class="
            viewMode === mode
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="viewMode = mode"
        >
          {{
            mode === 'month'
              ? t('calendar.month_view')
              : mode === 'week'
                ? t('calendar.week_view')
                : t('calendar.day_view')
          }}
        </button>
      </div>

      <!-- 新建日程 -->
      <button
        class="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="openNewEvent"
      >
        <Plus :size="16" />
        <span>{{ t('calendar.new_event') }}</span>
      </button>
    </template>

    <!-- 统计卡片 -->
    <div class="grid gap-3 md:grid-cols-3">
      <div class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ t('calendar.stat_meetings') }}
        </div>
        <div class="mt-3 text-2xl font-semibold leading-8">
          {{ statMeetings }}
        </div>
        <p class="mt-1 text-[13px] text-muted-foreground">
          {{ t('calendar.stat_meetings_hint', { count: statPending }) }}
        </p>
      </div>
      <div class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ t('calendar.stat_focus') }}
        </div>
        <div class="mt-3 text-2xl font-semibold leading-8">{{ statFocus }}h</div>
        <p class="mt-1 text-[13px] text-muted-foreground">
          {{ t('calendar.stat_focus_hint', { count: statFocus }) }}
        </p>
      </div>
      <div class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ t('calendar.stat_conflicts') }}
        </div>
        <div class="mt-3 text-2xl font-semibold leading-8">
          {{ statPending }}
        </div>
        <p class="mt-1 text-[13px] text-muted-foreground">
          {{ t('calendar.stat_conflicts_hint', { count: statPending }) }}
        </p>
      </div>
    </div>

    <!-- 月视图 -->
    <div v-if="viewMode === 'month'" class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section class="workspace-surface overflow-hidden rounded-lg">
        <!-- 星期头部 -->
        <div class="grid grid-cols-7 border-b border-border">
          <div
            v-for="day in weekDays"
            :key="day"
            class="px-2 py-2 text-center text-[12px] font-semibold text-muted-foreground"
          >
            {{ day }}
          </div>
        </div>
        <!-- 月网格 -->
        <div class="grid grid-cols-7 auto-rows-fr">
          <button
            v-for="(cell, idx) in monthGrid"
            :key="idx"
            class="min-h-[80px] border-b border-r border-border p-1.5 text-left transition-colors hover:bg-accent/50"
            :class="[
              cell.isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : '',
              !cell.isCurrentMonth ? 'opacity-40' : '',
              (idx + 1) % 7 === 0 ? 'border-r-0' : '',
            ]"
            @click="selectDay(cell.fullDate)"
          >
            <span
              class="inline-flex size-6 items-center justify-center rounded-full text-[12px] font-semibold"
              :class="
                cell.isToday
                  ? 'bg-primary text-primary-foreground'
                  : cell.isSelected
                    ? 'text-primary'
                    : 'text-foreground'
              "
            >
              {{ cell.date }}
            </span>
            <!-- 事件指示器 -->
            <div class="mt-0.5 space-y-0.5">
              <div
                v-for="event in eventsForCell(cell).slice(0, 3)"
                :key="event.id"
                class="flex items-center gap-1 truncate rounded-sm px-1 py-px text-[11px] leading-tight"
                :class="colorBg(event.color)"
              >
                <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="colorBar(event.color)" />
                <span class="truncate">{{ event.title }}</span>
              </div>
              <div v-if="eventsForCell(cell).length > 3" class="pl-1 text-[10px] text-muted-foreground">
                +{{ eventsForCell(cell).length - 3 }} 更多
              </div>
            </div>
          </button>
        </div>
      </section>

      <!-- 事件详情侧边栏 -->
      <aside class="workspace-surface h-fit overflow-hidden rounded-lg">
        <div class="flex h-11 items-center border-b border-border px-4">
          <h2 class="text-[14px] font-semibold text-foreground">
            {{ selectedDayLabel }}
          </h2>
          <span class="ml-auto text-[12px] text-muted-foreground"> {{ selectedDayEvents.length }} 个日程 </span>
        </div>

        <div v-if="selectedDayEvents.length === 0" class="px-4 py-8 text-center">
          <CalendarDays :size="28" class="mx-auto mb-2 text-muted-foreground/40" />
          <p class="text-[13px] text-muted-foreground">
            {{ t('calendar.no_events') }}
          </p>
          <button
            class="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            @click="openNewEvent"
          >
            <Plus :size="14" />
            {{ t('calendar.add_event') }}
          </button>
        </div>

        <div v-else class="divide-y divide-border">
          <button
            v-for="event in selectedDayEvents"
            :key="event.id"
            :data-testid="`calendar-event-${event.id}`"
            class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
            :class="selectedEventId === event.id ? 'bg-primary/5' : ''"
            @click="selectedEventId = event.id"
          >
            <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="colorBar(event.color)" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-semibold text-foreground">
                {{ event.title }}
              </p>
              <div class="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
                <span class="inline-flex items-center gap-0.5">
                  <Clock :size="11" />
                  {{ event.time }}{{ event.endTime ? ` - ${event.endTime}` : '' }}
                </span>
                <span v-if="event.participants" class="inline-flex items-center gap-0.5">
                  <Users :size="11" />
                  {{ event.participants }}
                </span>
              </div>
            </div>
          </button>
        </div>

        <!-- 选中事件详情 & RSVP -->
        <div v-if="selectedEvent" class="border-t border-border px-4 py-3">
          <div class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {{ t('calendar.event_detail') }}
          </div>
          <h3 class="text-[15px] font-semibold text-foreground">
            {{ selectedEvent.title }}
          </h3>
          <div class="mt-2 grid gap-1.5 text-[12px] text-muted-foreground">
            <div class="flex items-center gap-1.5">
              <Clock :size="12" />
              <span data-testid="event-detail-time"
                >{{ selectedEvent.date }} {{ selectedEvent.time
                }}{{ selectedEvent.endTime ? ` - ${selectedEvent.endTime}` : '' }}</span
              >
            </div>
            <div class="flex items-center gap-1.5">
              <Users :size="12" />
              <span>{{ selectedEvent.participants }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <MapPin :size="12" />
              <span>{{ selectedEvent.rsvpStatus }}</span>
            </div>
          </div>

          <div class="mt-3 flex gap-2">
            <button
              class="h-8 flex-1 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              @click="acceptEvent(selectedEvent)"
            >
              {{ t('calendar.accept_attend') }}
            </button>
            <div class="relative">
              <button
                data-testid="event-reschedule-trigger"
                class="h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
                @click="openReschedule(selectedEvent)"
              >
                {{ t('calendar.reschedule') }}
              </button>
              <div
                v-if="showReschedule"
                class="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-card p-3 shadow-lg"
              >
                <label class="mb-1 block text-[11px] text-muted-foreground">{{ t('calendar.reschedule_date') }}</label>
                <input
                  v-model="rescheduleDraft.date"
                  data-testid="reschedule-date"
                  type="date"
                  class="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
                <div class="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label class="mb-1 block text-[11px] text-muted-foreground">{{
                      t('calendar.reschedule_start')
                    }}</label>
                    <input
                      v-model="rescheduleDraft.time"
                      data-testid="reschedule-start"
                      type="time"
                      class="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-[11px] text-muted-foreground">{{
                      t('calendar.reschedule_end')
                    }}</label>
                    <input
                      v-model="rescheduleDraft.endTime"
                      data-testid="reschedule-end"
                      type="time"
                      class="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <button
                  :title="rescheduleConfirmDisabled() ? t('calendar.reschedule_invalid_time') : ''"
                  :disabled="rescheduleConfirmDisabled() || undefined"
                  data-testid="reschedule-confirm"
                  class="mt-3 h-8 w-full rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  @click="rescheduleEvent(selectedEvent)"
                >
                  {{ t('calendar.reschedule_confirm') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- 周视图 -->
    <div v-if="viewMode === 'week'" class="workspace-surface overflow-hidden rounded-lg">
      <div class="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
        <div class="px-2 py-2" />
        <div
          v-for="(day, i) in weekViewDays"
          :key="i"
          class="px-2 py-2 text-center"
          :class="isSameDay(day, selectedDate) ? 'bg-primary/5' : ''"
          @click="selectDay(day)"
        >
          <div class="text-[11px] text-muted-foreground">
            {{ weekDays[day.getDay()] }}
          </div>
          <div
            class="mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-[14px] font-semibold"
            :class="isSameDay(day, today) ? 'bg-primary text-primary-foreground' : 'text-foreground'"
          >
            {{ day.getDate() }}
          </div>
        </div>
      </div>
      <div class="grid grid-cols-[60px_repeat(7,1fr)] overflow-y-auto" style="max-height: 500px">
        <template v-for="hour in dayViewHours" :key="hour">
          <div class="border-b border-r border-border px-2 py-1 text-right text-[10px] text-muted-foreground">
            {{ hour }}
          </div>
          <div
            v-for="(day, di) in weekViewDays"
            :key="`${hour}-${di}`"
            class="relative min-h-[36px] border-b border-r border-border"
            :class="[isSameDay(day, selectedDate) ? 'bg-primary/5' : '', di === 6 ? 'border-r-0' : '']"
          >
            <!-- 事件块 -->
            <div
              v-for="event in eventsForDay(day).filter((e) => e.time.startsWith(hour.slice(0, 2)))"
              :key="event.id"
              class="absolute inset-x-0.5 top-0 z-10 rounded-sm px-1.5 py-0.5 text-[10px] leading-tight"
              :class="colorBg(event.color)"
              :title="event.title"
            >
              {{ event.title }}
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 日视图 -->
    <div v-if="viewMode === 'day'" class="workspace-surface overflow-hidden rounded-lg">
      <div class="flex h-11 items-center border-b border-border px-4">
        <h2 class="text-[15px] font-semibold text-foreground">
          {{ selectedDayLabel }}
        </h2>
      </div>
      <div class="overflow-y-auto" style="max-height: 500px">
        <div v-for="hour in dayViewHours" :key="hour" class="flex border-b border-border">
          <div
            class="w-[60px] shrink-0 border-r border-border px-2 py-1.5 text-right text-[11px] text-muted-foreground"
          >
            {{ hour }}
          </div>
          <div class="relative min-h-[40px] flex-1">
            <div
              v-for="event in eventsForDay(selectedDate).filter((e) => e.time.startsWith(hour.slice(0, 2)))"
              :key="event.id"
              class="mx-1 my-0.5 rounded-sm px-3 py-1.5"
              :class="colorBg(event.color)"
            >
              <div class="text-[13px] font-semibold">
                {{ event.title }}
              </div>
              <div class="mt-0.5 flex items-center gap-2 text-[11px] opacity-70">
                <span>{{ event.time }}{{ event.endTime ? ` - ${event.endTime}` : '' }}</span>
                <span v-if="event.participants">{{ event.participants }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建日程弹窗 -->
    <Teleport to="body">
      <div
        v-if="showEventEditor"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        @click.self="showEventEditor = false"
      >
        <div class="w-[400px] rounded-xl bg-card p-5 shadow-xl">
          <h3 class="mb-4 text-[16px] font-semibold">
            {{ t('calendar.new_event') }}
          </h3>
          <div class="grid gap-3">
            <input
              v-model="eventDraft.title"
              type="text"
              :placeholder="t('calendar.event_title_placeholder')"
              class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
            />
            <div class="grid grid-cols-2 gap-2">
              <input
                v-model="eventDraft.date"
                type="date"
                class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              />
              <input
                v-model="eventDraft.time"
                type="time"
                class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              />
            </div>
            <GroupMemberPicker v-model="eventDraft.participantIds" label="参与人" />
            <div class="flex justify-end gap-2 pt-1">
              <button
                class="h-8 rounded-md border border-border px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                @click="showEventEditor = false"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                class="h-8 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                @click="saveNewEvent"
              >
                {{ t('calendar.save_event') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </WorkspacePageFrame>
</template>
