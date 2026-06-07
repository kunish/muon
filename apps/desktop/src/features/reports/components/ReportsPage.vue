<script setup lang="ts">
import type { Report, ReportType } from '../types/report';
import { useSelector } from '@tanstack/vue-store';
import { ChevronDown, ClipboardCheck, FileBarChart, Plus, RotateCcw, Trash2 } from 'lucide-vue-next';
import { computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  reportStore,
  selectReports,
  addReport as storeAddReport,
  removeReport as storeRemoveReport,
  setRecipient as storeSetRecipient,
  setSection as storeSetSection,
  submitReport as storeSubmitReport,
  withdrawReport as storeWithdrawReport,
} from '../stores/reportStore';
import { isSubmitted, REPORT_TYPES, sectionsFor, todayKey } from '../types/report';

type Filter = 'all' | ReportType;

const { t } = useI18n();

const reports = useSelector(reportStore, selectReports);

const filterIds: Filter[] = ['all', 'daily', 'weekly'];
const activeFilter = shallowRef<Filter>('all');

function reportTypeLabel(type: ReportType): string {
  return t(`reports.type_${type}`);
}

function periodLabel(report: Report): string {
  return report.type === 'weekly' ? t('reports.period_weekly', { key: report.periodKey }) : report.periodKey;
}

const visibleReports = computed(() =>
  reports.value
    .filter((report) => activeFilter.value === 'all' || report.type === activeFilter.value)
    .sort((a, b) => b.createdAt - a.createdAt),
);

const expandedId = shallowRef<string | null>(null);
function toggleExpanded(id: string): void {
  expandedId.value = expandedId.value === id ? null : id;
}

function createReport(type: ReportType): void {
  const report = storeAddReport({ type, periodKey: todayKey(Date.now()) });
  expandedId.value = report.id;
  activeFilter.value = 'all';
}

function onSection(reportId: string, sectionKey: string, event: Event): void {
  storeSetSection(reportId, sectionKey, (event.target as HTMLTextAreaElement).value);
}

function onRecipient(reportId: string, event: Event): void {
  storeSetRecipient(reportId, (event.target as HTMLInputElement).value);
}

function submit(report: Report): void {
  try {
    storeSubmitReport(report.id);
    toast.success(t('reports.toast_submitted'));
  } catch {
    toast.error(t('reports.toast_need_content'));
  }
}

function withdraw(report: Report): void {
  storeWithdrawReport(report.id);
  toast.success(t('reports.toast_withdrawn'));
}

function deleteReport(report: Report): void {
  storeRemoveReport(report.id);
  toast.success(t('reports.toast_deleted'));
}
</script>

<template>
  <WorkspacePageFrame :title="t('reports.title')" :subtitle="t('reports.subtitle')" :icon="FileBarChart">
    <template #actions>
      <button
        v-for="type in REPORT_TYPES"
        :key="type"
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition"
        :class="
          type === 'daily'
            ? 'bg-primary text-primary-foreground hover:opacity-90'
            : 'border border-border text-foreground hover:bg-accent/40'
        "
        :data-testid="`reports-new-${type}`"
        @click="createReport(type)"
      >
        <Plus :size="16" />{{ t(`reports.new_${type}`) }}
      </button>
    </template>

    <!-- 筛选 -->
    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="id in filterIds"
        :key="id"
        type="button"
        class="h-8 rounded-lg border px-3 text-[13px] font-medium transition"
        :class="
          id === activeFilter
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:bg-accent/40'
        "
        :data-testid="`reports-filter-${id}`"
        @click="activeFilter = id"
      >
        {{ t(`reports.filter_${id}`) }}
      </button>
    </div>

    <!-- 空状态 -->
    <div
      v-if="visibleReports.length === 0"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center"
      data-testid="reports-empty"
    >
      <FileBarChart :size="28" class="text-muted-foreground" />
      <p class="text-[14px] font-medium text-foreground">{{ t('reports.empty_title') }}</p>
      <p class="text-[13px] text-muted-foreground">{{ t('reports.empty_hint') }}</p>
    </div>

    <!-- 汇报列表 -->
    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="report in visibleReports"
        :key="report.id"
        class="rounded-xl border border-border bg-card"
        data-testid="reports-item"
      >
        <div class="flex items-center gap-3 p-4">
          <button
            type="button"
            class="shrink-0 text-muted-foreground transition hover:text-foreground"
            :aria-label="expandedId === report.id ? t('reports.collapse') : t('reports.expand')"
            @click="toggleExpanded(report.id)"
          >
            <ChevronDown
              :size="18"
              class="transition-transform"
              :class="expandedId === report.id ? '' : '-rotate-90'"
            />
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[12px] font-medium text-primary">
                {{ reportTypeLabel(report.type) }}
              </span>
              <span class="truncate text-[14px] font-medium text-foreground">{{ periodLabel(report) }}</span>
            </div>
            <p class="mt-0.5 text-[12px] text-muted-foreground">
              {{ t('reports.recipient_to', { name: report.recipient }) }}
            </p>
          </div>
          <span
            class="shrink-0 rounded px-2 py-0.5 text-[12px]"
            :class="isSubmitted(report) ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'"
          >
            {{ isSubmitted(report) ? t('reports.status_submitted') : t('reports.status_draft') }}
          </span>
          <button
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            :aria-label="t('reports.delete')"
            @click="deleteReport(report)"
          >
            <Trash2 :size="15" />
          </button>
        </div>

        <!-- 编辑区 -->
        <div v-if="expandedId === report.id" class="border-t border-border p-4">
          <div class="flex flex-col gap-3">
            <label
              v-for="section in sectionsFor(report.type)"
              :key="section.key"
              class="flex flex-col gap-1 text-[12px] text-muted-foreground"
            >
              {{ t(section.labelKey) }}
              <textarea
                :value="report.content[section.key] ?? ''"
                rows="2"
                :placeholder="t(section.placeholderKey)"
                class="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                @change="onSection(report.id, section.key, $event)"
              />
            </label>
            <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
              {{ t('reports.recipient') }}
              <input
                :value="report.recipient"
                type="text"
                class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
                @change="onRecipient(report.id, $event)"
              />
            </label>
          </div>
          <div class="mt-3 flex items-center justify-end gap-2">
            <button
              v-if="isSubmitted(report)"
              type="button"
              class="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
              data-testid="reports-withdraw"
              @click="withdraw(report)"
            >
              <RotateCcw :size="15" />{{ t('reports.withdraw') }}
            </button>
            <button
              v-else
              type="button"
              class="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
              data-testid="reports-submit"
              @click="submit(report)"
            >
              <ClipboardCheck :size="15" />{{ t('reports.submit') }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </WorkspacePageFrame>
</template>
