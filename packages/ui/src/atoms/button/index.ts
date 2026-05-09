import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium '
  + 'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] '
  + 'select-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-brand-600 active:bg-brand-700 disabled:bg-primary/50 disabled:text-primary-foreground/85',
        secondary: 'bg-gray-100 text-foreground hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400',
        outline: 'border border-input bg-card text-foreground hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200',
        ghost: 'bg-transparent text-foreground hover:bg-gray-100 active:bg-gray-200 disabled:text-gray-400',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-red-600 active:bg-red-700 disabled:bg-destructive/50 disabled:text-destructive-foreground/85',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline disabled:text-primary/50',
        default: 'bg-primary text-primary-foreground hover:bg-brand-600 active:bg-brand-700 disabled:bg-primary/50 disabled:text-primary-foreground/85',
      },
      size: {
        sm: 'h-7 px-3 text-sm gap-1.5',
        md: 'h-8 px-4 text-sm',
        lg: 'h-9 px-5 text-sm',
        xl: 'h-10 px-6 text-sm',
        icon: 'h-8 w-8 p-0',
        default: 'h-8 px-4 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
