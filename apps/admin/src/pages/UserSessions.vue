<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { computed, ref } from 'vue';
import { useRevokeUserSession, useUserSessions } from '@/queries/useUsers';

const props = defineProps<{ userId: string }>();

// 展开态本地持有：仅展开后才把 enabled 置 true，驱动会话 query 懒加载。
const expanded = ref(false);

const { data: sessions, isFetching, error: queryError } = useUserSessions(props.userId, () => expanded.value);
const revokeSession = useRevokeUserSession();

const sessionList = computed(() => sessions.value ?? []);
const sessionsError = computed(() => {
  const err = queryError.value ?? revokeSession.error.value;
  return err instanceof Error ? err.message : '';
});

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function toggle() {
  expanded.value = !expanded.value;
}

async function handleRevoke(sessionId: string) {
  try {
    await revokeSession.mutateAsync({ userId: props.userId, sessionId });
  } catch {
    // 错误通过 sessionsError 计算属性展示；401 已在 mutation onError 收口。
  }
}
</script>

<template>
  <details class="user-sessions" :open="expanded">
    <summary :data-testid="`user-sessions-summary-${userId}`" @click.prevent="toggle">
      活跃会话 <span v-if="expanded && sessions">({{ sessionList.length }})</span>
    </summary>
    <template v-if="expanded">
      <div v-if="isFetching && !sessions" class="user-sessions-loading">加载中…</div>
      <p v-else-if="sessionsError" class="error" :data-testid="`user-sessions-error-${userId}`">{{ sessionsError }}</p>
      <div v-else-if="sessionList.length === 0" class="empty-state">没有活跃会话</div>
      <div v-else class="user-sessions-list">
        <div
          v-for="session in sessionList"
          :key="session.id"
          class="user-sessions-row"
          :data-testid="`user-sessions-row-${session.id}`"
        >
          <strong>{{ session.deviceName }}</strong>
          <span>创建于 {{ formatDate(session.createdAt) }}</span>
          <span>过期于 {{ formatDate(session.expiresAt) }}</span>
          <Button
            type="button"
            variant="outline"
            :data-testid="`user-sessions-revoke-${session.id}`"
            :disabled="revokeSession.isPending.value"
            @click="handleRevoke(session.id)"
          >
            {{ revokeSession.isPending.value ? '正在吊销' : '吊销' }}
          </Button>
        </div>
      </div>
    </template>
  </details>
</template>

<style scoped>
.user-sessions {
  margin-top: 8px;
  padding: 8px;
  background: #f6f7f9;
  border-radius: 6px;
}

.user-sessions summary {
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  font-size: 13px;
}

.user-sessions-loading {
  padding: 12px;
  color: #667085;
  font-size: 13px;
}

.user-sessions-list {
  margin-top: 8px;
  display: grid;
  gap: 6px;
}

.user-sessions-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  background: #fff;
  border: 1px solid #edf0f4;
  border-radius: 6px;
  font-size: 13px;
}

.error {
  color: #c2410c;
}

.empty-state {
  padding: 16px;
  border: 1px dashed #d0d5dd;
  border-radius: 8px;
  color: #667085;
  text-align: center;
}
</style>
