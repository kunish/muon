<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue'
import GroupMemberPicker from '@/features/contacts/components/GroupMemberPicker.vue'
import { projectRepo } from '@/features/projects/db/projectDb'
import { useContactList } from '@/shared/composables/useContactList'

const { t } = useI18n()
const contactList = useContactList()

const weekIndex = shallowRef(0)
const selectedDayName = shallowRef('周三')
const selectedEventId = shallowRef('event-1')
const eventActionNotices = shallowRef<Record<string, string>>({})
const eventEditorOpen = shallowRef(false)
const eventDraftId = shallowRef('')
const eventDraftTitle = shallowRef('临时日程')
const eventDraftTeam = shallowRef('我')
const eventDraftParticipantIds = ref<string[]>([])
const eventDraftTime = shallowRef('17:30')

const weekRanges = ['4月20日 - 4月24日', '4月27日 - 5月1日', '5月4日 - 5月8日']

const baseWeekDays = [
  { day: '周一', date: 20, busy: 2 },
  { day: '周二', date: 21, busy: 5 },
  { day: '周三', date: 22, busy: 3 },
  { day: '周四', date: 23, busy: 4 },
  { day: '周五', date: 24, busy: 1 },
]

interface CalendarEventEntry {
  id: string
  dayName: string
  time: string
  title: string
  team: string
  tone: string
  rsvpStatus: string
  suggestion: string
}

const events = shallowRef<CalendarEventEntry[]>([
  { id: 'event-1', dayName: '周三', time: '09:30', title: '产品周会', team: '产品团队', tone: 'bg-primary', rsvpStatus: '待回复', suggestion: '无冲突' },
  { id: 'event-2', dayName: '周三', time: '11:00', title: '设计评审', team: '设计团队', tone: 'bg-warning', rsvpStatus: '待回复', suggestion: '周三 15:00' },
  { id: 'event-3', dayName: '周四', time: '14:30', title: '发布准备会', team: '工程团队', tone: 'bg-success', rsvpStatus: '待回复', suggestion: '周四 10:00' },
  { id: 'event-4', dayName: '周五', time: '16:00', title: '专注时间', team: '个人', tone: 'bg-muted-foreground', rsvpStatus: '无需回复', suggestion: '固定时段' },
])

const projectTaskEvents = shallowRef<CalendarEventEntry[]>([])

onMounted(async () => {
  contactList.ensureContactsLoaded()
  try {
    const projects = await projectRepo.listProjects()
    const results: CalendarEventEntry[] = []
    for (const p of projects) {
      const items = await projectRepo.listWorkItems(p.id)
      for (const item of items) {
        if (item.dueDate) {
          const d = new Date(item.dueDate)
          const dayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
          results.push({
            id: `project-task-${item.id}`,
            dayName: dayMap[d.getDay()],
            time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            title: `${p.name}: ${item.title}`,
            team: '项目任务',
            tone: 'bg-violet-500',
            rsvpStatus: item.status,
            suggestion: '',
          })
        }
      }
    }
    projectTaskEvents.value = results
  }
  catch {
    // Dexie may not be available (e.g., in tests or SSR)
  }
})

const allEvents = computed(() => [...events.value, ...projectTaskEvents.value])

const weekRange = computed(() => weekRanges[weekIndex.value] ?? weekRanges[0])

const weekDays = computed(() => {
  const offset = weekIndex.value * 7
  return baseWeekDays.map(day => ({
    ...day,
    date: `${day.date + offset}`,
    active: day.day === selectedDayName.value,
    busy: day.busy + (weekIndex.value === 0 ? 0 : 1),
  }))
})

const selectedDay = computed(() => weekDays.value.find(day => day.day === selectedDayName.value) ?? weekDays.value[0])
const selectedDayLabel = computed(() => t('calendar.day_label', { weekday: selectedDay.value.day, date: selectedDay.value.date }))
const selectedDayEvents = computed(() => allEvents.value.filter(event => event.dayName === selectedDayName.value))
const selectedEvent = computed(() => selectedDayEvents.value.find(event => event.id === selectedEventId.value) ?? selectedDayEvents.value[0] ?? allEvents.value[0])
const eventsNeedingPreparationCount = computed(() => allEvents.value.filter(event => event.rsvpStatus === '待回复').length)
const focusEventCount = computed(() => allEvents.value.filter(event => event.title === '专注时间').length)
const focusHours = computed(() => `${focusEventCount.value * 4}h`)
const conflictEventCount = computed(() => allEvents.value.filter(event => event.suggestion && !['无冲突', '固定时段'].includes(event.suggestion)).length)
const selectedEventActionNotice = computed(() => {
  const event = selectedEvent.value
  if (!event)
    return '等待处理当前日程'
  return eventActionNotices.value[event.id] ?? '等待处理当前日程'
})

