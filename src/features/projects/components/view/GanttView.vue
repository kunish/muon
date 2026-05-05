<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkItemStore } from '../../composables/useWorkItemStore'

defineProps<{ projectId: string }>()

const { t } = useI18n()
const store = useWorkItemStore()
const monthsBack = ref(1)
const monthsForward = ref(3)

const itemsWithDates = computed(() =>
  store.currentItems.filter(i => i.dueDate).sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0)),
)

const range = computed(() => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack.value, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + monthsForward.value + 1, 0)
  const days: Date[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  return { start, end, days }
})

function dateToColumnX(dateMs: number): number {
  const msPerDay = 86_400_000
  return Math.round((dateMs - range.value.start.getTime()) / msPerDay)
}

const todayX = computed(() => dateToColumnX(Date.now()))

function totalDays(): number {
  return Math.round((range.value.end.getTime() - range.value.start.getTime()) / 86_400_000) + 1
}

const dayLabels = computed(() => {
  const months = new Map<string, number>()
  for (const d of range.value.days) {
    const key = `${d.getFullYear()}-${d.getMonth()}`
    months.set(key, (months.get(key) ?? 0) + 1)
  }
  const result: { label: string, span: number }[] = []
  let lastKey = ''
  for (const d of range.value.days) {
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (key !== lastKey) {
      result.push({ label: `${d.getMonth() + 1}月`, span: months.get(key)! })
      lastKey = key
    }
  }
  return result
})

const columnWidth = 24
</script>

<template>
  <div class="flex h-full flex-col overflow-auto">
    <div v-if="itemsWithDates.length === 0" class="flex flex-1 items-center justify-center text-muted-foreground">
      {{ t('projects.no_tasks') }}
    </div>

    <div v-else class="flex flex-1 flex-col" :style="{ width: totalDays() * columnWidth + 'px' }">
      <div class="flex border-b bg-muted/50 text-xs">
        <div class="w-64 shrink-0 px-3 py-2 font-medium">{{ t('projects.task_title') }}</div>
        <div class="flex">
          <div
            v-for="(m, i) in dayLabels"
            :key="i"
            class="border-r px-2 py-2 text-center font-medium"
            :style="{ width: m.span * columnWidth + 'px' }"
          >
            {{ m.label }}
          </div>
        </div>
      </div>

      <div
        v-for="item in itemsWithDates"
        :key="item.id"
        class="flex border-b text-sm hover:bg-muted/50"
      >
        <div class="w-64 shrink-0 truncate px-3 py-2.5">{{ item.title }}</div>
        <div class="relative flex-1">
          <div
            class="absolute top-1.5 h-6 rounded bg-primary/80 px-2 text-xs leading-6 text-primary-foreground"
            :style="{ left: dateToColumnX(item.dueDate!) * columnWidth + 'px' }"
          >
            {{ new Date(item.dueDate!).toLocaleDateString() }}
          </div>
          <div
            class="absolute top-0 h-full w-px bg-red-500"
            :style="{ left: todayX * columnWidth + 'px' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
