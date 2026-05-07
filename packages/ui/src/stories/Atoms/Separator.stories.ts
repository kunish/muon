import type { Meta, StoryObj } from '@storybook/vue3'
import { Separator } from '../../atoms/separator'

const meta: Meta<typeof Separator> = {
  title: 'Atoms/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
    inset: { control: 'boolean' },
  },
  args: { orientation: 'horizontal', inset: false },
}

export default meta

type Story = StoryObj<typeof Separator>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({
    components: { Separator },
    setup: () => ({ args }),
    template: '<Separator v-bind="args" />',
  }),
}

export const Horizontal: Story = {
  render: () => ({
    components: { Separator },
    template: `
      <div class="flex flex-col gap-2">
        <p>Before separator</p>
        <Separator orientation="horizontal" />
        <p>After separator</p>
      </div>
    `,
  }),
}

export const Vertical: Story = {
  render: () => ({
    components: { Separator },
    template: `
      <div class="flex gap-2 h-20">
        <p>Left</p>
        <Separator orientation="vertical" />
        <p>Right</p>
      </div>
    `,
  }),
}

export const Inset: Story = {
  render: () => ({
    components: { Separator },
    template: `
      <div class="flex flex-col gap-2">
        <p>Before inset separator</p>
        <Separator orientation="horizontal" inset />
        <p>After inset separator</p>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Separator },
    template: `
      <div class="flex flex-col gap-4">
        <div>
          <p class="text-sm text-gray-600 mb-2">Default density</p>
          <p>Before</p>
          <Separator />
          <p>After</p>
        </div>
        <div data-density="compact">
          <p class="text-sm text-gray-600 mb-2">Compact density</p>
          <p>Before</p>
          <Separator />
          <p>After</p>
        </div>
      </div>
    `,
  }),
}
