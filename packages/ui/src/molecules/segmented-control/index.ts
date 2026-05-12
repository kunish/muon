import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as SegmentedControl } from './SegmentedControl.vue'

export interface SegmentItem {
  value: string
  label: string
}

export const segmentedControlVariants = cva(
  'inline-flex items-center rounded-md text-sm',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 p-0.5',
        inline: 'bg-transparent',
      },
      size: {
        sm: 'h-7',
        md: 'h-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export type SegmentedControlVariants = VariantProps<typeof segmentedControlVariants>
