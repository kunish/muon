<script setup lang="ts">
import type { ChannelTreeCategory } from '@/features/server/stores/serverStore'
import { ChevronDown, Plus } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useServerStore } from '@/features/server/stores/serverStore'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'

const props = defineProps<{
  category: ChannelTreeCategory
}>()

const emit = defineEmits<{
  createChannel: [categoryId: string]
}>()

const serverStore = useServerStore()
const { t } = useI18n()

const isCollapsed = computed(() => serverStore.isCategoryCollapsed(props.category.id))

const displayName = computed(() => {
  if (props.category.name === '__text_channels__')
    return t('channel.text_channels')
  if (props.category.name === '__voice_channels__')
    return t('channel.voice_channels')
  return props.category.name
})

function toggle() {
  serverStore.toggleCategory(props.category.id)
}

function onCreateChannel(e: MouseEvent) {
  e.stopPropagation()
  emit('createChannel', props.category.id)
}
</script>

<template>
  <div class="mt-4 first:mt-2">
    <!-- Category header — only shown for named categories -->
    <button
      v-if="displayName"
      class="group flex w-full items-center gap-0.5 px-1 py-1 text-xs font-medium tracking-normal text-muted-foreground/70 hover:text-foreground transition-colors"
      @click="toggle"
    >
      <ChevronDown
        :size="10"
        class="shrink-0 transition-transform duration-150"
        :class="{ '-rotate-90': isCollapsed }"
      />
      <span class="truncate">{{ displayName }}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <span
              class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:text-foreground"
              @click="onCreateChannel"
            >
              <Plus :size="14" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ t('channel.create_channel') }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </button>

    <!-- Channel list -->
    <div v-show="!isCollapsed || !category.name" class="space-y-px">
      <slot />
    </div>
  </div>
</template>
