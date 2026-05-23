<script setup lang="ts">
import { useI18n } from 'vue-i18n';

interface ReadUser {
  userId: string;
  name: string;
  avatar?: string;
}

defineProps<{
  readUsers: ReadUser[];
}>();

const { t } = useI18n();
</script>

<template>
  <div v-if="readUsers.length > 0" class="flex items-center gap-1 whitespace-nowrap">
    <div class="flex -space-x-1.5">
      <template v-for="u in readUsers.slice(0, 5)" :key="u.userId">
        <img
          v-if="u.avatar"
          :src="u.avatar"
          :alt="u.name"
          :title="u.name"
          class="w-3.5 h-3.5 rounded-full ring-1 ring-background object-cover"
        />
        <div
          v-else
          :title="u.name"
          class="w-3.5 h-3.5 rounded-full ring-1 ring-background bg-muted flex items-center justify-center text-[7px] font-medium text-muted-foreground"
        >
          {{ u.name.slice(0, 1) }}
        </div>
      </template>
    </div>
    <span class="text-[10px] text-muted-foreground/50">
      {{ readUsers.length > 5 ? t('chat.read_by_n', { n: readUsers.length }) : t('chat.read') }}
    </span>
  </div>
</template>
