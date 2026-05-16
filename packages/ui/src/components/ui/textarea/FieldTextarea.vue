<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { computed } from 'vue'
import { Textarea } from '../../../atoms/textarea'
import { cn } from '../../../utils'
import Label from '../label/Label.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  controlClass?: HTMLAttributes['class']
  defaultValue?: string | number
  error?: string
  hint?: string
  id?: string
  label?: string
  modelValue?: string | number
}>(), {
  defaultValue: '',
})

const emits = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})

const generatedId = `muon-textarea-${Math.random().toString(36).slice(2)}`
const controlId = computed(() => props.id || generatedId)
const descriptionId = computed(() => `${controlId.value}-description`)
const hasDescription = computed(() => Boolean(props.error || props.hint))

// Cast modelValue to string for the Textarea atom
const textareaModelValue = computed({
  get: () => String(modelValue.value ?? ''),
  set: (val: string) => { modelValue.value = val },
})
</script>

<template>
  <div :class="cn('grid gap-1.5', props.class)">
    <Label v-if="label" :for="controlId">{{ label }}</Label>
    <Textarea
      v-bind="$attrs"
      :id="controlId"
      v-model="textareaModelValue"
      :aria-describedby="hasDescription ? descriptionId : undefined"
      :aria-invalid="error ? 'true' : undefined"
      :class="cn(error && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20', props.controlClass)"
    />
    <p
      v-if="hasDescription"
      :id="descriptionId"
      class="text-xs leading-5"
      :class="error ? 'text-destructive' : 'text-muted-foreground'"
    >
      {{ error || hint }}
    </p>
  </div>
</template>
