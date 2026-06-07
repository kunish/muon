<script setup lang="ts">
import type { BitableRecord, BitableTable, CellValue, Field, FieldType } from '../types/bitable';
import { useSelector } from '@tanstack/vue-store';
import { Plus, Table2, Trash2 } from 'lucide-vue-next';
import { computed, onMounted, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { toast } from 'vue-sonner';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  bitableStore,
  selectTables,
  addField as storeAddField,
  addRecord as storeAddRecord,
  addTable as storeAddTable,
  removeField as storeRemoveField,
  removeRecord as storeRemoveRecord,
  removeTable as storeRemoveTable,
  renameTable as storeRenameTable,
  setCell as storeSetCell,
} from '../stores/bitableStore';
import { defaultCellValue, FIELD_TYPES } from '../types/bitable';

const { t } = useI18n();

const tables = useSelector(bitableStore, selectTables);

function fieldTypeLabel(type: FieldType): string {
  return t(`bitable.type_${type}`);
}

// ── 当前表格 ──
const activeTableId = shallowRef<string | null>(null);
const activeTable = computed<BitableTable | null>(() => {
  const list = tables.value;
  if (list.length === 0) return null;
  return list.find((table) => table.id === activeTableId.value) ?? list[0];
});

function selectTable(id: string): void {
  activeTableId.value = id;
}

// 全局搜索深链：?focus=<tableId> 时选中该数据表。
const route = useRoute();
onMounted(() => {
  const focus = typeof route.query.focus === 'string' ? route.query.focus : null;
  if (focus && tables.value.some((table) => table.id === focus)) activeTableId.value = focus;
});

function createTable(): void {
  const table = storeAddTable(t('bitable.default_table_name', { index: tables.value.length + 1 }));
  activeTableId.value = table.id;
}

function deleteTable(table: BitableTable): void {
  storeRemoveTable(table.id);
  if (activeTableId.value === table.id) activeTableId.value = null;
  toast.success(t('bitable.table_deleted', { name: table.name }));
}

function onRenameTable(table: BitableTable, event: Event): void {
  storeRenameTable(table.id, (event.target as HTMLInputElement).value);
}

// ── 字段（列） ──
const fieldComposerOpen = shallowRef(false);
const draftFieldName = shallowRef('');
const draftFieldType = shallowRef<FieldType>('text');
const draftFieldOptions = shallowRef('');

function openFieldComposer(): void {
  draftFieldName.value = '';
  draftFieldType.value = 'text';
  draftFieldOptions.value = '';
  fieldComposerOpen.value = true;
}

function submitField(): void {
  const table = activeTable.value;
  if (!table) return;
  const name = draftFieldName.value.trim();
  if (!name) {
    toast.error(t('bitable.field_name_required'));
    return;
  }
  storeAddField(table.id, {
    name,
    type: draftFieldType.value,
    options:
      draftFieldType.value === 'select'
        ? draftFieldOptions.value
            .split(/[,，]/)
            .map((opt) => opt.trim())
            .filter(Boolean)
        : undefined,
  });
  fieldComposerOpen.value = false;
}

function deleteField(field: Field): void {
  const table = activeTable.value;
  if (!table) return;
  if (table.fields.length <= 1) {
    toast.error(t('bitable.keep_one_field'));
    return;
  }
  storeRemoveField(table.id, field.id);
}

// ── 记录（行） ──
function createRecord(): void {
  const table = activeTable.value;
  if (!table) return;
  storeAddRecord(table.id);
}

function deleteRecord(record: BitableRecord): void {
  const table = activeTable.value;
  if (!table) return;
  storeRemoveRecord(table.id, record.id);
}

// ── 单元格 ──
function cellValue(record: BitableRecord, field: Field): CellValue {
  return field.id in record.cells ? record.cells[field.id] : defaultCellValue(field.type);
}

function onCellInput(record: BitableRecord, field: Field, event: Event): void {
  const table = activeTable.value;
  if (!table) return;
  const target = event.target as HTMLInputElement;
  const raw = field.type === 'checkbox' ? target.checked : target.value;
  storeSetCell(table.id, record.id, field.id, raw);
}

// ── 筛选 + 排序 ──
const filterFieldId = shallowRef<string | null>(null);
const filterText = shallowRef('');
const sortFieldId = shallowRef<string | null>(null);
const sortDir = shallowRef<'asc' | 'desc'>('asc');

