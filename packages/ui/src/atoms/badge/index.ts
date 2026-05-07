import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Badge } from './Badge.vue'

export const badgeVariants = cva(
  'inline-flex items-center rounded-xs px-1.5 py-0.5 text-xs font-medium leading-none transition-colors',
  {
    variants: {
      tone: {
        neutral: '',
        brand: '',
        success: '',
        warning: '',
        danger: '',
        info: '',
      },
      style: {
        solid: '',
        subtle: '',
        outline: 'border bg-transparent',
      },
    },
    compoundVariants: [
      { tone: 'neutral', style: 'solid', class: 'bg-gray-700 text-white' },
      { tone: 'neutral', style: 'subtle', class: 'bg-gray-100 text-gray-700' },
      { tone: 'neutral', style: 'outline', class: 'border-gray-300 text-gray-700' },
      { tone: 'brand', style: 'solid', class: 'bg-brand-500 text-white' },
      { tone: 'brand', style: 'subtle', class: 'bg-brand-50 text-brand-700' },
      { tone: 'brand', style: 'outline', class: 'border-brand-500 text-brand-600' },
      { tone: 'success', style: 'solid', class: 'bg-green-500 text-white' },
      { tone: 'success', style: 'subtle', class: 'bg-green-50 text-green-700' },
      { tone: 'success', style: 'outline', class: 'border-green-500 text-green-600' },
      { tone: 'warning', style: 'solid', class: 'bg-orange-500 text-white' },
      { tone: 'warning', style: 'subtle', class: 'bg-orange-50 text-orange-700' },
      { tone: 'warning', style: 'outline', class: 'border-orange-500 text-orange-700' },
      { tone: 'danger', style: 'solid', class: 'bg-red-500 text-white' },
      { tone: 'danger', style: 'subtle', class: 'bg-red-50 text-red-700' },
      { tone: 'danger', style: 'outline', class: 'border-red-500 text-red-600' },
      { tone: 'info', style: 'solid', class: 'bg-cyan-500 text-white' },
      { tone: 'info', style: 'subtle', class: 'bg-cyan-50 text-cyan-700' },
      { tone: 'info', style: 'outline', class: 'border-cyan-500 text-cyan-700' },
    ],
    defaultVariants: { tone: 'neutral', style: 'subtle' },
  },
)

export type BadgeVariants = VariantProps<typeof badgeVariants>
