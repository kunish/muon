<script setup lang="ts">
import type { KeyResultStatus, Objective, ObjectiveConfidence } from '../types/okr';
import { useSelector } from '@tanstack/vue-store';
import { ChevronDown, Plus, Target, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  okrStore,
  selectObjectives,
  addKeyResult as storeAddKeyResult,
  addObjective as storeAddObjective,
  checkIn as storeCheckIn,
  removeKeyResult as storeRemoveKeyResult,
  removeObjective as storeRemoveObjective,
  setAlignment as storeSetAlignment,
  setKeyResultProgress as storeSetKeyResultProgress,
} from '../stores/okrStore';
import { currentPeriod, objectiveProgress } from '../types/okr';

const { t } = useI18n();

const objectives = useSelector(okrStore, selectObjectives);

const now = Date.now();
const selectedPeriod = shallowRef(currentPeriod(now));

// ── 周期（季度）选项：当前季度 ±，以及已有目标涉及到的周期，去重后按时间倒序 ──
function periodToIndex(period: string): number {
  const [year, quarter] = period.split('-Q');
  return Number(year) * 4 + (Number(quarter) - 1);
}

function indexToPeriod(index: number): string {
  const year = Math.floor(index / 4);
  const quarter = (index % 4) + 1;
  return `${year}-Q${quarter}`;
}

const periodOptions = computed(() => {
  const base = periodToIndex(currentPeriod(now));
  const generated = [base + 1, base, base - 1, base - 2, base - 3].map(indexToPeriod);
  const fromData = objectives.value.map((objective) => objective.period);
  return [...new Set([...generated, ...fromData])].sort((a, b) => periodToIndex(b) - periodToIndex(a));
});

const periodObjectives = computed(() =>
  objectives.value
    .filter((objective) => objective.period === selectedPeriod.value)
    .sort((a, b) => b.createdAt - a.createdAt),
);

const periodAverage = computed(() => {
  const list = periodObjectives.value;
  if (list.length === 0) return 0;
  return Math.round(list.reduce((sum, objective) => sum + objectiveProgress(objective), 0) / list.length);
});

const confidenceCls: Record<ObjectiveConfidence, string> = {
  high: 'text-success',
  medium: 'text-warning',
  low: 'text-destructive',
};
function confidenceLabel(confidence: ObjectiveConfidence): string {
  return t(`okr.confidence_${confidence}`);
}

const krStatusCls: Record<KeyResultStatus, string> = {
  on_track: 'text-success',
  at_risk: 'text-warning',
  behind: 'text-destructive',
  done: 'text-primary',
};
function krStatusLabel(status: KeyResultStatus): string {
  return t(`okr.kr_${status}`);
}

const confidenceOptions: ObjectiveConfidence[] = ['high', 'medium', 'low'];

