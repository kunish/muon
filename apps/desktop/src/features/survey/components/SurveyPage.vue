<script setup lang="ts">
import type { AnswerValue, Question, QuestionType, Survey } from '../types/survey';
import { useSelector } from '@tanstack/vue-store';
import { ClipboardList, Plus, Star, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  selectSurveys,
  addQuestion as storeAddQuestion,
  addSurvey as storeAddSurvey,
  removeQuestion as storeRemoveQuestion,
  removeSurvey as storeRemoveSurvey,
  submitResponse as storeSubmitResponse,
  updateQuestion as storeUpdateQuestion,
  updateSurvey as storeUpdateSurvey,
  surveyStore,
} from '../stores/surveyStore';
import { averageRating, isChoiceType, QUESTION_TYPES, RATING_MAX, tallyChoice, textAnswers } from '../types/survey';

type Mode = 'design' | 'fill' | 'result';

const { t } = useI18n();

const surveys = useSelector(surveyStore, selectSurveys);

function questionTypeLabel(type: QuestionType): string {
  return t(`survey.qt_${type}`);
}

const modeIds: Mode[] = ['design', 'fill', 'result'];

// ── 当前问卷 + 模式 ──
const activeSurveyId = shallowRef<string | null>(null);
const activeSurvey = computed<Survey | null>(() => {
  const list = surveys.value;
  if (list.length === 0) return null;
  return list.find((survey) => survey.id === activeSurveyId.value) ?? list[0];
});
const mode = shallowRef<Mode>('design');

// 全局搜索深链：?focus=<surveyId> 时选中该问卷。
const route = useRoute();
onMounted(() => {
  const focus = typeof route.query.focus === 'string' ? route.query.focus : null;
  if (focus && surveys.value.some((survey) => survey.id === focus)) activeSurveyId.value = focus;
});

// ── 新建问卷 ──
const surveyComposerOpen = shallowRef(false);
const draftSurveyTitle = shallowRef('');
const draftSurveyDesc = shallowRef('');

function openSurveyComposer(): void {
  draftSurveyTitle.value = '';
  draftSurveyDesc.value = '';
  surveyComposerOpen.value = true;
}

function submitSurvey(): void {
  const title = draftSurveyTitle.value.trim();
  if (!title) {
    toast.error(t('survey.title_required'));
    return;
  }
  const survey = storeAddSurvey(title, draftSurveyDesc.value);
  activeSurveyId.value = survey.id;
  mode.value = 'design';
  surveyComposerOpen.value = false;
}

function deleteSurvey(survey: Survey): void {
  storeRemoveSurvey(survey.id);
  if (activeSurveyId.value === survey.id) activeSurveyId.value = null;
  toast.success(t('survey.deleted', { title: survey.title }));
}

// ── 设计：题目 ──
const draftQType = shallowRef<QuestionType>('single');
const draftQTitle = shallowRef('');
const draftQOptions = shallowRef(t('survey.options_default'));

function submitQuestion(): void {
  const survey = activeSurvey.value;
  if (!survey) return;
  const title = draftQTitle.value.trim();
  if (!title) {
    toast.error(t('survey.question_required'));
    return;
  }
  storeAddQuestion(survey.id, {
    type: draftQType.value,
    title,
    options: isChoiceType(draftQType.value)
      ? draftQOptions.value
          .split(/[,，]/)
          .map((opt) => opt.trim())
          .filter(Boolean)
      : undefined,
  });
  draftQTitle.value = '';
}

function onQuestionTitle(survey: Survey, question: Question, event: Event): void {
  storeUpdateQuestion(survey.id, question.id, { title: (event.target as HTMLInputElement).value });
}

function onQuestionOptions(survey: Survey, question: Question, event: Event): void {
  storeUpdateQuestion(survey.id, question.id, {
    options: (event.target as HTMLInputElement).value
      .split(/[,，]/)
      .map((opt) => opt.trim())
      .filter(Boolean),
  });
}

function onQuestionRequired(survey: Survey, question: Question, event: Event): void {
  storeUpdateQuestion(survey.id, question.id, { required: (event.target as HTMLInputElement).checked });
}

