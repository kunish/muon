<script setup lang="ts">
import type { CalendarEvent, EventRecurrence, RecurrenceFreq } from '../types/event';
import { useSelector } from '@tanstack/vue-store';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  Plus,
  Rss,
  Trash2,
  Upload,
  Users,
  Video,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import { openUrl } from '@/desktop/opener';
import GroupMemberPicker from '@/features/contacts/components/GroupMemberPicker.vue';
import { projectRepo } from '@/features/projects/db/projectDb';
import { addBooking as addRoomBooking, roomStore, selectRooms } from '@/features/rooms/stores/roomStore';
import { useContactList } from '@/shared/composables/useContactList';
import { triggerBlobDownload } from '@/shared/lib/download';
import { useCalendarSubscriptions } from '../composables/useCalendarSubscriptions';
import { eventsToIcs, parseIcs } from '../lib/ics';
import {
  addEvent as addCalendarEvent,
  calendarStore,
  reschedule as rescheduleCalendarEvent,
  selectEvents,
  setRsvp as setCalendarRsvp,
} from '../stores/calendarStore';
import { expandRecurringEvents } from '../types/event';

const { t } = useI18n();
const contactList = useContactList();
const calendarEvents = useSelector(calendarStore, selectEvents);
const subscriptions = useCalendarSubscriptions();

const icsInput = ref<HTMLInputElement | null>(null);
const subscriptionPanelOpen = ref(false);
const subscriptionUrlDraft = ref('');

function addCalendarSubscription(): void {
  if (subscriptions.addSubscription(subscriptionUrlDraft.value)) {
    subscriptionUrlDraft.value = '';
    void syncCalendarSubscriptions();
  }
}

async function syncCalendarSubscriptions(): Promise<void> {
  const synced = await subscriptions.syncAll();
  if (synced > 0) toast.success(t('calendar.subscriptions_synced', { count: synced }));
}

function exportIcs(): void {
  const ics = eventsToIcs(calendarStore.state.events, Date.now());
  triggerBlobDownload(new Blob([ics], { type: 'text/calendar' }), 'muon-calendar.ics');
}

function pickIcs(): void {
  icsInput.value?.click();
}

async function onIcsSelected(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (icsInput.value) icsInput.value.value = '';
  if (!file) return;
  try {
    const parsed = parseIcs(await file.text());
    for (const item of parsed) addCalendarEvent(item);
    toast.success(t('calendar.import_done', { count: parsed.length }));
  } catch {
    toast.error(t('calendar.import_failed'));
  }
}

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

// 提醒去重集合与定时器（声明在 onMounted 之前以满足 no-use-before-define）
const firedReminders = new Set<string>();
let reminderTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  contactList.ensureContactsLoaded();
  void syncCalendarSubscriptions();

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

  checkReminders();
  reminderTimer = setInterval(checkReminders, 30_000);
});

onUnmounted(() => {
  if (reminderTimer) clearInterval(reminderTimer);
});

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const allEvents = computed(() => [...calendarEvents.value, ...projectTaskEvents.value]);

// 把重复日程展开为可见范围（月视图 42 格覆盖周/日视图常见导航）内的具体实例
const expandedEvents = computed(() => {
  const cells = monthGrid.value;
  if (cells.length === 0) return allEvents.value;
  const rangeStart = fmtDate(cells[0].fullDate);
  const rangeEnd = fmtDate(cells[cells.length - 1].fullDate);
  return expandRecurringEvents(allEvents.value, rangeStart, rangeEnd);
});

// ── Events for a specific day ──
function eventsForDay(date: Date): CalendarEvent[] {
  const key = fmtDate(date);
  return expandedEvents.value.filter((e) => e.date === key);
}

const selectedDayEvents = computed(() => eventsForDay(selectedDate.value));

function eventsForCell(cell: CalendarCell): CalendarEvent[] {
  return eventsForDay(cell.fullDate);
}

const selectedEventId = ref<string>('');

const selectedEvent = computed(() => {
  return selectedDayEvents.value.find((e) => e.id === selectedEventId.value) ?? selectedDayEvents.value[0];
});

