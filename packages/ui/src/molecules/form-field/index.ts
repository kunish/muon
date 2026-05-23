import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { FORM_FIELD_KEY } from './context'
export type { FormFieldContext } from './context'
export { default as FormField } from './FormField.vue'

export const formFieldVariants = cva('flex gap-1.5 w-full', {
  variants: {
    orientation: {
      vertical: 'flex-col',
      horizontal: 'flex-row items-start',
    },
    size: {
      sm: 'text-xs',
      md: 'text-sm',
    },
  },
  defaultVariants: { orientation: 'vertical', size: 'md' },
})

export type FormFieldVariants = VariantProps<typeof formFieldVariants>