function previousWeek(): void {
  weekIndex.value = Math.max(0, weekIndex.value - 1)
}

function nextWeek(): void {
  weekIndex.value = Math.min(weekRanges.length - 1, weekIndex.value + 1)
}

function createEvent(): void {
  const eventId = `event-${Date.now()}`
  eventEditorOpen.value = true
  eventDraftId.value = eventId
  eventDraftTitle.value = '临时日程'
  eventDraftTeam.value = '我'
  eventDraftParticipantIds.value = []
  eventDraftTime.value = '17:30'
  contactList.ensureContactsLoaded()
  events.value = [
    { id: eventId, dayName: selectedDayName.value, time: '17:30', title: '临时日程', team: '我', tone: 'bg-primary', rsvpStatus: '已创建', suggestion: '无冲突' },
    ...events.value,
  ]
  selectedEventId.value = eventId
}

function selectDay(dayName: string): void {
  selectedDayName.value = dayName
  selectedEventId.value = allEvents.value.find(event => event.dayName === dayName)?.id ?? ''
}

function selectEvent(eventId: string): void {
  selectedEventId.value = eventId
}

function acceptSelectedEvent(): void {
  const event = selectedEvent.value
  if (!event)
    return

  events.value = events.value.map(item => item.id === event.id
    ? { ...item, rsvpStatus: '已接受' }
    : item)
  eventActionNotices.value = { ...eventActionNotices.value, [event.id]: `已接受：${event.title}` }
}

function rescheduleSelectedEvent(): void {
  const event = selectedEvent.value
  if (!event)
    return

  events.value = events.value.map(item => item.id === event.id
    ? { ...item, time: '15:00', suggestion: '周三 15:00' }
    : item)
  eventActionNotices.value = { ...eventActionNotices.value, [event.id]: `已改期：${event.title}` }
}

function fallbackNameFromUserId(userId: string): string {
  return userId.split(':')[0]?.replace(/^@/, '') || userId
}

function displayNameForUserId(userId: string): string {
  return contactList.contacts.find(contact => contact.userId === userId)?.displayName ?? fallbackNameFromUserId(userId)
}

function saveDraftEvent(): void {
  if (!eventEditorOpen.value)
    return

  const eventId = eventDraftId.value
  const title = eventDraftTitle.value.trim() || '临时日程'
  const team = eventDraftParticipantIds.value.length > 0
    ? eventDraftParticipantIds.value.map(displayNameForUserId).join('、')
    : eventDraftTeam.value.trim() || '我'
  const time = eventDraftTime.value.trim() || '17:30'

  events.value = events.value.map(item => item.id === eventId
    ? {
        ...item,
        title,
        team,
        time,
        rsvpStatus: '待回复',
      }
    : item)
  selectedEventId.value = eventId
  eventActionNotices.value = { ...eventActionNotices.value, [eventId]: `已新建日程：${title}` }
  eventEditorOpen.value = false
  eventDraftParticipantIds.value = []
}
</script>

