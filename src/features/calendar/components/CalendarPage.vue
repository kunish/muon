<script setup lang="ts">
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const today = new Date()
const currentMonth = ref(today.getMonth())
const currentYear = ref(today.getFullYear())

const monthName = computed(() => {
  const d = new Date(currentYear.value, currentMonth.value)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
})

const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
})

const firstDayOfWeek = computed(() => {
  const d = new Date(currentYear.value, currentMonth.value, 1).getDay()
  return d === 0 ? 7 : d // 周一开始
})

const calendarDays = computed(() => {
  const days: (number | null)[] = []
  // 填充前面的空白
  for (let i = 1; i < firstDayOfWeek.value; i++) days.push(null)
  for (let i = 1; i <= daysInMonth.value; i++) days.push(i)
  return days
})

function isToday(day: number | null) {
  if (!day)
    return false
  return day === today.getDate() && currentMonth.value === today.getMonth() && currentYear.value === today.getFullYear()
}

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  }
  else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  }
  else {
    currentMonth.value++
  }
}

const weekDays = computed(() => [
  t('calendar.mon'),
  t('calendar.tue'),
  t('calendar.wed'),
  t('calendar.thu'),
  t('calendar.fri'),
  t('calendar.sat'),
  t('calendar.sun'),
])
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
      <div class="flex items-center gap-2">
        <Calendar :size="20" class="text-primary" />
        <h1 class="text-base font-semibold">
          {{ t('sidebar.calendar') }}
        </h1>
      </div>
      <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
        <Plus :size="14" />
        {{ t('calendar.new_event') }}
      </button>
    </div>

    <!-- Calendar content -->
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-[600px] mx-auto">
        <!-- Month navigation -->
        <div class="flex items-center justify-between mb-4">
          <button class="p-1.5 rounded-md hover:bg-accent text-muted-foreground" @click="prevMonth">
            <ChevronLeft :size="18" />
          </button>
          <span class="text-sm font-semibold">{{ monthName }}</span>
          <button class="p-1.5 rounded-md hover:bg-accent text-muted-foreground" @click="nextMonth">
            <ChevronRight :size="18" />
          </button>
        </div>

        <!-- Week days header -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          <div
            v-for="d in weekDays"
            :key="d"
            class="text-center text-[11px] text-muted-foreground/60 font-medium py-1"
          >
            {{ d }}
          </div>
        </div>

        <!-- Calendar grid -->
        <div class="grid grid-cols-7 gap-1">
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            class="aspect-square flex items-center justify-center rounded-lg text-sm cursor-pointer transition-colors"
            :class="[
              day ? 'hover:bg-accent' : '',
              isToday(day) ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground/80',
            ]"
          >
            {{ day || '' }}
          </div>
        </div>

        <!-- Empty schedule hint -->
        <div class="mt-8 p-4 rounded-xl bg-accent/30 border border-border/40">
          <div class="flex items-center gap-2 mb-2">
            <Clock :size="14" class="text-muted-foreground/60" />
            <span class="text-xs font-medium text-muted-foreground/80">{{ t('calendar.today_events') }}</span>
          </div>
          <p class="text-xs text-muted-foreground/50 pl-5">
            {{ t('calendar.no_events') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