function onSurveyMeta(survey: Survey, field: 'title' | 'description', event: Event): void {
  storeUpdateSurvey(survey.id, { [field]: (event.target as HTMLInputElement).value });
}

// ── 填写 ──
const fillAnswers = ref<Record<string, AnswerValue>>({});

watch([activeSurvey, mode], () => {
  if (mode.value === 'fill') fillAnswers.value = {};
});

function pickedOptions(questionId: string): string[] {
  const value = fillAnswers.value[questionId];
  return Array.isArray(value) ? value : [];
}

function setSingle(questionId: string, option: string): void {
  fillAnswers.value = { ...fillAnswers.value, [questionId]: option };
}

function toggleMultiple(questionId: string, option: string): void {
  const current = pickedOptions(questionId);
  const next = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
  fillAnswers.value = { ...fillAnswers.value, [questionId]: next };
}

function setText(questionId: string, event: Event): void {
  fillAnswers.value = { ...fillAnswers.value, [questionId]: (event.target as HTMLTextAreaElement).value };
}

function setRating(questionId: string, value: number): void {
  fillAnswers.value = { ...fillAnswers.value, [questionId]: value };
}

function currentRating(questionId: string): number {
  const value = fillAnswers.value[questionId];
  return typeof value === 'number' ? value : 0;
}

function submitFill(): void {
  const survey = activeSurvey.value;
  if (!survey) return;
  try {
    storeSubmitResponse(survey.id, fillAnswers.value);
    fillAnswers.value = {};
    toast.success(t('survey.submitted'));
    mode.value = 'result';
  } catch {
    toast.error(t('survey.fill_required'));
  }
}

// ── 结果 ──
function maxTally(survey: Survey, questionId: string): number {
  const counts = Object.values(tallyChoice(survey, questionId));
  return counts.length ? Math.max(1, ...counts) : 1;
}
</script>

