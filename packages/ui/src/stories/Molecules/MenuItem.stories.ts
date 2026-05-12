import type { Meta, StoryObj } from '@storybook/vue3'
import { Copy, Edit, FileText, Trash2 } from 'lucide-vue-next'
import { MenuItem } from '../../molecules/menu-item'

const meta: Meta<typeof MenuItem> = {
  title: 'Molecules/MenuItem',
  component: MenuItem,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive'] },
    hasArrow: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { variant: 'default', hasArrow: false, disabled: false },
}

export default meta
type Story = StoryObj<typeof MenuItem>

export const Default: Story = {
  render: args => ({ components: { MenuItem }, setup: () => ({ args }), template: '<div class="w-56 rounded-lg border border-border bg-popover p-1"><MenuItem v-bind="args">Edit</MenuItem></div>' }),
}

export const Variants: Story = {
  render: () => ({
    components: { MenuItem },
    setup: () => ({ Trash2, Edit }),
    template: `
      <div class="w-56 rounded-lg border border-border bg-popover p-1">
        <MenuItem variant="default" :leading-icon="Edit">Default</MenuItem>
        <MenuItem variant="destructive" :leading-icon="Trash2">Destructive</MenuItem>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { MenuItem },
    template: `
      <div class="w-56 rounded-lg border border-border bg-popover p-1">
        <MenuItem>Single size 32px</MenuItem>
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { MenuItem },
    setup: () => ({ Edit }),
    template: `
      <div class="w-56 rounded-lg border border-border bg-popover p-1">
        <MenuItem :leading-icon="Edit">Default</MenuItem>
        <MenuItem :leading-icon="Edit" :kbd="['Cmd', 'E']">With kbd</MenuItem>
        <MenuItem :leading-icon="Edit" has-arrow>With submenu arrow</MenuItem>
        <MenuItem :leading-icon="Edit" disabled>Disabled</MenuItem>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { MenuItem },
    setup: () => ({ Edit }),
    template: `
      <div class="flex gap-4">
        <div class="w-56 rounded-lg border border-border bg-popover p-1">
          <MenuItem :leading-icon="Edit">Default density</MenuItem>
        </div>
        <div data-density="compact" class="w-56 rounded-lg border border-border bg-popover p-1">
          <MenuItem :leading-icon="Edit">Compact density</MenuItem>
        </div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { MenuItem },
    setup: () => ({ FileText, Copy, Edit, Trash2 }),
    template: `
      <div class="w-56 rounded-lg border border-border bg-popover p-1 shadow-md">
        <MenuItem :leading-icon="FileText">New page</MenuItem>
        <MenuItem :leading-icon="Copy" :kbd="['Cmd', 'C']">Copy</MenuItem>
        <MenuItem :leading-icon="Edit" has-arrow>Move to…</MenuItem>
        <div class="my-1 h-px bg-border" />
        <MenuItem variant="destructive" :leading-icon="Trash2">Delete</MenuItem>
      </div>
    `,
  }),
}
