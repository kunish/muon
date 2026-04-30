<script setup lang="ts">
import { useResizablePane } from '@/shared/composables/useResizablePane'

interface Props {
  widthStorageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  resizeLabel: string
  as?: 'aside' | 'nav' | 'div'
  paneTestId?: string
  contentTestId?: string
  handleTestId?: string
  contentClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'aside',
  paneTestId: undefined,
  contentTestId: undefined,
  handleTestId: undefined,
  contentClass: 'flex h-full min-h-0 flex-col overflow-hidden',
})

const {
  paneWidth,
  paneStyle,
  isResizing,
  startResize,
  restorePane,
  onResizeHandleKeydown,
} = useResizablePane({
  widthStorageKey: props.widthStorageKey,
  defaultWidth: props.defaultWidth,
  minWidth: props.minWidth,
  maxWidth: props.maxWidth,
})
</script>

<template>
  <component
    :is="as"
    :data-testid="paneTestId"
    class="workspace-panel relative flex h-full min-h-0 shrink-0 flex-col overflow-visible rounded-none border-y-0 border-l-0 bg-sidebar/95 backdrop-blur-xl transition-[width] duration-150 ease-out"
    :class="isResizing && 'transition-none'"
    :style="paneStyle"
  >
    <div
      :data-testid="contentTestId"
      :class="contentClass"
    >
      <slot />
    </div>

    <div
      :data-testid="handleTestId"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="resizeLabel"
      :aria-valuemin="minWidth"
      :aria-valuemax="maxWidth"
      :aria-valuenow="paneWidth"
      class="absolute right-[-3px] top-0 z-20 h-full w-1.5 cursor-col-resize rounded-full transition-colors duration-150 hover:bg-primary/22 focus-visible:bg-primary/25 focus-visible:outline-none"
      :class="isResizing && 'bg-primary/28'"
      @pointerdown="startResize"
      @dblclick.stop.prevent="restorePane"
      @keydown="onResizeHandleKeydown"
    />
  </component>
</template>
