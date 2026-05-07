import type { Meta, StoryObj } from '@storybook/vue3'
import { Check } from 'lucide-vue-next'
import { Badge } from '../../atoms/badge'

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'brand', 'success', 'warning', 'danger', 'info'] },
    style: { control: 'select', options: ['solid', 'subtle', 'outline'] },
  },
  args: { tone: 'neutral', style: 'subtle' },
}

export default meta

type Story = StoryObj<typeof Badge>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({ components: { Badge }, setup: () => ({ args }), template: '<Badge v-bind="args">Label</Badge>' }),
}

export const Tones: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div class="flex flex-wrap gap-2">
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="brand">Brand</Badge>
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
        <Badge tone="info">Info</Badge>
      </div>
    `,
  }),
}

export const Styles: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap gap-2">
          <Badge tone="neutral" style="solid">Solid</Badge>
          <Badge tone="brand" style="solid">Solid</Badge>
          <Badge tone="success" style="solid">Solid</Badge>
          <Badge tone="warning" style="solid">Solid</Badge>
          <Badge tone="danger" style="solid">Solid</Badge>
          <Badge tone="info" style="solid">Solid</Badge>
        </div>
        <div class="flex flex-wrap gap-2">
          <Badge tone="neutral" style="subtle">Subtle</Badge>
          <Badge tone="brand" style="subtle">Subtle</Badge>
          <Badge tone="success" style="subtle">Subtle</Badge>
          <Badge tone="warning" style="subtle">Subtle</Badge>
          <Badge tone="danger" style="subtle">Subtle</Badge>
          <Badge tone="info" style="subtle">Subtle</Badge>
        </div>
        <div class="flex flex-wrap gap-2">
          <Badge tone="neutral" style="outline">Outline</Badge>
          <Badge tone="brand" style="outline">Outline</Badge>
          <Badge tone="success" style="outline">Outline</Badge>
          <Badge tone="warning" style="outline">Outline</Badge>
          <Badge tone="danger" style="outline">Outline</Badge>
          <Badge tone="info" style="outline">Outline</Badge>
        </div>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div class="flex items-center gap-2">
        <Badge tone="brand" class="px-1 py-0 text-[10px]">Tiny</Badge>
        <Badge tone="brand">Default</Badge>
        <Badge tone="brand" class="px-2 py-1 text-sm">Large</Badge>
      </div>
    `,
  }),
}

export const WithIcon: Story = {
  render: () => ({
    components: { Badge, Check },
    setup: () => ({ Check }),
    template: `
      <div class="flex flex-wrap gap-2">
        <Badge tone="success" style="subtle">
          <component :is="Check" class="size-3 mr-1" />
          Done
        </Badge>
        <Badge tone="brand" style="solid">
          <component :is="Check" class="size-3 mr-1" />
          Verified
        </Badge>
        <Badge tone="warning" style="outline">
          <component :is="Check" class="size-3 mr-1" />
          Pending
        </Badge>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex gap-2"><Badge tone="brand">Comfortable</Badge><Badge tone="neutral">Default</Badge></div>
        <div data-density="compact" class="flex gap-2"><Badge tone="brand">Compact</Badge><Badge tone="neutral">Default</Badge></div>
      </div>
    `,
  }),
}