/** 单元格的字符串呈现，用于筛选与字符串排序。 */
function cellText(record: BitableRecord, field: Field): string {
  const value = cellValue(record, field);
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? t('bitable.yes') : '';
  return String(value);
}

function clearFilterSort(): void {
  filterFieldId.value = null;
  filterText.value = '';
  sortFieldId.value = null;
  sortDir.value = 'asc';
}

/** 当前表格经筛选与排序后的记录（网格与看板共用；无筛选/排序时即原始顺序）。 */
const displayRecords = computed<BitableRecord[]>(() => {
  const table = activeTable.value;
  if (!table) return [];
  let records = table.records;

  const filterField = table.fields.find((field) => field.id === filterFieldId.value);
  const query = filterText.value.trim().toLowerCase();
  if (filterField && query) {
    records = records.filter((record) => cellText(record, filterField).toLowerCase().includes(query));
  }

  const sortField = table.fields.find((field) => field.id === sortFieldId.value);
  if (sortField) {
    const dir = sortDir.value === 'asc' ? 1 : -1;
    records = [...records].sort((a, b) => {
      if (sortField.type === 'number') {
        const av = cellValue(a, sortField);
        const bv = cellValue(b, sortField);
        const na = typeof av === 'number' ? av : null;
        const nb = typeof bv === 'number' ? bv : null;
        if (na === null && nb === null) return 0;
        if (na === null) return 1;
        if (nb === null) return -1;
        return (na - nb) * dir;
      }
      const sa = cellText(a, sortField);
      const sb = cellText(b, sortField);
      if (!sa && !sb) return 0;
      if (!sa) return 1;
      if (!sb) return -1;
      return sa.localeCompare(sb) * dir;
    });
  }

  return records;
});

// ── 视图：表格 / 看板（按某个单选字段分组） ──
const UNGROUPED = '__ungrouped__';
const viewMode = shallowRef<'grid' | 'kanban' | 'gallery'>('grid');
const kanbanFieldId = shallowRef<string | null>(null);

const selectFields = computed<Field[]>(
  () => activeTable.value?.fields.filter((field) => field.type === 'select') ?? [],
);

const kanbanField = computed<Field | null>(() => {
  const fields = selectFields.value;
  if (fields.length === 0) return null;
  return fields.find((field) => field.id === kanbanFieldId.value) ?? fields[0];
});

interface KanbanColumn {
  key: string;
  label: string;
  records: BitableRecord[];
}

const kanbanColumns = computed<KanbanColumn[]>(() => {
  const table = activeTable.value;
  const field = kanbanField.value;
  if (!table || !field) return [];
  const columns: KanbanColumn[] = (field.options ?? []).map((opt) => ({ key: opt, label: opt, records: [] }));
  const ungrouped: KanbanColumn = { key: UNGROUPED, label: t('bitable.ungrouped'), records: [] };
  const byKey = new Map(columns.map((column) => [column.key, column]));
  for (const record of displayRecords.value) {
    const value = cellValue(record, field);
    const target = typeof value === 'string' && byKey.has(value) ? byKey.get(value)! : ungrouped;
    target.records.push(record);
  }
  return [...columns, ungrouped];
});

/** 卡片标题取第一个文本字段（无则第一个字段）的值。 */
function recordTitle(record: BitableRecord): string {
  const table = activeTable.value;
  if (!table) return '';
  const titleField = table.fields.find((field) => field.type === 'text') ?? table.fields[0];
  if (!titleField) return t('bitable.untitled_record');
  const value = cellValue(record, titleField);
  const text = typeof value === 'string' ? value : value === null ? '' : String(value);
  return text || t('bitable.untitled_record');
}

function moveRecord(record: BitableRecord, key: string): void {
  const table = activeTable.value;
  const field = kanbanField.value;
  if (!table || !field) return;
  storeSetCell(table.id, record.id, field.id, key === UNGROUPED ? '' : key);
}

function addRecordToColumn(key: string): void {
  const table = activeTable.value;
  const field = kanbanField.value;
  if (!table || !field) return;
  storeAddRecord(table.id);
  const created = bitableStore.state.tables.find((item) => item.id === table.id)?.records.at(-1);
  if (created && key !== UNGROUPED) storeSetCell(table.id, created.id, field.id, key);
}
</script>

