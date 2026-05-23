import type { Meta, StoryObj } from '@storybook/vue3'
import { Input } from '../../atoms/input'

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'error', 'success'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
  args: { variant: 'default', size: 'md', disabled: false, placeholder: 'Type here' },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  render: (args) => ({
    components: { Input },
    setup: () => ({ args }),
    template: '<Input v-bind="args" class="w-64" />',
  }),
}

export const Variants: Story = {
  render: () => ({
    components: { Input },
    template: `
      <div class="flex flex-col gap-2 w-64">
        <Input placeholder="Default" />
        <Input variant="error" placeholder="Error" />
        <Input variant="success" placeholder="Success" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Input },
    template: `
      <div class="flex flex-col gap-2 w-64">
        <Input size="sm" placeholder="Small" />
        <Input size="md" placeholder="Medium" />
        <Input size="lg" placeholder="Large" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Input },
    template: `
      <div class="flex flex-col gap-2 w-64">
        <Input placeholder="Default" />
        <Input placeholder="Disabled" disabled />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Input },
    template: `
      <div class="flex flex-col gap-3 w-64">
        <Input placeholder="Comfortable" />
        <div data-density="compact"><Input placeholder="Compact" /></div>
      </div>
    `,
  }),
}
