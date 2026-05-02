<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue'

const { t } = useI18n()

const weekIndex = shallowRef(0)

const weekRanges = ['4月20日 - 4月24日', '4月27日 - 5月1日', '5月4日 - 5月8日']

const baseWeekDays = [
  { day: '周一', date: 20, busy: 2 },
  { day: '周二', date: 21, busy: 5 },
  { day: '周三', date: 22, busy: 3 },
  { day: '周四', date: 23, busy: 4 },
  { day: '周五', date: 24, busy: 1 },
]

const events = shallowRef([
  { id: 'event-1', time: '09:30', title: '产品周会', team: '产品团队', tone: 'bg-primary' },
  { id: 'event-2', time: '11:00', title: '设计评审', team: '设计团队', tone: 'bg-warning' },
  { id: 'event-3', time: '14:30', title: '发布准备会', team: '工程团队', tone: 'bg-success' },
  { id: 'event-4', time: '16:00', title: '专注时间', team: '个人', tone: 'bg-muted-foreground' },
])

const weekRange = computed(() => weekRanges[weekIndex.value] ?? weekRanges[0])

const weekDays = computed(() => {
  const offset = weekIndex.value * 7
  return baseWeekDays.map(day => ({
    ...day,
    date: `${day.date + offset}`,
    active: day.day === '周二',
    busy: day.busy + (weekIndex.value === 0 ? 0 : 1),
  }))
})

function previousWeek(): void {
  weekIndex.value = Math.max(0, weekIndex.value - 1)
}

function nextWeek(): void {
  weekIndex.value = Math.min(weekRanges.length - 1, weekIndex.value + 1)
}

function createEvent(): void {
  events.value = [
    { id: `event-${Date.now()}`, time: '17:30', title: '临时日程', team: '我', tone: 'bg-primary' },
    ...events.value,
  ]
}
</script>

<template>
  <WorkspacePageFrame
    :title="t('sidebar.calendar')"
    subtitle="团队日程与专注时间"
    :icon="CalendarDays"
  >
    <template #actions>
      <button
        data-testid="calendar-prev-week"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="上一周"
        @click="previousWeek"
      >
        <ChevronLeft :size="18" />
      </button>
      <button
        data-testid="calendar-next-week"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="下一周"
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
        <span>新建日程</span>
      </button>
    </template>

    <div class="grid gap-3 md:grid-cols-3">
      <div class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          会议数量
        </div>
        <div class="mt-3 text-2xl font-semibold leading-8">
          {{ events.length }}
        </div>
        <p class="mt-1 text-[13px] text-muted-foreground">
          2 个需要准备材料
        </p>
      </div>
      <div class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          专注时间
        </div>
        <div class="mt-3 text-2xl font-semibold leading-8">
          4h
        </div>
        <p class="mt-1 text-[13px] text-muted-foreground">
          本周已保护
        </p>
      </div>
      <div class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          日程冲突
        </div>
        <div class="mt-3 text-2xl font-semibold leading-8">
          1
        </div>
        <p class="mt-1 text-[13px] text-muted-foreground">
          需要调整安排
        </p>
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section class="workspace-surface overflow-hidden rounded-lg">
        <div class="flex h-11 items-center justify-between border-b border-border px-4">
          <h2 class="text-[15px] font-semibold">
            本周视图
          </h2>
          <span class="text-[12px] text-muted-foreground">{{ weekRange }}</span>
        </div>
        <div class="grid grid-cols-5 gap-px bg-border">
          <button
            v-for="day in weekDays"
            :key="day.date"
            class="min-h-[260px] bg-card p-3 text-left transition-colors hover:bg-accent"
            :class="day.active ? 'bg-primary/10' : ''"
          >
            <span class="flex items-center justify-between">
              <span class="text-[12px] font-semibold text-muted-foreground">{{ day.day }}</span>
              <span class="flex size-7 items-center justify-center rounded-md text-[13px] font-semibold" :class="day.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'">
                {{ day.date }}
              </span>
            </span>
            <span class="mt-4 block text-[12px] text-muted-foreground">{{ day.busy }} 个日程</span>
          </button>
        </div>
      </section>

      <aside class="workspace-surface h-fit overflow-hidden rounded-lg">
        <div class="flex h-11 items-center justify-between border-b border-border px-4">
          <h2 class="text-[15px] font-semibold">
            今日
          </h2>
          <span class="text-[12px] text-muted-foreground">{{ events.length }} 个日程</span>
        </div>
        <div class="divide-y divide-border">
          <button
            v-for="event in events"
            :key="event.id"
            class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
          >
            <span class="mt-1 h-2 w-2 shrink-0 rounded-full" :class="event.tone" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13px] font-semibold">{{ event.title }}</span>
              <span class="mt-1 block text-[12px] text-muted-foreground">{{ event.team }} - {{ event.time }}</span>
            </span>
          </button>
        </div>
      </aside>
    </div>
  </WorkspacePageFrame>
</template>
