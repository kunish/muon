import type { Meta, StoryObj } from '@storybook/vue3'
import { Check, Plus } from 'lucide-vue-next'
import { Button } from '../../atoms/button'

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl', 'icon'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { variant: 'primary', size: 'md', loading: false, disabled: false },
}

export default meta

type Story = StoryObj<typeof Button>

export const Default: Story = {
  render: args => ({ components: { Button }, setup: () => ({ args }), template: '<Button v-bind="args">Save</Button>' }),
}

export const Variants: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="flex flex-wrap gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="flex items-end gap-2">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="xl">XL</Button>
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="flex flex-wrap gap-2">
        <Button>Default</Button>
        <Button class="hover:!bg-brand-600">Hover</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>
    `,
  }),
}

export const WithIcon: Story = {
  render: () => ({
    components: { Button },
    setup: () => ({ Plus, Check }),
    template: `
      <div class="flex gap-2">
        <Button :leading-icon="Plus">Create</Button>
        <Button variant="outline" :trailing-icon="Check">Done</Button>
        <Button size="icon" :leading-icon="Plus" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex gap-2"><Button>Comfortable</Button><Button variant="outline">Cancel</Button></div>
        <div data-density="compact" class="flex gap-2"><Button>Compact</Button><Button variant="outline">Cancel</Button></div>
      </div>
    `,
  }),
}
