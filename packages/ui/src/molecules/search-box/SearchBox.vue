<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { SearchBoxVariants } from '.'
import { useVModel } from '@vueuse/core'
import { Search, X } from 'lucide-vue-next'
import { computed } from 'vue'
import { Kbd } from '../../atoms/kbd'
import { cn } from '../../utils'
import { searchBoxVariants } from '.'

const props = withDefaults(defineProps<{
  modelValue?: string
  defaultValue?: string
  placeholder?: string
  size?: SearchBoxVariants['size']
  kbd?: string[]
  disabled?: boolean
  class?: HTMLAttributes['class']
}>(), {
  size: 'md',
  placeholder: 'Search',
})

const emits = defineEmits<{
  'update:modelValue': [value: string]
  'clear': []
}>()

const value = useVModel(props, 'modelValue', emits, { passive: true, defaultValue: props.defaultValue ?? '' })

const showClear = computed(() => !props.disabled && value.value && String(value.value).length > 0)
const showKbd = computed(() => props.kbd && props.kbd.length > 0 && !value.value)

function onClear() {
  value.value = ''
  emits('clear')
}
</script>

<template>
  <div
    :class="cn(searchBoxVariants({ size }), props.class)"
    :aria-disabled="disabled || undefined"
    :data-testid="$attrs['data-testid']"
  >
    <Search class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
    <input
      v-model="value"
      type="search"
      :placeholder="placeholder"
      :disabled="disabled"
      class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
      data-testid="search-box-input"
    >
    <button
      v-if="showClear"
      type="button"
      class="inline-flex shrink-0 items-center justify-center rounded-sm text-gray-500 hover:text-gray-700"
      data-testid="search-box-clear"
      @click="onClear"
    >
      <X class="size-3.5" />
    </button>
    <Kbd v-if="showKbd && kbd" :keys="kbd" size="sm" class="shrink-0" />
  </div>
</template>
