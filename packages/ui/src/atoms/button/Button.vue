<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { Component, HTMLAttributes } from 'vue'
import type { ButtonVariants } from '.'
import { Loader2 } from 'lucide-vue-next'
import { Primitive } from 'reka-ui'
import { cn } from '../../utils'
import { buttonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
  disabled?: boolean
  loading?: boolean
  leadingIcon?: Component | string
  trailingIcon?: Component | string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  loading: false,
})
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
    :disabled="disabled || loading"
    :data-loading="loading || undefined"
    :data-testid="$attrs['data-testid']"
  >
    <span v-if="loading" data-testid="button-spinner" class="inline-flex">
      <Loader2 class="size-4 animate-spin" />
    </span>
    <component
      :is="leadingIcon"
      v-else-if="leadingIcon && typeof leadingIcon !== 'string'"
      data-testid="button-leading-icon"
      class="size-4"
    />
    <slot />
    <component
      :is="trailingIcon"
      v-if="trailingIcon && typeof trailingIcon !== 'string' && !loading"
      class="size-4"
    />
  </Primitive>
</template>
