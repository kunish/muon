import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as MenuItem } from './MenuItem.vue'

export const menuItemVariants = cva(
  'flex w-full h-8 items-center gap-1.5 rounded-sm px-2.5 text-sm transition-colors cursor-pointer '
  + 'hover:bg-menu-item-hover-bg '
  + 'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-400',
  {
    variants: {
      variant: {
        default: 'text-gray-900',
        destructive: 'text-destructive hover:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export type MenuItemVariants = VariantProps<typeof menuItemVariants>
