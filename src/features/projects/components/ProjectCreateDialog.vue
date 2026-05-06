<script setup lang="ts">
import { Button } from '@muon/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@muon/ui/dialog'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../composables/useProjectStore'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': [projectId: string]
}>()

const { t } = useI18n()
const router = useRouter()
const store = useProjectStore()

const name = ref('')
const description = ref('')
const creating = ref(false)
const error = ref('')

const canSubmit = computed(() => name.value.trim().length > 0 && !creating.value)

async function submit() {
  if (!canSubmit.value)
    return
  creating.value = true
  error.value = ''
  try {
    const project = await store.createProject({
      name: name.value.trim(),
      description: description.value.trim(),
    })
    emit('created', project.id)
    emit('update:open', false)
    name.value = ''
    description.value = ''
    router.push(`/projects/${project.id}`)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('projects.create_project') }}</DialogTitle>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <Label for="project-name">{{ t('projects.project_name') }}</Label>
          <Input
            id="project-name"
            v-model="name"
            :placeholder="t('projects.project_name_placeholder')"
            @keyup.enter="submit()"
          />
        </div>
        <div class="grid gap-2">
          <Label for="project-desc">{{ t('projects.project_description') }}</Label>
          <Input
            id="project-desc"
            v-model="description"
            :placeholder="t('projects.project_description_placeholder')"
            @keyup.enter="submit()"
          />
        </div>
        <p v-if="error" class="text-sm text-destructive">
          {{ error }}
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ t('common.cancel') }}
        </Button>
        <Button :disabled="!canSubmit" :loading="creating" @click="submit()">
          {{ t('projects.create') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
