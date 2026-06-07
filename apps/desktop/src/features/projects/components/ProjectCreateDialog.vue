<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@muon/ui/dialog';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { useForm } from '@tanstack/vue-form';
import { z } from 'zod';
import { useCreateProject } from '../queries/useProjects';

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  created: [projectId: string];
}>();

const { t } = useI18n();
const router = useRouter();
const createProject = useCreateProject();
const error = ref('');

const projectFormSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string(),
});

const form = useForm({
  defaultValues: { name: '', description: '' },
  validators: { onMount: projectFormSchema, onChange: projectFormSchema },
  onSubmit: async ({ value }) => {
    error.value = '';
    try {
      const project = await createProject.mutateAsync({
        name: value.name.trim(),
        description: value.description.trim(),
      });
      emit('created', project.id);
      emit('update:open', false);
      form.reset();
      router.push(`/projects/${project.id}`);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  },
});
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('projects.create_project') }}</DialogTitle>
      </DialogHeader>
      <form @submit.prevent.stop="form.handleSubmit">
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="project-name">{{ t('projects.project_name') }}</Label>
            <form.Field v-slot="{ field }" name="name">
              <Input
                id="project-name"
                :model-value="field.state.value"
                :placeholder="t('projects.project_name_placeholder')"
                @update:model-value="(value) => field.handleChange(String(value))"
                @blur="field.handleBlur"
                @keyup.enter="form.handleSubmit"
              />
            </form.Field>
          </div>
          <div class="grid gap-2">
            <Label for="project-desc">{{ t('projects.project_description') }}</Label>
            <form.Field v-slot="{ field }" name="description">
              <Input
                id="project-desc"
                :model-value="field.state.value"
                :placeholder="t('projects.project_description_placeholder')"
                @update:model-value="(value) => field.handleChange(String(value))"
                @keyup.enter="form.handleSubmit"
              />
            </form.Field>
          </div>
          <p v-if="error" class="text-sm text-destructive">
            {{ error }}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="emit('update:open', false)">
            {{ t('common.cancel') }}
          </Button>
          <form.Subscribe v-slot="{ canSubmit, isSubmitting }">
            <Button type="button" :disabled="!canSubmit" :loading="isSubmitting" @click="form.handleSubmit">
              {{ t('projects.create') }}
            </Button>
          </form.Subscribe>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
