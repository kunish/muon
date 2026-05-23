import type { Meta, StoryObj } from '@storybook/vue3'
import { Textarea } from '../../atoms/textarea'

const meta: Meta<typeof Textarea> = {
  title: 'Atoms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'error', 'success'] },
    rows: { control: 'number' },
    disabled: { control: 'boolean' },
  },
  args: { variant: 'default', rows: 3, disabled: false, placeholder: 'Type here' },
}

export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  render: (args) => ({
    components: { Textarea },
    setup: () => ({ args }),
    template: '<Textarea v-bind="args" class="w-64" />',
  }),
}

export const Variants: Story = {
  render: () => ({
    components: { Textarea },
    template: `
      <div class="flex flex-col gap-2 w-64">
        <Textarea placeholder="Default" />
        <Textarea variant="error" placeholder="Error" />
        <Textarea variant="success" placeholder="Success" />
      </div>
    `,
  }),
}

export const Rows: Story = {
  render: () => ({
    components: { Textarea },
    template: `
      <div class="flex flex-col gap-2 w-64">
        <Textarea rows="2" placeholder="2 rows" />
        <Textarea rows="3" placeholder="3 rows" />
        <Textarea rows="5" placeholder="5 rows" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Textarea },
    template: `
      <div class="flex flex-col gap-2 w-64">
        <Textarea placeholder="Default" />
        <Textarea placeholder="Disabled" disabled />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Textarea },
    template: `
      <div class="flex flex-col gap-3 w-64">
        <Textarea placeholder="Comfortable" />
        <div data-density="compact"><Textarea placeholder="Compact" /></div>
      </div>
    `,
  }),
}
