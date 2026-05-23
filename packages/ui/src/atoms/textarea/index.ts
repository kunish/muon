import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Textarea } from './Textarea.vue'

export const textareaVariants = cva(
  'flex w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground transition-colors ' +
    'placeholder:text-gray-400 focus-visible:outline-none ' +
    'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200',
  {
    variants: {
      variant: {
        default: 'border-input focus-visible:border-primary',
        error: 'border-destructive focus-visible:border-destructive',
        success: 'border-green-500 focus-visible:border-green-500',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export type TextareaVariants = VariantProps<typeof textareaVariants>
