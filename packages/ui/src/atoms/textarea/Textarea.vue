<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  placeholder?: string
  disabled?: boolean
  defaultValue?: string
  modelValue?: string
  rows?: number
  variant?: 'default' | 'error' | 'success'
}>(), {
  variant: 'default',
  rows: 3,
})

const emits = defineEmits<{ 'update:modelValue': [value: string] }>()
const modelValue = useVModel(props, 'modelValue', emits, { passive: true, defaultValue: props.defaultValue })

const variantClass = {
  default: 'border-input focus-visible:border-primary',
  error:   'border-destructive focus-visible:border-destructive focus-visible:outline-destructive/50',
  success: 'border-green-500 focus-visible:border-green-500 focus-visible:outline-green-500/50',
}
</script>

<template>
  <textarea
    v-model="modelValue"
    :class="cn(
      'flex w-full rounded-sm border bg-card px-3 py-2 text-sm text-foreground transition-colors',
      'placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-ring)]',
      'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200',
      variantClass[props.variant],
      props.class,
    )"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
  />
</template>