// ── 展开 / 折叠 ──
const expandedIds = ref<Set<string>>(new Set());
function toggleExpanded(id: string): void {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

// 全局搜索深链：?focus=<objectiveId> 时切到其周期并展开该目标。
const route = useRoute();
onMounted(() => {
  const focus = typeof route.query.focus === 'string' ? route.query.focus : null;
  if (!focus) return;
  const target = objectives.value.find((objective) => objective.id === focus);
  if (!target) return;
  selectedPeriod.value = target.period;
  expandedIds.value = new Set([target.id]);
});

// ── 新建目标面板 ──
const composerOpen = shallowRef(false);
const draftTitle = shallowRef('');
const draftOwner = shallowRef('我');
const draftConfidence = shallowRef<ObjectiveConfidence>('medium');
const draftKeyResults = ref<string[]>(['', '', '']);

function openComposer(): void {
  draftTitle.value = '';
  draftOwner.value = '我';
  draftConfidence.value = 'medium';
  draftKeyResults.value = ['', '', ''];
  composerOpen.value = true;
}

function submitObjective(): void {
  const title = draftTitle.value.trim();
  if (!title) {
    toast.error(t('okr.title_required'));
    return;
  }
  const objective = storeAddObjective({
    period: selectedPeriod.value,
    title,
    owner: draftOwner.value,
    confidence: draftConfidence.value,
    keyResults: draftKeyResults.value.filter((kr) => kr.trim()).map((krTitle) => ({ title: krTitle })),
  });
  expandedIds.value = new Set([...expandedIds.value, objective.id]);
  composerOpen.value = false;
  toast.success(t('okr.created'));
}

function deleteObjective(objective: Objective): void {
  storeRemoveObjective(objective.id);
  toast.success(t('okr.deleted', { title: objective.title }));
}

// ── 目标对齐 ──
const objectivesById = computed(() => new Map(objectives.value.map((objective) => [objective.id, objective])));
function alignmentTitle(objective: Objective): string | null {
  if (!objective.alignsTo) return null;
  return objectivesById.value.get(objective.alignsTo)?.title ?? null;
}
function onAlignChange(objective: Objective, event: Event): void {
  storeSetAlignment(objective.id, (event.target as HTMLSelectElement).value || null);
}

// ── 关键结果 ──
const krDrafts = ref<Record<string, string>>({});

function submitKeyResult(objectiveId: string): void {
  const title = (krDrafts.value[objectiveId] ?? '').trim();
  if (!title) return;
  storeAddKeyResult(objectiveId, { title });
  krDrafts.value = { ...krDrafts.value, [objectiveId]: '' };
}

function onProgressInput(objectiveId: string, keyResultId: string, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  storeSetKeyResultProgress(objectiveId, keyResultId, value);
}

// ── Check-in（更新信心 + 备注） ──
const checkInFor = shallowRef<string | null>(null);
const checkInNote = shallowRef('');
const checkInConfidence = shallowRef<ObjectiveConfidence>('medium');

function openCheckIn(objective: Objective): void {
  checkInFor.value = objective.id;
  checkInConfidence.value = objective.confidence;
  checkInNote.value = '';
}

function submitCheckIn(objectiveId: string): void {
  storeCheckIn(objectiveId, checkInConfidence.value, checkInNote.value);
  checkInFor.value = null;
  toast.success(t('okr.checkin_done'));
}
</script>

<template>
  <WorkspacePageFrame title="OKR" :subtitle="t('okr.subtitle')" :icon="Target">
    <template #actions>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
        data-testid="okr-new-objective"
        @click="openComposer"
      >
        <Plus :size="16" />
        {{ t('okr.new_objective') }}
      </button>
    </template>

    <!-- 周期切换 + 概览 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="period in periodOptions"
          :key="period"
          type="button"
          class="h-8 rounded-lg border px-3 text-[13px] font-medium transition"
          :class="
            period === selectedPeriod
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent/40'
          "
          @click="selectedPeriod = period"
        >
          {{ period }}
        </button>
      </div>
      <div class="flex items-center gap-4 text-[13px] text-muted-foreground">
        <span
          >{{ t('okr.stat_count') }}
          <span class="font-semibold text-foreground">{{ periodObjectives.length }}</span></span
        >
        <span
          >{{ t('okr.stat_avg') }} <span class="font-semibold text-foreground">{{ periodAverage }}%</span></span
        >
      </div>
    </div>

    <!-- 新建目标面板 -->
    <div v-if="composerOpen" class="rounded-xl border border-border bg-sidebar p-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-[13px] sm:col-span-2">
          <span class="text-muted-foreground">{{ t('okr.objective_label') }}</span>
          <input
            v-model="draftTitle"
            type="text"
            :placeholder="t('okr.objective_placeholder')"
            class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
            data-testid="okr-draft-title"
          />
        </label>
        <label class="flex flex-col gap-1 text-[13px]">
          <span class="text-muted-foreground">{{ t('okr.owner') }}</span>
          <input
            v-model="draftOwner"
            type="text"
            class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          />
        </label>
        <label class="flex flex-col gap-1 text-[13px]">
          <span class="text-muted-foreground">{{ t('okr.confidence') }}</span>
          <select
            v-model="draftConfidence"
            class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          >
            <option v-for="opt in confidenceOptions" :key="opt" :value="opt">{{ confidenceLabel(opt) }}</option>
          </select>
        </label>
        <div class="flex flex-col gap-1.5 text-[13px] sm:col-span-2">
          <span class="text-muted-foreground">{{ t('okr.kr_label') }}</span>
          <input
            v-for="(_, index) in draftKeyResults"
            :key="index"
            v-model="draftKeyResults[index]"
            type="text"
            :placeholder="t('okr.kr_placeholder', { index: index + 1 })"
            class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          />
        </div>
      </div>
      <div class="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          class="h-9 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
          @click="composerOpen = false"
        >
          {{ t('okr.cancel') }}
        </button>
        <button
          type="button"
          class="h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
          data-testid="okr-submit-objective"
          @click="submitObjective"
        >
          {{ t('okr.create') }}
        </button>
      </div>
    </div>

    <!-- 目标列表 -->
    <div
      v-if="periodObjectives.length === 0"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center"
      data-testid="okr-empty"
    >
      <Target :size="28" class="text-muted-foreground" />
      <p class="text-[14px] font-medium text-foreground">{{ t('okr.empty_title', { period: selectedPeriod }) }}</p>
      <p class="text-[13px] text-muted-foreground">{{ t('okr.empty_hint') }}</p>
    </div>

    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="objective in periodObjectives"
        :key="objective.id"
        class="rounded-xl border border-border bg-card"
        data-testid="okr-objective"
      >
        <!-- 目标头部 -->
        <div class="flex items-start gap-3 p-4">
          <button
            type="button"
            class="mt-0.5 shrink-0 text-muted-foreground transition hover:text-foreground"
            :aria-label="expandedIds.has(objective.id) ? t('okr.collapse') : t('okr.expand')"
            @click="toggleExpanded(objective.id)"
          >
            <ChevronDown
              :size="18"
              class="transition-transform"
              :class="expandedIds.has(objective.id) ? '' : '-rotate-90'"
            />
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="truncate text-[15px] font-semibold text-foreground">{{ objective.title }}</h3>
              <span class="shrink-0 text-[12px]" :class="confidenceCls[objective.confidence]">
                {{ confidenceLabel(objective.confidence) }}
              </span>
            </div>
            <p class="mt-0.5 text-[12px] text-muted-foreground">
              {{ t('okr.owner') }} {{ objective.owner }}
              <span v-if="objective.lastCheckIn"> · {{ t('okr.last_checkin', { note: objective.lastCheckIn }) }}</span>
              <span v-if="alignmentTitle(objective)">
                · {{ t('okr.aligned_to', { title: alignmentTitle(objective) }) }}</span
              >
            </p>
            <!-- 整体进度 -->
            <div class="mt-2 flex items-center gap-2">
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary transition-all"
                  :style="{ width: `${objectiveProgress(objective)}%` }"
                />
              </div>
              <span class="w-10 shrink-0 text-right text-[12px] font-medium text-foreground">
                {{ objectiveProgress(objective) }}%
              </span>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="h-8 rounded-lg border border-border px-2.5 text-[12px] text-muted-foreground transition hover:bg-accent/40"
              data-testid="okr-checkin"
              @click="openCheckIn(objective)"
            >
              Check-in
            </button>
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              :aria-label="t('okr.delete_objective')"
              @click="deleteObjective(objective)"
            >
              <Trash2 :size="15" />
            </button>
          </div>
        </div>

        <!-- Check-in 面板 -->
        <div v-if="checkInFor === objective.id" class="border-t border-border bg-sidebar p-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[13px] text-muted-foreground">{{ t('okr.confidence') }}</span>
            <button
              v-for="opt in confidenceOptions"
              :key="opt"
              type="button"
              class="h-8 rounded-lg border px-3 text-[12px] transition"
              :class="
                checkInConfidence === opt
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent/40'
              "
              @click="checkInConfidence = opt"
            >
              {{ confidenceLabel(opt) }}
            </button>
          </div>
          <input
            v-model="checkInNote"
            type="text"
            :placeholder="t('okr.checkin_placeholder')"
            class="mt-2 h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          />
          <div class="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              class="h-8 rounded-lg border border-border px-3 text-[12px] text-muted-foreground transition hover:bg-accent/40"
              @click="checkInFor = null"
            >
              {{ t('okr.cancel') }}
            </button>
            <button
              type="button"
              class="h-8 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground transition hover:opacity-90"
              data-testid="okr-submit-checkin"
              @click="submitCheckIn(objective.id)"
            >
              {{ t('okr.submit') }}
            </button>
          </div>
        </div>

        <!-- 关键结果列表 -->
        <div v-if="expandedIds.has(objective.id)" class="border-t border-border p-4">
          <label class="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            {{ t('okr.align_label') }}
            <select
              :value="objective.alignsTo ?? ''"
              class="h-8 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
              :data-testid="`okr-align-${objective.id}`"
              @change="onAlignChange(objective, $event)"
            >
              <option value="">{{ t('okr.align_none') }}</option>
              <option
                v-for="parent in objectives.filter((item) => item.id !== objective.id)"
                :key="parent.id"
                :value="parent.id"
              >
                {{ parent.title }}
              </option>
            </select>
          </label>
          <ul class="flex flex-col gap-3">
            <li
              v-for="kr in objective.keyResults"
              :key="kr.id"
              class="flex items-center gap-3"
              data-testid="okr-key-result"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-[13px] text-foreground">{{ kr.title }}</span>
                  <span class="shrink-0 text-[11px]" :class="krStatusCls[kr.status]">
                    {{ krStatusLabel(kr.status) }}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  :value="kr.progress"
                  class="mt-1 w-full accent-primary"
                  @input="onProgressInput(objective.id, kr.id, $event)"
                />
              </div>
              <span class="w-10 shrink-0 text-right text-[12px] font-medium text-foreground">{{ kr.progress }}%</span>
              <button
                type="button"
                class="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                :aria-label="t('okr.delete_kr')"
                @click="storeRemoveKeyResult(objective.id, kr.id)"
              >
                <Trash2 :size="14" />
              </button>
            </li>
          </ul>

          <!-- 新增 KR -->
          <div class="mt-3 flex items-center gap-2">
            <input
              :value="krDrafts[objective.id] ?? ''"
              type="text"
              :placeholder="t('okr.kr_add_placeholder')"
              class="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
              @input="krDrafts = { ...krDrafts, [objective.id]: ($event.target as HTMLInputElement).value }"
              @keyup.enter="submitKeyResult(objective.id)"
            />
            <button
              type="button"
              class="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
              @click="submitKeyResult(objective.id)"
            >
              <Plus :size="15" />
              {{ t('okr.add') }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </WorkspacePageFrame>
</template>
