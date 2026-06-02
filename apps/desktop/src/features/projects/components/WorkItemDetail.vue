<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk';
import type { CustomField, Priority, Workflow, WorkItemType } from '../types';
import type { WorkItemComment } from '@/matrix/projects';
import { getClient } from '@matrix/client';
import { Avatar } from '@muon/ui/avatar';
import { Button } from '@muon/ui/button';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select';
import { Textarea } from '@muon/ui/textarea';
import { Trash2, X } from 'lucide-vue-next';
import { RoomEvent } from 'matrix-js-sdk';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getWorkItemComments, isWorkItemCommentEvent, sendWorkItemComment } from '@/matrix/projects';
import { useContactList } from '@/shared/composables/useContactList';
import { useWorkflow } from '../composables/useWorkflow';
import { useWorkItemStore } from '../composables/useWorkItemStore';
import { projectRepo } from '../db/projectDb';
import { PRIORITIES, WORK_ITEM_TYPES } from '../types';
import WorkItemAssigneePicker from './WorkItemAssigneePicker.vue';

const props = defineProps<{ itemId: string }>();
const emit = defineEmits<{ close: [] }>();

const { t, locale } = useI18n();
const store = useWorkItemStore();
const contactList = useContactList();
const item = computed(() => store.currentItems.find((i) => i.id === props.itemId));

// ── 工作项评论（挂项目 Matrix 房间） ──
const comments = ref<WorkItemComment[]>([]);
const commentDraft = ref('');
const sendingComment = ref(false);

function loadComments(): void {
  const current = item.value;
  comments.value = current ? getWorkItemComments(current.projectId, current.id) : [];
}

async function postComment(): Promise<void> {
  const current = item.value;
  const body = commentDraft.value.trim();
  if (!current || !body || sendingComment.value) return;
  sendingComment.value = true;
  try {
    await sendWorkItemComment(current.projectId, current.id, body);
    commentDraft.value = '';
    loadComments();
  } finally {
    sendingComment.value = false;
  }
}

function commentAuthor(userId: string): string {
  const contact = contactList.contacts.find((c) => c.userId === userId);
  if (contact) return contact.displayName;
  return getClient().getUser(userId)?.displayName || userId.split(':')[0]?.replace(/^@/, '') || userId;
}

function formatCommentTime(ts: number): string {
  return new Date(ts).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

let unsubscribeComments: (() => void) | null = null;
onMounted(() => {
  contactList.ensureContactsLoaded();
  const client = getClient();
  const handler = (event: MatrixEvent): void => {
    if (isWorkItemCommentEvent(event) && event.getRoomId() === item.value?.projectId) loadComments();
  };
  client.on(RoomEvent.Timeline, handler);
  unsubscribeComments = () => client.off(RoomEvent.Timeline, handler);
});
onUnmounted(() => unsubscribeComments?.());

interface AvailableTransition {
  toStatus: string;
  label: string;
}

const { loadWorkflow, changeStatus } = useWorkflow(() => item.value?.projectId ?? '');

const availableTransitions = ref<AvailableTransition[]>([]);
const editing = ref(false);
const editTitle = ref('');
const editDescription = ref('');
const customFields = ref<CustomField[]>([]);

watch(
  () => props.itemId,
  async () => {
    const current = item.value;
    if (!current) {
      customFields.value = [];
      comments.value = [];
      return;
    }
    loadComments();
    const wf = await loadWorkflow();
    availableTransitions.value = buildAvailableTransitions(wf, current.status);
    customFields.value = await projectRepo.listCustomFields(current.projectId);
    editTitle.value = current.title;
    editDescription.value = current.description;
  },
  { immediate: true },
);

function buildAvailableTransitions(wf: Workflow, currentStatus: string): AvailableTransition[] {
  const statusByKey = new Map(wf.statuses.map((status) => [status.key, status]));
  return wf.transitions
    .filter((transition) => transition.from === currentStatus)
    .map((transition) => ({
      toStatus: transition.to,
      label: transition.name?.trim() || statusByKey.get(transition.to)?.name || transition.to,
    }));
}

async function handleSave() {
  if (!item.value) return;
  await store.updateItem(item.value.id, {
    title: editTitle.value,
    description: editDescription.value,
  });
  editing.value = false;
}

async function handleTransition(toStatus: string) {
  await changeStatus(props.itemId, toStatus);
}

async function handleDelete() {
  if (!item.value) return;
  await store.deleteItem(item.value.id, item.value.projectId);
  emit('close');
}

const priorityOptions = PRIORITIES;
const typeOptions = WORK_ITEM_TYPES;

function isPriority(value: string | number): value is Priority {
  return typeof value === 'string' && priorityOptions.includes(value as Priority);
}

function isWorkItemType(value: string | number): value is WorkItemType {
  return typeof value === 'string' && typeOptions.includes(value as WorkItemType);
}

async function updatePriority(value: string | number) {
  const current = item.value;
  if (!current || !isPriority(value)) return;
  await store.updateItem(current.id, { priority: value });
}

async function updateType(value: string | number) {
  const current = item.value;
  if (!current || !isWorkItemType(value)) return;
  await store.updateItem(current.id, { type: value });
}

async function updateDueDate(value: string | number) {
  const current = item.value;
  if (!current) return;
  const dateValue = String(value);
  await store.updateItem(current.id, { dueDate: dateValue ? new Date(dateValue).getTime() : undefined });
}

async function updateAssignee(value: string | undefined) {
  const current = item.value;
  if (!current) return;

  await store.updateItem(current.id, { assignee: value });
}

function customFieldInputType(field: CustomField): string {
  if (field.type === 'number') return 'number';
  if (field.type === 'date') return 'date';
  if (field.type === 'url') return 'url';
  return 'text';
}

function customFieldStringValue(field: CustomField): string {
  const value = item.value?.customFields?.[field.id];
  if (Array.isArray(value)) return value.map(String).join(', ');
  return value == null ? '' : String(value);
}

function customFieldArrayValue(field: CustomField): string[] {
  const value = item.value?.customFields?.[field.id];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim())
    return value
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean);
  return [];
}

