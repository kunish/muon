<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { FormFieldVariants } from '.'
import type { FormFieldContext } from './context'
import { computed, provide, useId } from 'vue'
import { formFieldVariants } from '.'
import { cn } from '../../utils'
import { FORM_FIELD_KEY } from './context'

const props = withDefaults(defineProps<{
  label?: string
  description?: string
  required?: boolean
  helper?: string
  error?: string
  orientation?: FormFieldVariants['orientation']
  size?: FormFieldVariants['size']
  id?: string
  class?: HTMLAttributes['class']
}>(), { orientation: 'vertical', size: 'md', required: false })

const autoId = useId()
const fieldId = computed(() => props.id ?? `field-${autoId}`)
const helperId = computed(() => `${fieldId.value}-helper`)
const errorId = computed(() => `${fieldId.value}-error`)
const invalid = computed(() => !!props.error)

const context = computed<FormFieldContext>(() => ({
  fieldId: fieldId.value,
  describedById: props.error ? errorId.value : (props.helper ? helperId.value : undefined),
  errorId: props.error ? errorId.value : undefined,
  invalid: invalid.value,
}))

provide(FORM_FIELD_KEY, context.value)
</script>

<template>
  <div :class="cn(formFieldVariants({ orientation, size }), props.class)">
    <div :class="orientation === 'horizontal' ? 'w-30 shrink-0 pt-1.5' : ''">
      <label
        v-if="label"
        :for="fieldId"
        class="block text-sm font-medium text-gray-700"
      >
        {{ label }}<span v-if="required" class="ml-0.5 text-destructive">*</span>
      </label>
      <p v-if="description" class="mt-0.5 text-xs text-gray-500">
        {{ description }}
      </p>
    </div>
    <div class="flex flex-1 flex-col gap-1">
      <slot :field-id="fieldId" :described-by="context.describedById" :invalid="invalid" />
      <p v-if="error" :id="errorId" class="text-xs text-destructive">
        {{ error }}
      </p>
      <p v-else-if="helper" :id="helperId" class="text-xs text-gray-500">
        {{ helper }}
      </p>
    </div>
  </div>
</template>
