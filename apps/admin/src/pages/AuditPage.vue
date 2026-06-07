<script setup lang="ts">
import type { AuditLog } from '@muon/enterprise-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@muon/ui/card';
import { Input } from '@muon/ui/input';
import { computed, ref } from 'vue';
import { useAuditLogs } from '@/queries/useAuditLogs';

const { data: auditLogs, error: queryError } = useAuditLogs();

const auditSearch = ref('');

const auditLogList = computed<AuditLog[]>(() => auditLogs.value ?? []);

const auditError = computed(() => (queryError.value instanceof Error ? queryError.value.message : ''));

function metadataSummary(entry: AuditLog) {
  const entries = Object.entries(entry.metadata);
  if (entries.length === 0) return '无附加信息';
  return entries.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join('；');
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

const filteredAuditLogs = computed(() => {
  const query = auditSearch.value.trim().toLowerCase();
  if (!query) return auditLogList.value;
  return auditLogList.value.filter((entry) => {
    return [entry.action, entry.targetType, entry.targetId ?? '', entry.actorUserId ?? '', metadataSummary(entry)].some(
      (value) => value.toLowerCase().includes(query),
    );
  });
});
</script>

<template>
  <section class="admin-content" data-testid="audit-page">
    <div class="page-heading">
      <p>组织后台</p>
      <h1>审计日志</h1>
    </div>

    <Card id="audit" class="wide-panel" data-testid="audit-panel">
      <CardHeader>
        <CardTitle>审计日志</CardTitle>
        <CardDescription>查看安装、登录、创建用户、重置密码、角色变更和 Matrix provision 记录。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="panel-toolbar">
          <Input
            v-model="auditSearch"
            data-testid="audit-search"
            placeholder="搜索动作、目标、操作者或元数据"
            autocomplete="off"
          />
          <span>{{ filteredAuditLogs.length }} / {{ auditLogList.length }} 条记录</span>
        </div>
        <p v-if="auditError" class="error" data-testid="audit-error">{{ auditError }}</p>
        <div class="table-list" aria-label="审计日志列表">
          <div v-for="entry in filteredAuditLogs" :key="entry.id" class="table-row audit-row">
            <strong>{{ entry.action }}</strong>
            <span>{{ entry.targetType }}</span>
            <span>{{ entry.targetId ?? '无目标' }}</span>
            <span>{{ metadataSummary(entry) }}</span>
            <span>{{ formatDate(entry.createdAt) }}</span>
          </div>
          <div v-if="filteredAuditLogs.length === 0" class="empty-state">没有匹配的审计日志</div>
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

.panel-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}

.panel-toolbar span {
  color: #667085;
  font-size: 13px;
  white-space: nowrap;
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

.audit-row {
  grid-template-columns: 1fr 0.7fr 1fr 1.4fr 1.2fr;
}

.empty-state {
  padding: 16px;
  border: 1px dashed #d0d5dd;
  border-radius: 8px;
  color: #667085;
  text-align: center;
}

@media (max-width: 900px) {
  .panel-toolbar,
  .audit-row {
    grid-template-columns: 1fr;
  }
}
</style>
