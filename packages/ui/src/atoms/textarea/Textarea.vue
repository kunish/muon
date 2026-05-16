<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { TextareaVariants } from '.'
import { useVModel } from '@vueuse/core'
import { textareaVariants } from '.'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  placeholder?: string
  disabled?: boolean
  defaultValue?: string
  modelValue?: string
  rows?: number
  variant?: TextareaVariants['variant']
}>(), {
  variant: 'default',
  rows: 3,
})

const emits = defineEmits<{ 'update:modelValue': [value: string] }>()
const modelValue = useVModel(props, 'modelValue', emits, { passive: true, defaultValue: props.defaultValue })
</script>

<template>
  <textarea
    v-model="modelValue"
    :class="cn(textareaVariants({ variant }), props.class)"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
  />
</template>
