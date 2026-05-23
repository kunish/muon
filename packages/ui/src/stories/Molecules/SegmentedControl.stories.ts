import type { Meta, StoryObj } from '@storybook/vue3'
import type { SegmentItem } from '../../molecules/segmented-control'
import { SegmentedControl } from '../../molecules/segmented-control'

const viewItems: SegmentItem[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const meta: Meta<typeof SegmentedControl> = {
  title: 'Molecules/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'inline'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
  args: { items: viewItems, variant: 'default', size: 'md' },
}

export default meta
type Story = StoryObj<typeof SegmentedControl>

export const Default: Story = {
  render: (args) => ({
    components: { SegmentedControl },
    setup: () => ({ args }),
    template: '<SegmentedControl v-bind="args" />',
  }),
}

export const Variants: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="flex flex-col items-start gap-3">
        <SegmentedControl :items="viewItems" variant="default" />
        <SegmentedControl :items="viewItems" variant="inline" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="flex flex-col items-start gap-3">
        <SegmentedControl :items="viewItems" size="sm" />
        <SegmentedControl :items="viewItems" size="md" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="flex flex-col items-start gap-3">
        <SegmentedControl :items="viewItems" default-value="day" />
        <SegmentedControl :items="viewItems" default-value="week" />
        <SegmentedControl :items="viewItems" default-value="month" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="flex flex-col items-start gap-3">
        <SegmentedControl :items="viewItems" />
        <div data-density="compact"><SegmentedControl :items="viewItems" /></div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="w-[480px] rounded-lg border border-border bg-card p-4">
        <div class="mb-3 text-sm font-medium text-gray-700">Calendar view</div>
        <SegmentedControl :items="viewItems" default-value="week" />
      </div>
    `,
  }),
}