function normalizeCustomFieldValue(field: CustomField, value: string | number | string[] | undefined): unknown {
  if (field.type === 'multiSelect') {
    const selected = Array.isArray(value)
      ? value.map((option) => option.trim()).filter(Boolean)
      : String(value ?? '')
          .split(',')
          .map((option) => option.trim())
          .filter(Boolean);
    return selected.length > 0 ? selected : undefined;
  }

  if (value == null || String(value).trim() === '') return undefined;

  if (field.type === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return String(value).trim();
}

async function updateCustomField(field: CustomField, value: string | number | string[] | undefined) {
  const current = item.value;
  if (!current) return;

  const normalized = normalizeCustomFieldValue(field, value);
  const nextCustomFields = { ...(current.customFields ?? {}) };

  if (normalized === undefined) delete nextCustomFields[field.id];
  else nextCustomFields[field.id] = normalized;

  await store.updateItem(current.id, { customFields: nextCustomFields });
}

function toggleMultiSelectCustomField(field: CustomField, option: string, checked: boolean) {
  const selected = new Set(customFieldArrayValue(field));
  if (checked) selected.add(option);
  else selected.delete(option);
  void updateCustomField(field, [...selected]);
}
</script>

<template>
  <div
    v-if="item"
    class="absolute inset-y-0 right-0 z-40 flex w-96 max-w-full flex-col border-l bg-background shadow-xl"
  >
    <div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
      <h2 class="font-semibold">
        {{ t('projects.task_title') }}
      </h2>
      <Button variant="ghost" size="icon" @click="emit('close')">
        <X class="h-4 w-4" />
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <div class="flex flex-col gap-4">
        <!-- Title & Description -->
        <div v-if="editing" class="grid gap-2">
          <Label>{{ t('projects.task_title') }}</Label>
          <Input v-model="editTitle" />
          <Label>{{ t('projects.project_description') }}</Label>
          <Textarea v-model="editDescription" :rows="4" />
          <div class="flex gap-2">
            <Button size="sm" @click="handleSave()">
              {{ t('common.save') }}
            </Button>
            <Button size="sm" variant="outline" @click="editing = false">
              {{ t('common.cancel') }}
            </Button>
          </div>
        </div>
        <div v-else>
          <h3 class="text-lg font-medium" @dblclick="editing = true">
            {{ item.title }}
          </h3>
          <p v-if="item.description" class="mt-2 text-sm text-muted-foreground">
            {{ item.description }}
          </p>
          <Button variant="ghost" size="sm" class="mt-1" @click="editing = true">
            {{ t('common.edit') }}
          </Button>
        </div>

        <!-- Priority -->
        <div class="grid gap-1.5">
          <Label class="text-xs text-muted-foreground">{{ t('projects.priority') }}</Label>
          <Select :model-value="item.priority" @update:model-value="updatePriority">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in priorityOptions" :key="p" :value="p">
                {{ t(`projects.priority_${p}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Assignee -->
        <div class="grid gap-1.5">
          <Label class="text-xs text-muted-foreground">{{ t('projects.assignee') }}</Label>
          <WorkItemAssigneePicker
            data-testid="project-task-assignee-picker"
            :model-value="item.assignee"
            @update:model-value="updateAssignee"
          />
        </div>

        <!-- Type -->
        <div class="grid gap-1.5">
          <Label class="text-xs text-muted-foreground">{{ t('projects.type') }}</Label>
          <Select :model-value="item.type" @update:model-value="updateType">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="tp in typeOptions" :key="tp" :value="tp">
                {{ t(`projects.type_${tp}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Due Date -->
        <div class="grid gap-1.5">
          <Label class="text-xs text-muted-foreground">{{ t('projects.due_date') }}</Label>
          <Input
            type="date"
            :model-value="item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : ''"
            @update:model-value="updateDueDate"
          />
        </div>

        <!-- Custom Fields -->
        <div v-if="customFields.length > 0" class="grid gap-2">
          <Label class="text-xs text-muted-foreground">{{ t('projects.custom_fields') }}</Label>
          <div class="grid gap-2">
            <div v-for="field in customFields" :key="field.id" class="grid gap-1.5">
              <Label class="text-xs text-muted-foreground">
                {{ field.name || t('projects.field_name') }}
              </Label>
              <WorkItemAssigneePicker
                v-if="field.type === 'user'"
                :model-value="customFieldStringValue(field)"
                :data-testid="`project-task-custom-field-${field.id}`"
                @update:model-value="updateCustomField(field, $event)"
              />
              <select
                v-else-if="field.type === 'select'"
                :value="customFieldStringValue(field)"
                :data-testid="`project-task-custom-field-${field.id}`"
                class="rounded-md border border-input bg-background px-3 py-2 text-sm"
                @change="updateCustomField(field, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">
                  {{ t('projects.field_empty_option') }}
                </option>
                <option v-for="option in field.options" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>
              <div
                v-else-if="field.type === 'multiSelect'"
                :data-testid="`project-task-custom-field-${field.id}`"
                class="flex flex-wrap gap-1.5"
              >
                <label
                  v-for="(option, optionIndex) in field.options"
                  :key="option"
                  class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    :checked="customFieldArrayValue(field).includes(option)"
                    :data-testid="`project-task-custom-field-${field.id}-option-${optionIndex}`"
                    @change="toggleMultiSelectCustomField(field, option, ($event.target as HTMLInputElement).checked)"
                  />
                  {{ option }}
                </label>
              </div>
              <Input
                v-else
                :type="customFieldInputType(field)"
                :model-value="customFieldStringValue(field)"
                :data-testid="`project-task-custom-field-${field.id}`"
                @update:model-value="updateCustomField(field, $event)"
              />
            </div>
          </div>
        </div>

        <!-- Transitions -->
        <div v-if="availableTransitions.length > 0" class="grid gap-1.5">
          <Label class="text-xs text-muted-foreground">{{ t('projects.status') }}</Label>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="transition in availableTransitions"
              :key="transition.toStatus"
              size="sm"
              variant="outline"
              :data-testid="`project-task-transition-${transition.toStatus}`"
              @click="handleTransition(transition.toStatus)"
            >
              {{ transition.label }}
            </Button>
          </div>
        </div>

        <!-- Comments -->
        <div class="grid gap-2 border-t pt-3">
          <Label class="text-xs text-muted-foreground">{{ t('projects.comments') }}</Label>
          <div v-if="comments.length === 0" class="text-xs text-muted-foreground">
            {{ t('projects.no_comments') }}
          </div>
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="rounded-md border border-border bg-muted/30 p-2"
            data-testid="project-task-comment"
          >
            <div class="flex items-center gap-1.5">
              <Avatar :alt="commentAuthor(comment.sender)" :color-id="comment.sender" size="xs" />
              <span class="truncate text-[11px] font-semibold">{{ commentAuthor(comment.sender) }}</span>
              <span class="text-[10px] text-muted-foreground">{{ formatCommentTime(comment.ts) }}</span>
            </div>
            <p class="mt-1 whitespace-pre-wrap break-words text-[12px]">{{ comment.body }}</p>
          </div>
          <div class="flex items-center gap-2">
            <Input
              v-model="commentDraft"
              data-testid="project-task-comment-input"
              :placeholder="t('projects.comment_placeholder')"
              @keydown.enter="postComment()"
            />
            <Button
              size="sm"
              data-testid="project-task-comment-send"
              :disabled="!commentDraft.trim() || sendingComment"
              @click="postComment()"
            >
              {{ t('projects.post_comment') }}
            </Button>
          </div>
        </div>

        <!-- Delete -->
        <Button variant="destructive" size="sm" @click="handleDelete()">
          <Trash2 class="mr-1 h-3.5 w-3.5" />
          {{ t('common.delete') }}
        </Button>
      </div>
    </div>
  </div>
</template>
