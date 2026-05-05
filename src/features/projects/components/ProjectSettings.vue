<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@muon/ui/button'

defineProps<{ projectId: string }>()
const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
    <p>{{ t('projects.settings') }} — coming soon</p>
    <Button variant="outline" size="sm" @click="router.push(`/projects/${projectId}`)">
      <ArrowLeft class="mr-1 h-3.5 w-3.5" />
      {{ t('common.cancel') }}
    </Button>
  </div>
</template>
