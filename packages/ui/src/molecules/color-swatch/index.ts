import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as ColorSwatch } from './ColorSwatch.vue'

export const colorSwatchVariants = cva(
  'inline-block rounded-sm cursor-pointer transition-[outline-width]',
  {
    variants: {
      size: {
        sm: 'size-3',
        md: 'size-4',
        lg: 'size-5',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type ColorSwatchVariants = VariantProps<typeof colorSwatchVariants>

export const PRESET_COLORS = [
  'var(--brand-500)', 'var(--red-500)', 'var(--orange-500)',
  'var(--green-500)', 'var(--cyan-500)', 'var(--gray-500)',
  'var(--brand-200)', 'var(--red-200)', 'var(--orange-200)',
  'var(--green-200)', 'var(--cyan-200)', 'var(--gray-200)',
] as const