<template>
  <WorkspacePageFrame :title="t('bitable.title')" :subtitle="t('bitable.subtitle')" :icon="Table2">
    <template #actions>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
        data-testid="bitable-new-table"
        @click="createTable"
      >
        <Plus :size="16" />
        {{ t('bitable.new_table') }}
      </button>
    </template>

    <!-- 空状态 -->
    <div
      v-if="!activeTable"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center"
      data-testid="bitable-empty"
    >
      <Table2 :size="28" class="text-muted-foreground" />
      <p class="text-[14px] font-medium text-foreground">{{ t('bitable.empty_title') }}</p>
      <p class="text-[13px] text-muted-foreground">{{ t('bitable.empty_hint') }}</p>
    </div>

    <template v-else>
      <!-- 表格切换 -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="table in tables"
          :key="table.id"
          type="button"
          class="h-8 rounded-lg border px-3 text-[13px] font-medium transition"
          :class="
            table.id === activeTable.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-accent/40'
          "
          :data-testid="`bitable-tab-${table.id}`"
          @click="selectTable(table.id)"
        >
          {{ table.name }}
        </button>
      </div>

      <!-- 工具栏 -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <input
          :value="activeTable.name"
          type="text"
          class="h-9 rounded-lg border border-border bg-background px-3 text-[14px] font-semibold outline-none focus:border-primary"
          :aria-label="t('bitable.table_name_label')"
          @change="onRenameTable(activeTable, $event)"
        />
        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              class="h-8 rounded-md px-2.5 text-[12px] font-medium transition"
              :class="
                viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/40'
              "
              data-testid="bitable-view-grid"
              @click="viewMode = 'grid'"
            >
              {{ t('bitable.view_grid') }}
            </button>
            <button
              type="button"
              class="h-8 rounded-md px-2.5 text-[12px] font-medium transition"
              :class="
                viewMode === 'kanban'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent/40'
              "
              data-testid="bitable-view-kanban"
              @click="viewMode = 'kanban'"
            >
              {{ t('bitable.view_kanban') }}
            </button>
            <button
              type="button"
              class="h-8 rounded-md px-2.5 text-[12px] font-medium transition"
              :class="
                viewMode === 'gallery'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent/40'
              "
              data-testid="bitable-view-gallery"
              @click="viewMode = 'gallery'"
            >
              {{ t('bitable.view_gallery') }}
            </button>
          </div>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
            @click="openFieldComposer"
          >
            <Plus :size="15" />{{ t('bitable.field') }}
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
            data-testid="bitable-add-record"
            @click="createRecord"
          >
            <Plus :size="15" />{{ t('bitable.record') }}
          </button>
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            :aria-label="t('bitable.delete_table')"
            @click="deleteTable(activeTable)"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </div>

      <!-- 字段编辑器 -->
      <div
        v-if="fieldComposerOpen"
        class="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-sidebar p-3"
      >
        <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
          {{ t('bitable.field_name') }}
          <input
            v-model="draftFieldName"
            type="text"
            :placeholder="t('bitable.field_name_placeholder')"
            class="h-9 w-40 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
            data-testid="bitable-field-name"
          />
        </label>
        <label class="flex flex-col gap-1 text-[12px] text-muted-foreground">
          {{ t('bitable.field_type') }}
          <select
            v-model="draftFieldType"
            class="h-9 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
          >
            <option v-for="type in FIELD_TYPES" :key="type" :value="type">{{ fieldTypeLabel(type) }}</option>
          </select>
        </label>
        <label v-if="draftFieldType === 'select'" class="flex flex-col gap-1 text-[12px] text-muted-foreground">
          {{ t('bitable.options_label') }}
          <input
            v-model="draftFieldOptions"
            type="text"
            :placeholder="t('bitable.options_placeholder')"
            class="h-9 w-56 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <button
          type="button"
          class="h-9 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90"
          data-testid="bitable-submit-field"
          @click="submitField"
        >
          {{ t('bitable.add_field') }}
        </button>
        <button
          type="button"
          class="h-9 rounded-lg border border-border px-3 text-[13px] text-muted-foreground transition hover:bg-accent/40"
          @click="fieldComposerOpen = false"
        >
          {{ t('bitable.cancel') }}
        </button>
      </div>

      <!-- 筛选 + 排序 -->
      <div class="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span>{{ t('bitable.filter') }}</span>
        <select
          :value="filterFieldId ?? ''"
          class="h-8 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
          data-testid="bitable-filter-field"
          @change="filterFieldId = ($event.target as HTMLSelectElement).value || null"
        >
          <option value="">{{ t('bitable.filter_none') }}</option>
          <option v-for="field in activeTable.fields" :key="field.id" :value="field.id">{{ field.name }}</option>
        </select>
        <input
          v-if="filterFieldId"
          v-model="filterText"
          type="text"
          :placeholder="t('bitable.filter_contains')"
          class="h-8 w-32 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
          data-testid="bitable-filter-text"
        />
        <span class="ml-2">{{ t('bitable.sort') }}</span>
        <select
          :value="sortFieldId ?? ''"
          class="h-8 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
          data-testid="bitable-sort-field"
          @change="sortFieldId = ($event.target as HTMLSelectElement).value || null"
        >
          <option value="">{{ t('bitable.sort_none') }}</option>
          <option v-for="field in activeTable.fields" :key="field.id" :value="field.id">{{ field.name }}</option>
        </select>
        <button
          v-if="sortFieldId"
          type="button"
          class="h-8 rounded-lg border border-border px-2 text-[13px] text-foreground transition hover:bg-accent/40"
          data-testid="bitable-sort-dir"
          @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
        >
          {{ sortDir === 'asc' ? t('bitable.sort_asc') : t('bitable.sort_desc') }}
        </button>
        <button
          v-if="filterFieldId || sortFieldId"
          type="button"
          class="h-8 rounded-lg px-2 text-[13px] text-primary transition hover:bg-accent/40"
          @click="clearFilterSort"
        >
          {{ t('bitable.clear') }}
        </button>
      </div>

      <!-- 网格视图 -->
      <div v-if="viewMode === 'grid'" class="overflow-x-auto rounded-xl border border-border">
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr class="bg-sidebar">
              <th
                v-for="field in activeTable.fields"
                :key="field.id"
                class="border-b border-r border-border px-3 py-2 text-left font-semibold text-foreground"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate">{{ field.name }}</span>
                  <span class="flex items-center gap-1">
                    <span class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                      {{ fieldTypeLabel(field.type) }}
                    </span>
                    <button
                      type="button"
                      class="text-muted-foreground transition hover:text-destructive"
                      :aria-label="t('bitable.delete_field')"
                      @click="deleteField(field)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </span>
                </div>
              </th>
              <th class="w-10 border-b border-border px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-if="displayRecords.length === 0">
              <td
                :colspan="activeTable.fields.length + 1"
                class="px-3 py-6 text-center text-[13px] text-muted-foreground"
                data-testid="bitable-no-records"
              >
                {{ activeTable.records.length === 0 ? t('bitable.no_records_grid') : t('bitable.no_match') }}
              </td>
            </tr>
            <tr v-for="record in displayRecords" :key="record.id" class="hover:bg-accent/20" data-testid="bitable-row">
              <td
                v-for="field in activeTable.fields"
                :key="field.id"
                class="border-b border-r border-border px-2 py-1.5 align-middle"
              >
                <input
                  v-if="field.type === 'checkbox'"
                  type="checkbox"
                  class="size-4 accent-primary"
                  :checked="cellValue(record, field) === true"
                  @change="onCellInput(record, field, $event)"
                />
                <select
                  v-else-if="field.type === 'select'"
                  class="h-7 w-full rounded border border-transparent bg-transparent px-1 text-[13px] outline-none hover:border-border focus:border-primary"
                  :value="cellValue(record, field)"
                  @change="onCellInput(record, field, $event)"
                >
                  <option value="">—</option>
                  <option v-for="opt in field.options ?? []" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <input
                  v-else
                  :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'"
                  class="h-7 w-full rounded border border-transparent bg-transparent px-1 text-[13px] outline-none hover:border-border focus:border-primary"
                  :value="cellValue(record, field) ?? ''"
                  @change="onCellInput(record, field, $event)"
                />
              </td>
              <td class="border-b border-border px-2 py-1.5 text-center">
                <button
                  type="button"
                  class="text-muted-foreground transition hover:text-destructive"
                  :aria-label="t('bitable.delete_record')"
                  @click="deleteRecord(record)"
                >
                  <Trash2 :size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 看板视图 -->
      <template v-else-if="viewMode === 'kanban'">
        <div
          v-if="!kanbanField"
          class="rounded-xl border border-dashed border-border py-12 text-center text-[13px] text-muted-foreground"
          data-testid="bitable-kanban-empty"
        >
          {{ t('bitable.kanban_need_select') }}
        </div>
        <template v-else>
          <div v-if="selectFields.length > 1" class="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span>{{ t('bitable.group_by') }}</span>
            <select
              :value="kanbanField.id"
              class="h-8 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-primary"
              data-testid="bitable-kanban-group-field"
              @change="kanbanFieldId = ($event.target as HTMLSelectElement).value"
            >
              <option v-for="field in selectFields" :key="field.id" :value="field.id">{{ field.name }}</option>
            </select>
          </div>
          <div class="flex gap-3 overflow-x-auto pb-2">
            <section
              v-for="column in kanbanColumns"
              :key="column.key"
              class="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-sidebar"
              :data-testid="`bitable-kanban-column-${column.key}`"
            >
              <header class="flex items-center justify-between border-b border-border px-3 py-2">
                <span class="truncate text-[13px] font-medium text-foreground">{{ column.label }}</span>
                <span class="flex items-center gap-1.5">
                  <span class="text-[12px] text-muted-foreground">{{ column.records.length }}</span>
                  <button
                    type="button"
                    class="text-muted-foreground transition hover:text-foreground"
                    :aria-label="t('bitable.add_to_column')"
                    @click="addRecordToColumn(column.key)"
                  >
                    <Plus :size="14" />
                  </button>
                </span>
              </header>
              <div class="flex flex-col gap-2 p-2">
                <article
                  v-for="record in column.records"
                  :key="record.id"
                  class="rounded-lg border border-border bg-card p-2.5"
                  data-testid="bitable-kanban-card"
                >
                  <p class="truncate text-[13px] text-foreground">{{ recordTitle(record) }}</p>
                  <div class="mt-2 flex items-center gap-1.5">
                    <select
                      class="h-7 min-w-0 flex-1 rounded border border-border bg-background px-1 text-[12px] text-muted-foreground outline-none focus:border-primary"
                      :value="column.key"
                      :aria-label="t('bitable.move_to_group')"
                      @change="moveRecord(record, ($event.target as HTMLSelectElement).value)"
                    >
                      <option v-for="col in kanbanColumns" :key="col.key" :value="col.key">{{ col.label }}</option>
                    </select>
                    <button
                      type="button"
                      class="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      :aria-label="t('bitable.delete_record')"
                      @click="deleteRecord(record)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </div>
                </article>
                <p v-if="column.records.length === 0" class="px-1 py-2 text-center text-[12px] text-muted-foreground">
                  {{ t('bitable.empty_column') }}
                </p>
              </div>
            </section>
          </div>
        </template>
      </template>

      <!-- 画册视图 -->
      <template v-else>
        <div
          v-if="displayRecords.length === 0"
          class="rounded-xl border border-dashed border-border py-12 text-center text-[13px] text-muted-foreground"
        >
          {{ activeTable.records.length === 0 ? t('bitable.no_records_gallery') : t('bitable.no_match') }}
        </div>
        <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="record in displayRecords"
            :key="record.id"
            class="rounded-xl border border-border bg-card p-3"
            data-testid="bitable-gallery-card"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <span class="truncate text-[14px] font-medium text-foreground">{{ recordTitle(record) }}</span>
              <button
                type="button"
                class="shrink-0 text-muted-foreground transition hover:text-destructive"
                :aria-label="t('bitable.delete_record')"
                @click="deleteRecord(record)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
            <div class="flex flex-col gap-1.5">
              <label v-for="field in activeTable.fields" :key="field.id" class="flex items-center gap-2 text-[12px]">
                <span class="w-16 shrink-0 truncate text-muted-foreground">{{ field.name }}</span>
                <input
                  v-if="field.type === 'checkbox'"
                  type="checkbox"
                  class="size-4 accent-primary"
                  :checked="cellValue(record, field) === true"
                  @change="onCellInput(record, field, $event)"
                />
                <select
                  v-else-if="field.type === 'select'"
                  class="h-7 min-w-0 flex-1 rounded border border-border bg-background px-1 text-[13px] text-foreground outline-none focus:border-primary"
                  :value="cellValue(record, field)"
                  @change="onCellInput(record, field, $event)"
                >
                  <option value="">—</option>
                  <option v-for="opt in field.options ?? []" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <input
                  v-else
                  :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'"
                  class="h-7 min-w-0 flex-1 rounded border border-border bg-background px-1 text-[13px] text-foreground outline-none focus:border-primary"
                  :value="cellValue(record, field) ?? ''"
                  @change="onCellInput(record, field, $event)"
                />
              </label>
            </div>
          </article>
        </div>
      </template>
    </template>
  </WorkspacePageFrame>
</template>