// 全局搜索深链：?focus=<eventId> 时跳到该日程所在日期并选中它。
// route 在无路由上下文（如部分组件测试）可能为 undefined，防御式读取。
const route = useRoute();
onMounted(() => {
  const focusParam = route?.query?.focus;
  const focus = typeof focusParam === 'string' ? focusParam : null;
  if (!focus) return;
  const event = calendarStore.state.events.find((item) => item.id === focus);
  if (!event) return;
  const [year, month, day] = event.date.split('-').map(Number);
  // 同时切换月份游标，使该日程所在月进入可见范围（expandedEvents 依赖 monthGrid）。
  cursorDate.value = new Date(year, month - 1, 1);
  selectedDate.value = new Date(year, month - 1, day);
  selectedEventId.value = event.id;
});

// 项目任务事件（proj-*）只存在于 projectTaskEvents，不在 calendarStore，无法接受/改期
const isProjectEvent = computed(() => selectedEvent.value?.id.startsWith('proj-') ?? false);

// ── Statistics cards ──
const statMeetings = computed(() => allEvents.value.filter((e) => e.rsvpStatus !== '无需回复').length);
const statPending = computed(() => allEvents.value.filter((e) => e.rsvpStatus === '待回复').length);
const statFocus = computed(() => allEvents.value.filter((e) => e.title.includes('专注')).length);

// ── 冲突检测：同一天内时间区间相互重叠的日程数 ──
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

const statConflicts = computed(() => {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of allEvents.value) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }

  const conflicting = new Set<string>();
  for (const list of byDate.values()) {
    if (list.length < 2) continue;
    const spans = list.map((event) => {
      const start = timeToMinutes(event.time);
      const end = event.endTime ? timeToMinutes(event.endTime) : start + 60;
      return { id: event.id, start, end: Math.max(end, start) };
    });
    for (let i = 0; i < spans.length; i += 1) {
      for (let j = i + 1; j < spans.length; j += 1) {
        if (spans[i].start < spans[j].end && spans[j].start < spans[i].end) {
          conflicting.add(spans[i].id);
          conflicting.add(spans[j].id);
        }
      }
    }
  }
  return conflicting.size;
});

// ── Select day ──
function selectDay(date: Date) {
  selectedDate.value = date;
  selectedEventId.value = '';
}

// ── Event editor ──
const showEventEditor = ref(false);
type RecurrenceChoice = 'none' | RecurrenceFreq;

const meetingRooms = useSelector(roomStore, selectRooms);

const eventDraft = ref({
  title: '',
  date: '',
  time: '',
  endTime: '',
  participantIds: [] as string[],
  location: '',
  roomId: '',
  meetingUrl: '',
  recurrence: 'none' as RecurrenceChoice,
  reminderMinutes: 0,
});

const recurrenceOptions: { value: RecurrenceChoice; labelKey: string }[] = [
  { value: 'none', labelKey: 'calendar.repeat_none' },
  { value: 'daily', labelKey: 'calendar.repeat_daily' },
  { value: 'weekly', labelKey: 'calendar.repeat_weekly' },
  { value: 'monthly', labelKey: 'calendar.repeat_monthly' },
];

const reminderOptions: { value: number; labelKey: string }[] = [
  { value: 0, labelKey: 'calendar.reminder_none' },
  { value: 5, labelKey: 'calendar.reminder_5' },
  { value: 15, labelKey: 'calendar.reminder_15' },
  { value: 30, labelKey: 'calendar.reminder_30' },
  { value: 60, labelKey: 'calendar.reminder_60' },
];

const TIME_PATTERN = /^\d{2}:\d{2}$/;

