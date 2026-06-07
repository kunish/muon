<script setup lang="ts">
import type { AttendanceRecord } from '../types/attendance';
import { useSelector } from '@tanstack/vue-store';
import { CalendarCheck, ChevronLeft, ChevronRight, Fingerprint, LogIn, LogOut, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  attendanceStore,
  selectRecords,
  selectSettings,
  clockIn as storeClockIn,
  clockOut as storeClockOut,
  removeRecord as storeRemoveRecord,
  setRecord as storeSetRecord,
  updateSettings as storeUpdateSettings,
} from '../stores/attendanceStore';
import { attendanceFlags, monthOf, shiftMonth, todayKey } from '../types/attendance';

const { t } = useI18n();

const records = useSelector(attendanceStore, selectRecords);
const settings = useSelector(attendanceStore, selectSettings);

const today = todayKey(Date.now());
const selectedMonth = shallowRef(monthOf(today));

const todayRecord = computed<AttendanceRecord | undefined>(() => records.value.find((record) => record.date === today));
const todayFlags = computed(() => (todayRecord.value ? attendanceFlags(todayRecord.value, settings.value) : null));

const monthRecords = computed(() =>
  records.value
    .filter((record) => monthOf(record.date) === selectedMonth.value)
    .sort((a, b) => (a.date < b.date ? 1 : -1)),
);

const summary = computed(() => {
  let late = 0;
  let earlyLeave = 0;
  for (const record of monthRecords.value) {
    const flags = attendanceFlags(record, settings.value);
    if (flags.late) late += 1;
    if (flags.earlyLeave) earlyLeave += 1;
  }
  return { present: monthRecords.value.length, late, earlyLeave };
});

function clockIn(): void {
  const record = storeClockIn();
  toast.success(
    record.checkIn ? t('attendance.toast_clock_in', { time: record.checkIn }) : t('attendance.toast_clocked'),
  );
}

function clockOut(): void {
  const record = storeClockOut();
  toast.success(t('attendance.toast_clock_out', { time: record.checkOut }));
}

function onSettingChange(field: 'expectedStart' | 'expectedEnd', event: Event): void {
  storeUpdateSettings({ [field]: (event.target as HTMLInputElement).value });
}

function onRecordTime(date: string, field: 'checkIn' | 'checkOut', event: Event): void {
  storeSetRecord(date, { [field]: (event.target as HTMLInputElement).value });
}
</script>

