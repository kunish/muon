import type { InjectionKey } from 'vue'

export interface FormFieldContext {
  fieldId: string
  describedById?: string
  errorId?: string
  invalid: boolean
}

export const FORM_FIELD_KEY: InjectionKey<FormFieldContext> = Symbol('form-field-context')
