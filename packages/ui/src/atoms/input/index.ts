import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Input } from './Input.vue'

export const inputVariants = cva(
  'flex w-full rounded-sm border bg-card px-3 text-sm text-foreground transition-colors '
  + 'placeholder:text-gray-400 placeholder:not-italic '
  + 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-ring)] '
  + 'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 '
  + 'file:border-0 file:bg-transparent file:text-sm file:font-medium',
  {
    variants: {
      variant: {
        default: 'border-input focus-visible:border-primary',
        error: 'border-destructive focus-visible:border-destructive focus-visible:outline-destructive/50',
        success: 'border-green-500 focus-visible:border-green-500 focus-visible:outline-green-500/50',
      },
      size: {
        sm: 'h-7 text-xs',
        md: 'h-8',
        lg: 'h-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export type InputVariants = VariantProps<typeof inputVariants>