function addMinutesToTime(hhmm: string, minutes: number): string {
  const [hours, mins] = hhmm.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, hours * 60 + mins + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function openNewEvent() {
  eventDraft.value = {
    title: '',
    date: fmtDate(selectedDate.value),
    time: '09:00',
    endTime: '10:00',
    participantIds: [],
    location: '',
    roomId: '',
    meetingUrl: '',
    recurrence: 'none',
    reminderMinutes: 0,
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

  const recurrence: EventRecurrence | undefined =
    eventDraft.value.recurrence === 'none' ? undefined : { freq: eventDraft.value.recurrence };

  const title = eventDraft.value.title;

  // 选了会议室则同步创建一条预定；冲突时响亮失败并中止，避免静默忽略所选会议室。
  // 表单仅暴露开始时间，结束时间不合法则按开始 +1 小时派生，保证预定时段有效。
  let location = eventDraft.value.location;
  if (eventDraft.value.roomId) {
    const room = meetingRooms.value.find((item) => item.id === eventDraft.value.roomId);
    const start = eventDraft.value.time;
    if (!room || !TIME_PATTERN.test(start)) {
      toast.error(t('calendar.room_booking_invalid'));
      return;
    }
    const rawEnd = eventDraft.value.endTime;
    const end = TIME_PATTERN.test(rawEnd) && rawEnd > start ? rawEnd : addMinutesToTime(start, 60);
    try {
      addRoomBooking({ roomId: room.id, title, date: eventDraft.value.date, start, end, organizer: '我' });
      location = room.name;
    } catch {
      toast.error(t('calendar.room_booking_conflict'));
      return;
    }
  }

  addCalendarEvent({
    title,
    date: eventDraft.value.date,
    time: eventDraft.value.time,
    endTime: eventDraft.value.endTime || undefined,
    participants,
    location,
    meetingUrl: eventDraft.value.meetingUrl,
    recurrence,
    reminderMinutes: eventDraft.value.reminderMinutes > 0 ? eventDraft.value.reminderMinutes : undefined,
  });

  showEventEditor.value = false;
  toast.success(t('calendar.notice_created', { title }));
}

// ── 一键入会 ──
async function joinMeeting(event: CalendarEvent) {
  if (!event.meetingUrl) return;
  await openUrl(event.meetingUrl);
}

// ── 日程提醒（应用打开时，开会前 N 分钟桌面提醒；按发生实例去重） ──
function checkReminders(): void {
  const NotificationCtor = globalThis.Notification;
  if (typeof NotificationCtor !== 'function' || NotificationCtor.permission !== 'granted') return;

  const now = Date.now();
  const todayKey = fmtDate(new Date(now));
  const tomorrowKey = fmtDate(new Date(now + 24 * 60 * 60 * 1000));
  for (const occurrence of expandRecurringEvents(allEvents.value, todayKey, tomorrowKey)) {
    if (!occurrence.reminderMinutes) continue;
    const start = new Date(`${occurrence.date}T${occurrence.time}:00`).getTime();
    if (Number.isNaN(start)) continue;
    const remindAt = start - occurrence.reminderMinutes * 60_000;
    const key = `${occurrence.id}::${occurrence.date}::${occurrence.time}`;
    if (now >= remindAt && now < start && !firedReminders.has(key)) {
      firedReminders.add(key);
      const detail = occurrence.location ? `${occurrence.time} · ${occurrence.location}` : occurrence.time;
      void new NotificationCtor(occurrence.title, { body: t('calendar.reminder_body', { detail }), tag: key });
    }
  }
}

// ── RSVP actions ──
function acceptEvent(event: CalendarEvent) {
  setCalendarRsvp(event.id, '已接受');
  toast.success(t('calendar.notice_accepted', { title: event.title }));
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
  rescheduleCalendarEvent(event.id, { date, time, endTime });
  const parts = date.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    selectedDate.value = new Date(parts[0], parts[1] - 1, parts[2]);
  }
  selectedEventId.value = event.id;
  showReschedule.value = false;
  toast.success(t('calendar.notice_rescheduled', { title: event.title }));
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

      <!-- 导入 / 导出 iCalendar -->
      <button
        class="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('calendar.import_ics')"
        data-testid="calendar-import-ics"
        @click="pickIcs"
      >
        <Upload :size="16" />
      </button>
      <button
        class="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('calendar.export_ics')"
        data-testid="calendar-export-ics"
        @click="exportIcs"
      >
        <Download :size="16" />
      </button>
      <button
        class="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('calendar.subscriptions_title')"
        data-testid="calendar-subscribe"
        @click="subscriptionPanelOpen = true"
      >
        <Rss :size="16" />
      </button>
      <input
        ref="icsInput"
        type="file"
        accept=".ics,text/calendar"
        class="hidden"
        data-testid="calendar-ics-input"
        @change="onIcsSelected"
      />

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
          {{ statConflicts }}
        </div>
        <p class="mt-1 text-[13px] text-muted-foreground">
          {{ t('calendar.stat_conflicts_hint', { count: statConflicts }) }}
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
              <span data-testid="event-detail-location">{{ selectedEvent.location || t('calendar.no_location') }}</span>
            </div>
          </div>

          <button
            v-if="selectedEvent.meetingUrl"
            data-testid="event-join-meeting"
            class="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            @click="joinMeeting(selectedEvent)"
          >
            <Video :size="14" />
            <span>{{ t('calendar.join_meeting') }}</span>
          </button>

          <div v-if="!isProjectEvent" class="mt-3 flex gap-2">
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
            <input
              v-model="eventDraft.location"
              data-testid="event-location-input"
              type="text"
              :placeholder="t('calendar.location_placeholder')"
              class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
            />
            <select
              v-if="meetingRooms.length"
              v-model="eventDraft.roomId"
              data-testid="event-room-select"
              class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
            >
              <option value="">{{ t('calendar.room_none') }}</option>
              <option v-for="room in meetingRooms" :key="room.id" :value="room.id">{{ room.name }}</option>
            </select>
            <input
              v-model="eventDraft.meetingUrl"
              data-testid="event-meeting-url-input"
              type="url"
              :placeholder="t('calendar.meeting_url_placeholder')"
              class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
            />
            <div class="grid grid-cols-2 gap-2">
              <label class="grid gap-1 text-[11px] text-muted-foreground">
                {{ t('calendar.repeat_label') }}
                <select
                  v-model="eventDraft.recurrence"
                  data-testid="event-recurrence-select"
                  class="h-9 rounded-md border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
                >
                  <option v-for="option in recurrenceOptions" :key="option.value" :value="option.value">
                    {{ t(option.labelKey) }}
                  </option>
                </select>
              </label>
              <label class="grid gap-1 text-[11px] text-muted-foreground">
                {{ t('calendar.reminder_label') }}
                <select
                  v-model.number="eventDraft.reminderMinutes"
                  data-testid="event-reminder-select"
                  class="h-9 rounded-md border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
                >
                  <option v-for="option in reminderOptions" :key="option.value" :value="option.value">
                    {{ t(option.labelKey) }}
                  </option>
                </select>
              </label>
            </div>
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

    <!-- 订阅外部日历(iCal URL,实时同步) -->
    <div
      v-if="subscriptionPanelOpen"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      data-testid="calendar-subscription-panel"
      @click.self="subscriptionPanelOpen = false"
    >
      <div class="w-[420px] rounded-lg border border-border bg-popover p-4 shadow-2xl">
        <h2 class="mb-1 text-[15px] font-semibold text-foreground">{{ t('calendar.subscriptions_title') }}</h2>
        <p class="mb-3 text-[12px] text-muted-foreground">{{ t('calendar.subscriptions_hint') }}</p>
        <div class="flex gap-2">
          <input
            v-model="subscriptionUrlDraft"
            data-testid="calendar-subscription-url"
            type="url"
            :placeholder="t('calendar.subscription_url_placeholder')"
            class="h-8 flex-1 rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:border-primary"
            @keydown.enter="addCalendarSubscription"
          />
          <button
            data-testid="calendar-subscription-add"
            class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            @click="addCalendarSubscription"
          >
            {{ t('calendar.subscribe') }}
          </button>
        </div>

        <div v-if="subscriptions.subscriptions.value.length > 0" class="mt-3 grid gap-1">
          <div
            v-for="sub in subscriptions.subscriptions.value"
            :key="sub.id"
            class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
          >
            <span class="min-w-0 flex-1 truncate text-[12px] text-foreground">{{ sub.url }}</span>
            <button
              :data-testid="`calendar-subscription-remove-${sub.id}`"
              class="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              :title="t('calendar.remove_subscription')"
              @click="subscriptions.removeSubscription(sub.id)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
        <p v-else class="mt-3 text-[12px] text-muted-foreground" data-testid="calendar-subscription-empty">
          {{ t('calendar.no_subscriptions') }}
        </p>

        <div class="mt-4 flex justify-between">
          <button
            data-testid="calendar-subscription-sync"
            class="h-8 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            :disabled="subscriptions.syncing.value"
            @click="syncCalendarSubscriptions"
          >
            {{ t('calendar.sync_now') }}
          </button>
          <button
            class="h-8 rounded-md px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            @click="subscriptionPanelOpen = false"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </WorkspacePageFrame>
</template>
