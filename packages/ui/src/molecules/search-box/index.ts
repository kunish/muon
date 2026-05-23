import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as SearchBox } from './SearchBox.vue'

export const searchBoxVariants = cva(
  'relative flex w-full items-center rounded-md border bg-card text-sm text-foreground transition-colors ' +
    'border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-brand-500/20 ' +
    'aria-disabled:cursor-not-allowed aria-disabled:bg-gray-50 aria-disabled:border-gray-200',
  {
    variants: {
      size: {
        sm: 'h-7 px-2 gap-1.5 text-sm',
        md: 'h-8 px-2.5 gap-2 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type SearchBoxVariants = VariantProps<typeof searchBoxVariants>