<template>
  <WorkspacePageFrame
    :title="t('sidebar.calendar')"
    :subtitle="t('calendar.subtitle')"
    :icon="CalendarDays"
  >
    <template #actions>
      <button
        data-testid="calendar-prev-week"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('calendar.prev_week')"
        @click="previousWeek"
      >
        <ChevronLeft :size="18" />
      </button>
      <button
        data-testid="calendar-next-week"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('calendar.next_week')"
        @click="nextWeek"
      >
        <ChevronRight :size="18" />
      </button>
      <button
        data-testid="calendar-new-event"
        class="flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="createEvent"
      >
        <Plus :size="16" />
        <span>{{ t('calendar.new_event') }}</span>
      </button>
    </template>

    <div class="grid gap-3 md:grid-cols-3">
      <div class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ t('calendar.stat_meetings') }}
        </div>
        <div
          class="mt-3 text-2xl font-semibold leading-8"
          data-testid="calendar-stat-meetings"
        >
          {{ allEvents.length }}
        </div>
        <p
          class="mt-1 text-[13px] text-muted-foreground"
          data-testid="calendar-stat-meetings-hint"
        >
          {{ t('calendar.stat_meetings_hint', { count: eventsNeedingPreparationCount }) }}
        </p>
      </div>
      <div class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ t('calendar.stat_focus') }}
        </div>
        <div
          class="mt-3 text-2xl font-semibold leading-8"
          data-testid="calendar-stat-focus-hours"
        >
          {{ focusHours }}
        </div>
        <p
          class="mt-1 text-[13px] text-muted-foreground"
          data-testid="calendar-stat-focus-hint"
        >
          {{ t('calendar.stat_focus_hint', { count: focusEventCount }) }}
        </p>
      </div>
      <div class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ t('calendar.stat_conflicts') }}
        </div>
        <div
          class="mt-3 text-2xl font-semibold leading-8"
          data-testid="calendar-stat-conflicts"
        >
          {{ conflictEventCount }}
        </div>
        <p
          class="mt-1 text-[13px] text-muted-foreground"
          data-testid="calendar-stat-conflicts-hint"
        >
          {{ t('calendar.stat_conflicts_hint', { count: conflictEventCount }) }}
        </p>
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section class="workspace-surface overflow-hidden rounded-lg">
        <div class="flex h-11 items-center justify-between border-b border-border px-4">
          <h2 class="text-[15px] font-semibold">
            {{ t('calendar.week_view') }}
          </h2>
          <span class="text-[12px] text-muted-foreground">
            {{ weekRange }} · {{ t('calendar.day_selected', { day: selectedDayLabel }) }}
          </span>
        </div>
        <div class="grid grid-cols-5 gap-px bg-border">
          <button
            v-for="day in weekDays"
            :key="day.date"
            :data-testid="`calendar-day-${day.day}`"
            class="min-h-[260px] bg-card p-3 text-left transition-colors hover:bg-accent"
            :class="day.active ? 'bg-primary/10' : ''"
            @click="selectDay(day.day)"
          >
            <span class="flex items-center justify-between">
              <span class="text-[12px] font-semibold text-muted-foreground">{{ day.day }}</span>
              <span class="flex size-7 items-center justify-center rounded-md text-[13px] font-semibold" :class="day.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'">
                {{ day.date }}
              </span>
            </span>
            <span class="mt-4 block text-[12px] text-muted-foreground">{{ t('calendar.events_count', { count: day.busy }) }}</span>
          </button>
        </div>
      </section>

      <aside class="workspace-surface h-fit overflow-hidden rounded-lg">
        <div class="flex h-11 items-center justify-between border-b border-border px-4">
          <h2 class="text-[15px] font-semibold">
            {{ t('calendar.today') }}
          </h2>
          <span class="text-[12px] text-muted-foreground">
            {{ t('calendar.events_count', { count: selectedDayEvents.length }) }} · {{ t('calendar.current_event', { title: selectedEvent.title }) }}
          </span>
        </div>
        <div class="divide-y divide-border">
          <button
            v-for="event in selectedDayEvents"
            :key="event.id"
            :data-testid="`calendar-event-${event.id}`"
            class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
            :class="selectedEvent?.id === event.id ? 'bg-primary/8' : ''"
            @click="selectEvent(event.id)"
          >
            <span class="mt-1 h-2 w-2 shrink-0 rounded-full" :class="event.tone" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13px] font-semibold">{{ event.title }}</span>
              <span class="mt-1 block text-[12px] text-muted-foreground">{{ event.team }} - {{ event.time }}</span>
            </span>
          </button>
        </div>
        <div class="border-t border-border px-4 py-3">
          <div class="grid gap-2 text-[12px]">
            <span class="font-semibold text-foreground">{{ selectedEventActionNotice }}</span>
            <span class="text-muted-foreground">参会状态：{{ selectedEvent.rsvpStatus }}</span>
            <span class="text-muted-foreground">建议时段：{{ selectedEvent.suggestion }}</span>
          </div>
          <div v-if="eventEditorOpen" class="mt-3 grid gap-2 rounded-lg border border-border p-3">
            <input
              v-model="eventDraftTitle"
              data-testid="calendar-new-title"
              type="text"
              placeholder="日程标题"
              class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
            >
            <GroupMemberPicker
              v-model="eventDraftParticipantIds"
              label="参与人"
            />
            <input
              v-model="eventDraftTime"
              data-testid="calendar-new-time"
              type="text"
              placeholder="时间"
              class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
            >
            <button
              data-testid="calendar-save-new-event"
              class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              @click="saveDraftEvent"
            >
              保存日程
            </button>
          </div>
          <div class="mt-3 flex gap-2">
            <button
              data-testid="calendar-rsvp-accept"
              class="h-8 flex-1 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              @click="acceptSelectedEvent"
            >
              接受参会
            </button>
            <button
              data-testid="calendar-reschedule-selected"
              class="h-8 flex-1 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
              @click="rescheduleSelectedEvent"
            >
              改期到建议时段
            </button>
          </div>
        </div>
      </aside>
    </div>
  </WorkspacePageFrame>
</template>
