import type { Meta, StoryObj } from '@storybook/vue3'
import { Input } from '../../atoms/input'
import { Textarea } from '../../atoms/textarea'
import { FormField } from '../../molecules/form-field'

const meta: Meta<typeof FormField> = {
  title: 'Molecules/FormField',
  component: FormField,
  tags: ['autodocs'],
  argTypes: {
    orientation: { control: 'select', options: ['vertical', 'horizontal'] },
    size: { control: 'select', options: ['sm', 'md'] },
    required: { control: 'boolean' },
  },
  args: { label: 'Workspace name', required: false, orientation: 'vertical', size: 'md' },
}

export default meta
type Story = StoryObj<typeof FormField>

export const Default: Story = {
  render: args => ({
    components: { FormField, Input },
    setup: () => ({ args }),
    template: `
      <div class="w-80">
        <FormField v-bind="args">
          <template #default="{ fieldId }">
            <Input :id="fieldId" placeholder="Acme Inc." />
          </template>
        </FormField>
      </div>
    `,
  }),
}

export const Variants: Story = {
  render: () => ({
    components: { FormField, Input },
    template: `
      <div class="w-80 flex flex-col gap-4">
        <FormField label="Plain" />
        <FormField label="Required" required>
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
        <FormField label="With description" description="Short hint here">
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
        <FormField label="With helper" helper="Use letters, digits, and dashes">
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
        <FormField label="With error" error="Name is required">
          <template #default="{ fieldId }"><Input :id="fieldId" variant="error" /></template>
        </FormField>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { FormField, Input },
    template: `
      <div class="w-80 flex flex-col gap-4">
        <FormField label="Small" size="sm">
          <template #default="{ fieldId }"><Input :id="fieldId" size="sm" /></template>
        </FormField>
        <FormField label="Medium" size="md">
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { FormField, Input },
    template: `
      <div class="w-[480px] flex flex-col gap-4">
        <FormField label="Vertical" required>
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
        <FormField label="Horizontal" orientation="horizontal" required>
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { FormField, Input },
    template: `
      <div class="flex flex-col gap-6">
        <div class="w-80">
          <FormField label="Default density">
            <template #default="{ fieldId }"><Input :id="fieldId" /></template>
          </FormField>
        </div>
        <div data-density="compact" class="w-80">
          <FormField label="Compact density">
            <template #default="{ fieldId }"><Input :id="fieldId" /></template>
          </FormField>
        </div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { FormField, Input, Textarea },
    template: `
      <div class="w-[520px] rounded-lg border border-border bg-card p-6 space-y-4">
        <FormField label="Workspace name" required helper="Visible to all members">
          <template #default="{ fieldId }"><Input :id="fieldId" placeholder="Acme Inc." /></template>
        </FormField>
        <FormField label="Workspace URL" description="Lowercase letters, digits, dashes" error="Already taken">
          <template #default="{ fieldId }"><Input :id="fieldId" variant="error" model-value="acme" /></template>
        </FormField>
        <FormField label="Description" orientation="horizontal">
          <template #default="{ fieldId }"><Textarea :id="fieldId" rows="3" /></template>
        </FormField>
      </div>
    `,
  }),
}