<template>
  <WorkspacePageFrame :title="t('survey.title')" :subtitle="t('survey.subtitle')" :icon="ClipboardList">
    <template #actions>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
        data-testid="survey-new"
        @click="openSurveyComposer"
      >
        <Plus :size="16" />
        {{ t('survey.new') }}
      </button>
    </template>

    <!-- 新建问卷面板 -->
    <div v-if="surveyComposerOpen" class="flex flex-col gap-2 rounded-xl border border-border bg-sidebar p-4">
      <input
        v-model="draftSurveyTitle"
        type="text"
        :placeholder="t('survey.title_placeholder')"
        class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
        data-testid="survey-draft-title"
      />
      <input
        v-model="draftSurveyDesc"
        type="text"
        :placeholder="t('survey.desc_placeholder_optional')"
        class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
      />
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="h-9 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
          @click="surveyComposerOpen = false"
        >
          {{ t('survey.cancel') }}
        </button>
        <button
          type="button"
          class="h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
          data-testid="survey-submit"
          @click="submitSurvey"
        >
          {{ t('survey.create') }}
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="!activeSurvey"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center"
      data-testid="survey-empty"
    >
      <ClipboardList :size="28" class="text-muted-foreground" />
      <p class="text-[14px] font-medium text-foreground">{{ t('survey.empty_title') }}</p>
      <p class="text-[13px] text-muted-foreground">{{ t('survey.empty_hint') }}</p>
    </div>

    <template v-else>
      <!-- 问卷切换 -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="survey in surveys"
          :key="survey.id"
          type="button"
          class="h-8 rounded-lg border px-3 text-[13px] font-medium transition"
          :class="
            survey.id === activeSurvey.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent/40'
          "
          :data-testid="`survey-tab-${survey.id}`"
          @click="activeSurveyId = survey.id"
        >
          {{ survey.title }}
        </button>
      </div>

      <!-- 模式切换 + 删除 -->
      <div class="flex items-center justify-between gap-2">
        <div class="inline-flex rounded-lg border border-border p-0.5">
          <button
            v-for="m in modeIds"
            :key="m"
            type="button"
            class="h-8 rounded-md px-3 text-[13px] font-medium transition"
            :class="m === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/40'"
            :data-testid="`survey-mode-${m}`"
            @click="mode = m"
          >
            {{ t(`survey.mode_${m}`) }}
          </button>
        </div>
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          :aria-label="t('survey.delete')"
          @click="deleteSurvey(activeSurvey)"
        >
          <Trash2 :size="15" />
        </button>
      </div>

      <!-- 设计模式 -->
      <template v-if="mode === 'design'">
        <div class="grid gap-2 rounded-xl border border-border bg-card p-4">
          <input
            :value="activeSurvey.title"
            type="text"
            class="h-9 rounded-lg border border-border bg-background px-3 text-[14px] font-semibold outline-none focus:border-primary"
            :aria-label="t('survey.title_label')"
            @change="onSurveyMeta(activeSurvey, 'title', $event)"
          />
          <input
            :value="activeSurvey.description ?? ''"
            type="text"
            :placeholder="t('survey.desc_placeholder')"
            class="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-muted-foreground outline-none focus:border-primary"
            @change="onSurveyMeta(activeSurvey, 'description', $event)"
          />
        </div>

        <ul v-if="activeSurvey.questions.length" class="flex flex-col gap-2">
          <li
            v-for="(question, index) in activeSurvey.questions"
            :key="question.id"
            class="rounded-xl border border-border bg-card p-3"
            data-testid="survey-question"
          >
            <div class="flex items-center gap-2">
              <span class="shrink-0 text-[12px] text-muted-foreground">Q{{ index + 1 }}</span>
              <input
                :value="question.title"
                type="text"
                class="h-8 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[13px] text-foreground outline-none hover:border-border focus:border-primary"
                @change="onQuestionTitle(activeSurvey, question, $event)"
              />
              <span class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {{ questionTypeLabel(question.type) }}
              </span>
              <label class="flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  class="size-3.5 accent-primary"
                  :checked="question.required"
                  @change="onQuestionRequired(activeSurvey, question, $event)"
                />{{ t('survey.required') }}
              </label>
              <button
                type="button"
                class="shrink-0 text-muted-foreground transition hover:text-destructive"
                :aria-label="t('survey.delete_question')"
                @click="storeRemoveQuestion(activeSurvey.id, question.id)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
            <input
              v-if="isChoiceType(question.type)"
              :value="question.options.join(', ')"
              type="text"
              :placeholder="t('survey.options_placeholder')"
              class="mt-2 h-8 w-full rounded-lg border border-border bg-background px-2 text-[12px] text-muted-foreground outline-none focus:border-primary"
              @change="onQuestionOptions(activeSurvey, question, $event)"
            />
          </li>
        </ul>

        <!-- 题目编辑器 -->
        <div class="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-sidebar p-3">
          <label class="flex flex-1 flex-col gap-1 text-[12px] text-muted-foreground">
            {{ t('survey.question') }}
            <input
              v-model="draftQTitle"
              type="text"
              :placeholder="t('survey.question_placeholder')"
              class="h-9 min-w-[160px] rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              data-testid="survey-q-title"
            />
          </label>
          <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
            {{ t('survey.type') }}
            <select
              v-model="draftQType"
              class="h-9 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
            >
              <option v-for="type in QUESTION_TYPES" :key="type" :value="type">{{ questionTypeLabel(type) }}</option>
            </select>
          </label>
          <label v-if="isChoiceType(draftQType)" class="flex flex-col gap-1 text-[12px] text-muted-foreground">
            {{ t('survey.options') }}
            <input
              v-model="draftQOptions"
              type="text"
              :placeholder="t('survey.options_default')"
              class="h-9 w-56 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
            />
          </label>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
            data-testid="survey-add-question"
            @click="submitQuestion"
          >
            <Plus :size="15" />{{ t('survey.question') }}
          </button>
        </div>
      </template>

      <!-- 填写模式 -->
      <template v-else-if="mode === 'fill'">
        <div
          v-if="activeSurvey.questions.length === 0"
          class="rounded-xl border border-dashed border-border py-12 text-center text-[13px] text-muted-foreground"
        >
          {{ t('survey.fill_no_questions') }}
        </div>
        <template v-else>
          <div
            v-for="(question, index) in activeSurvey.questions"
            :key="question.id"
            class="rounded-xl border border-border bg-card p-4"
          >
            <p class="text-[14px] font-medium text-foreground">
              {{ index + 1 }}. {{ question.title }}
              <span v-if="question.required" class="text-destructive">*</span>
            </p>
            <div class="mt-2">
              <div v-if="question.type === 'single'" class="flex flex-col gap-1.5">
                <label
                  v-for="opt in question.options"
                  :key="opt"
                  class="flex items-center gap-2 text-[13px] text-foreground"
                >
                  <input
                    type="radio"
                    class="size-4 accent-primary"
                    :name="`q-${question.id}`"
                    :checked="fillAnswers[question.id] === opt"
                    @change="setSingle(question.id, opt)"
                  />{{ opt }}
                </label>
              </div>
              <div v-else-if="question.type === 'multiple'" class="flex flex-col gap-1.5">
                <label
                  v-for="opt in question.options"
                  :key="opt"
                  class="flex items-center gap-2 text-[13px] text-foreground"
                >
                  <input
                    type="checkbox"
                    class="size-4 accent-primary"
                    :checked="pickedOptions(question.id).includes(opt)"
                    @change="toggleMultiple(question.id, opt)"
                  />{{ opt }}
                </label>
              </div>
              <div v-else-if="question.type === 'rating'" class="flex items-center gap-1">
                <button
                  v-for="n in RATING_MAX"
                  :key="n"
                  type="button"
                  class="transition"
                  :class="n <= currentRating(question.id) ? 'text-warning' : 'text-muted-foreground hover:text-warning'"
                  :aria-label="t('survey.rating_aria', { n })"
                  @click="setRating(question.id, n)"
                >
                  <Star :size="22" :fill="n <= currentRating(question.id) ? 'currentColor' : 'none'" />
                </button>
              </div>
              <textarea
                v-else
                :value="typeof fillAnswers[question.id] === 'string' ? (fillAnswers[question.id] as string) : ''"
                rows="2"
                :placeholder="t('survey.text_placeholder')"
                class="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                @input="setText(question.id, $event)"
              />
            </div>
          </div>
          <div class="flex justify-end">
            <button
              type="button"
              class="h-9 rounded-lg bg-primary px-5 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
              data-testid="survey-submit-response"
              @click="submitFill"
            >
              {{ t('survey.submit') }}
            </button>
          </div>
        </template>
      </template>

      <!-- 结果模式 -->
      <template v-else>
        <p class="text-[13px] text-muted-foreground">
          {{ t('survey.responses_count', { count: activeSurvey.responses.length }) }}
        </p>
        <div
          v-for="(question, index) in activeSurvey.questions"
          :key="question.id"
          class="rounded-xl border border-border bg-card p-4"
        >
          <p class="text-[14px] font-medium text-foreground">{{ index + 1 }}. {{ question.title }}</p>
          <div class="mt-3">
            <div v-if="isChoiceType(question.type)" class="flex flex-col gap-2">
              <div v-for="opt in question.options" :key="opt" class="flex items-center gap-2 text-[12px]">
                <span class="w-24 shrink-0 truncate text-muted-foreground">{{ opt }}</span>
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-primary"
                    :style="{
                      width: `${(tallyChoice(activeSurvey, question.id)[opt] / maxTally(activeSurvey, question.id)) * 100}%`,
                    }"
                  />
                </div>
                <span class="w-8 shrink-0 text-right text-foreground">{{
                  tallyChoice(activeSurvey, question.id)[opt]
                }}</span>
              </div>
            </div>
            <div v-else-if="question.type === 'rating'" class="text-[13px] text-foreground">
              {{ t('survey.avg_score') }}
              <span class="text-[18px] font-semibold text-warning">{{
                averageRating(activeSurvey, question.id).average
              }}</span>
              <span class="text-[12px] text-muted-foreground">{{
                t('survey.rating_count', { count: averageRating(activeSurvey, question.id).count })
              }}</span>
            </div>
            <ul v-else class="flex flex-col gap-1.5">
              <li
                v-for="(answer, i) in textAnswers(activeSurvey, question.id)"
                :key="i"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] text-foreground"
              >
                {{ answer }}
              </li>
              <li v-if="textAnswers(activeSurvey, question.id).length === 0" class="text-[12px] text-muted-foreground">
                {{ t('survey.no_text') }}
              </li>
            </ul>
          </div>
        </div>
      </template>
    </template>
  </WorkspacePageFrame>
</template>