<template>
  <WorkspacePageFrame :title="t('attendance.title')" :subtitle="t('attendance.subtitle')" :icon="Fingerprint">
    <!-- 今日打卡 -->
    <div class="rounded-xl border border-border bg-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-[13px] text-muted-foreground">{{ today }}</p>
          <div class="mt-1 flex items-end gap-4">
            <div>
              <p class="text-[12px] text-muted-foreground">{{ t('attendance.check_in') }}</p>
              <p class="text-[22px] font-semibold tabular-nums text-foreground">
                {{ todayRecord?.checkIn ?? '--:--' }}
              </p>
            </div>
            <div>
              <p class="text-[12px] text-muted-foreground">{{ t('attendance.check_out') }}</p>
              <p class="text-[22px] font-semibold tabular-nums text-foreground">
                {{ todayRecord?.checkOut ?? '--:--' }}
              </p>
            </div>
            <div v-if="todayFlags" class="flex flex-wrap gap-1.5 pb-1">
              <span v-if="todayFlags.late" class="rounded bg-destructive/10 px-2 py-0.5 text-[12px] text-destructive">{{
                t('attendance.late')
              }}</span>
              <span
                v-else-if="todayRecord?.checkIn"
                class="rounded bg-success/10 px-2 py-0.5 text-[12px] text-success"
                >{{ t('attendance.on_time') }}</span
              >
              <span v-if="todayFlags.earlyLeave" class="rounded bg-warning/10 px-2 py-0.5 text-[12px] text-warning">{{
                t('attendance.early_leave')
              }}</span>
              <span
                v-if="todayRecord?.checkIn && !todayRecord?.checkOut"
                class="rounded bg-muted px-2 py-0.5 text-[12px] text-muted-foreground"
                >{{ t('attendance.no_checkout') }}</span
              >
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex h-11 items-center gap-1.5 rounded-xl border border-border px-4 text-[14px] font-medium text-foreground transition hover:bg-accent/40"
            data-testid="attendance-clock-in"
            @click="clockIn"
          >
            <LogIn :size="17" />{{ t('attendance.clock_in_btn') }}
          </button>
          <button
            type="button"
            class="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-[14px] font-medium text-primary-foreground transition hover:opacity-90"
            data-testid="attendance-clock-out"
            @click="clockOut"
          >
            <LogOut :size="17" />{{ t('attendance.clock_out_btn') }}
          </button>
        </div>
      </div>

      <!-- 班次设置 -->
      <div
        class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-[13px] text-muted-foreground"
      >
        <span>{{ t('attendance.shift') }}</span>
        <label class="flex items-center gap-1.5">
          {{ t('attendance.check_in') }}
          <input
            type="time"
            :value="settings.expectedStart"
            class="h-8 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
            @change="onSettingChange('expectedStart', $event)"
          />
        </label>
        <label class="flex items-center gap-1.5">
          {{ t('attendance.check_out') }}
          <input
            type="time"
            :value="settings.expectedEnd"
            class="h-8 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
            @change="onSettingChange('expectedEnd', $event)"
          />
        </label>
      </div>
    </div>

    <!-- 月度导航 + 统计 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent/40"
          :aria-label="t('attendance.prev_month')"
          @click="selectedMonth = shiftMonth(selectedMonth, -1)"
        >
          <ChevronLeft :size="16" />
        </button>
        <span class="min-w-[88px] text-center text-[14px] font-semibold tabular-nums text-foreground">{{
          selectedMonth
        }}</span>
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent/40"
          :aria-label="t('attendance.next_month')"
          @click="selectedMonth = shiftMonth(selectedMonth, 1)"
        >
          <ChevronRight :size="16" />
        </button>
      </div>
      <div class="flex items-center gap-4 text-[13px] text-muted-foreground">
        <span
          >{{ t('attendance.stat_present') }} <span class="font-semibold text-foreground">{{ summary.present }}</span>
          {{ t('attendance.stat_present_unit') }}</span
        >
        <span
          >{{ t('attendance.late') }} <span class="font-semibold text-destructive">{{ summary.late }}</span></span
        >
        <span
          >{{ t('attendance.early_leave') }}
          <span class="font-semibold text-warning">{{ summary.earlyLeave }}</span></span
        >
      </div>
    </div>

    <!-- 月度记录 -->
    <div
      v-if="monthRecords.length === 0"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center"
      data-testid="attendance-empty"
    >
      <CalendarCheck :size="26" class="text-muted-foreground" />
      <p class="text-[13px] text-muted-foreground">{{ t('attendance.empty', { month: selectedMonth }) }}</p>
    </div>
    <ul v-else class="flex flex-col gap-1.5">
      <li
        v-for="record in monthRecords"
        :key="record.date"
        class="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
        data-testid="attendance-record"
      >
        <span class="w-24 shrink-0 text-[13px] font-medium tabular-nums text-foreground">{{ record.date }}</span>
        <label class="flex items-center gap-1 text-[12px] text-muted-foreground">
          {{ t('attendance.check_in') }}
          <input
            type="time"
            :value="record.checkIn ?? ''"
            class="h-8 rounded-lg border border-transparent bg-transparent px-1 text-[13px] text-foreground outline-none hover:border-border focus:border-primary"
            @change="onRecordTime(record.date, 'checkIn', $event)"
          />
        </label>
        <label class="flex items-center gap-1 text-[12px] text-muted-foreground">
          {{ t('attendance.check_out') }}
          <input
            type="time"
            :value="record.checkOut ?? ''"
            class="h-8 rounded-lg border border-transparent bg-transparent px-1 text-[13px] text-foreground outline-none hover:border-border focus:border-primary"
            @change="onRecordTime(record.date, 'checkOut', $event)"
          />
        </label>
        <span class="flex flex-1 flex-wrap justify-end gap-1.5">
          <span
            v-if="attendanceFlags(record, settings).late"
            class="rounded bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive"
            >{{ t('attendance.late') }}</span
          >
          <span
            v-if="attendanceFlags(record, settings).earlyLeave"
            class="rounded bg-warning/10 px-2 py-0.5 text-[11px] text-warning"
            >{{ t('attendance.early_leave') }}</span
          >
          <span
            v-if="
              record.checkIn &&
              record.checkOut &&
              !attendanceFlags(record, settings).late &&
              !attendanceFlags(record, settings).earlyLeave
            "
            class="rounded bg-success/10 px-2 py-0.5 text-[11px] text-success"
            >{{ t('attendance.normal') }}</span
          >
        </span>
        <button
          type="button"
          class="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          :aria-label="t('attendance.delete_record')"
          @click="storeRemoveRecord(record.date)"
        >
          <Trash2 :size="14" />
        </button>
      </li>
    </ul>
  </WorkspacePageFrame>
</template>
