import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Breadcrumb } from './Breadcrumb.vue'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export const breadcrumbVariants = cva('flex items-center gap-1 text-gray-500', {
  variants: {
    size: { sm: 'text-xs', md: 'text-sm' },
  },
  defaultVariants: { size: 'md' },
})

export type BreadcrumbVariants = VariantProps<typeof breadcrumbVariants>
