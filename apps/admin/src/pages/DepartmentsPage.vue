<script setup lang="ts">
import type { Department } from '@muon/enterprise-contracts';
import { Button } from '@muon/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@muon/ui/card';
import { Input } from '@muon/ui/input';
import { computed, reactive } from 'vue';
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useReparentDepartment,
} from '@/queries/useDepartments';

const { data: departments, isLoading, error: queryError } = useDepartments();
const createDepartment = useCreateDepartment();
const reparentDepartment = useReparentDepartment();
const deleteDepartment = useDeleteDepartment();

const departmentForm = reactive({ name: '', parentId: '' });

const departmentList = computed<Department[]>(() => departments.value ?? []);

const departmentError = computed(() => {
  const err =
    createDepartment.error.value ?? reparentDepartment.error.value ?? deleteDepartment.error.value ?? queryError.value;
  return err instanceof Error ? err.message : '';
});

function departmentName(id: string | null): string {
  if (!id) return '—';
  return departmentList.value.find((department) => department.id === id)?.name ?? '—';
}

async function submitDepartment() {
  const name = departmentForm.name.trim();
  if (!name || createDepartment.isPending.value) return;
  try {
    await createDepartment.mutateAsync({ name, parentId: departmentForm.parentId || null });
    departmentForm.name = '';
    departmentForm.parentId = '';
  } catch {
    // 错误通过 departmentError 计算属性展示；401 已在 mutation onError 收口。
  }
}

async function handleReparent(department: Department, parentId: string) {
  try {
    await reparentDepartment.mutateAsync({ departmentId: department.id, parentId: parentId || null });
  } catch {
    // 错误通过 departmentError 计算属性展示。
  }
}

async function handleRemove(department: Department) {
  try {
    await deleteDepartment.mutateAsync(department.id);
  } catch {
    // 错误通过 departmentError 计算属性展示。
  }
}
</script>

<template>
  <section class="admin-content" data-testid="departments-page">
    <div class="page-heading">
      <p>组织后台</p>
      <h1>部门管理</h1>
    </div>

    <Card id="departments" class="wide-panel" data-testid="departments-panel">
      <CardHeader>
        <CardTitle>部门管理</CardTitle>
        <CardDescription>维护组织的部门树（创建、调整上级、删除）。</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="department-form" data-testid="department-form" @submit.prevent="submitDepartment">
          <Input v-model="departmentForm.name" data-testid="department-name" placeholder="部门名称" />
          <select v-model="departmentForm.parentId" data-testid="department-parent" aria-label="上级部门">
            <option value="">顶级部门</option>
            <option v-for="department in departmentList" :key="department.id" :value="department.id">
              {{ department.name }}
            </option>
          </select>
          <Button
            type="submit"
            data-testid="department-create"
            :disabled="createDepartment.isPending.value || !departmentForm.name.trim()"
          >
            新建部门
          </Button>
        </form>
        <p v-if="departmentError" class="error" data-testid="department-error">{{ departmentError }}</p>
        <p v-if="isLoading" class="empty-state">加载中…</p>
        <div v-else class="table-list" aria-label="部门列表">
          <div
            v-for="department in departmentList"
            :key="department.id"
            class="table-row department-row"
            :data-testid="`department-row-${department.id}`"
          >
            <span class="department-name">{{ department.name }}</span>
            <label class="department-parent-control">
              上级
              <select
                :value="department.parentId ?? ''"
                :data-testid="`department-parent-${department.id}`"
                aria-label="调整上级部门"
                @change="handleReparent(department, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">顶级部门</option>
                <option
                  v-for="candidate in departmentList.filter((d) => d.id !== department.id)"
                  :key="candidate.id"
                  :value="candidate.id"
                >
                  {{ candidate.name }}
                </option>
              </select>
            </label>
            <span class="department-parent-name">当前上级：{{ departmentName(department.parentId) }}</span>
            <Button
              type="button"
              variant="secondary"
              :data-testid="`department-delete-${department.id}`"
              @click="handleRemove(department)"
            >
              删除
            </Button>
          </div>
          <div v-if="departmentList.length === 0" class="empty-state">暂无部门，先创建一个吧</div>
        </div>
      </CardContent>
    </Card>
  </section>
</template>

<style scoped>
.admin-content {
  min-height: 0;
  overflow-y: auto;
  padding: 40px;
}

.page-heading p {
  margin: 0 0 6px;
  color: #667085;
  font-size: 13px;
}

.page-heading h1 {
  margin: 0 0 24px;
  font-size: 28px;
}

.error {
  color: #c2410c;
}

.wide-panel {
  grid-column: 1 / -1;
}

.department-form {
  margin-top: 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.department-form select {
  min-width: 0;
  height: 36px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
}

.table-list {
  margin-top: 16px;
  display: grid;
  gap: 8px;
}

.table-row {
  display: grid;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid #edf0f4;
  border-radius: 6px;
  background: #fbfcfe;
  font-size: 13px;
}

.table-row span {
  color: #667085;
  overflow-wrap: anywhere;
}

.department-row {
  grid-template-columns: 1fr auto 1fr auto;
}

.department-name {
  color: #1f2328 !important;
  font-weight: 600;
}

.department-parent-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #3d4656;
}

.department-parent-control select {
  height: 32px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  padding: 0 8px;
  background: #fff;
}

.empty-state {
  padding: 16px;
  border: 1px dashed #d0d5dd;
  border-radius: 8px;
  color: #667085;
  text-align: center;
}

@media (max-width: 900px) {
  .department-form,
  .department-row {
    grid-template-columns: 1fr;
  }
}
</style>
