import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as ListItem } from './ListItem.vue'

export const listItemVariants = cva(
  'group relative flex w-full items-center gap-3 px-3 cursor-pointer transition-colors ' +
    'hover:bg-list-item-hover-bg ' +
    'data-[selected=true]:bg-list-item-selected-bg ' +
    'data-[selected=true]:before:absolute data-[selected=true]:before:left-0 data-[selected=true]:before:top-1.5 ' +
    'data-[selected=true]:before:bottom-1.5 data-[selected=true]:before:w-1 ' +
    'data-[selected=true]:before:rounded-r-sm data-[selected=true]:before:bg-list-item-active-rail',
  {
    variants: {
      size: {
        sm: 'h-8 text-sm',
        md: 'h-10 text-sm',
        lg: 'h-12 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type ListItemVariants = VariantProps<typeof listItemVariants>
