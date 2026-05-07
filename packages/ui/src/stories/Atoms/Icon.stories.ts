import type { Meta, StoryObj } from '@storybook/vue3'
import { Heart, MoreVertical, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import { Icon } from '../../atoms/icon'

const meta: Meta<typeof Icon> = {
  title: 'Atoms/Icon',
  component: Icon,
  tags: ['autodocs'],
  argTypes: {
    as: { control: 'object' },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
  },
  args: {
    as: Heart,
    size: 'md',
  },
}

export default meta

type Story = StoryObj<typeof Icon>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({
    components: { Icon, Heart },
    setup: () => ({ args, Heart }),
    template: '<Icon :as="Heart" v-bind="args" />',
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Icon, Heart },
    setup: () => ({ Heart }),
    template: `
      <div class="flex items-end gap-4">
        <div class="flex flex-col items-center gap-1">
          <Icon :as="Heart" size="xs" />
          <span class="text-[10px] text-muted-foreground">xs · 12</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Icon :as="Heart" size="sm" />
          <span class="text-[10px] text-muted-foreground">sm · 14</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Icon :as="Heart" size="md" />
          <span class="text-[10px] text-muted-foreground">md · 16</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Icon :as="Heart" size="lg" />
          <span class="text-[10px] text-muted-foreground">lg · 20</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Icon :as="Heart" size="xl" />
          <span class="text-[10px] text-muted-foreground">xl · 24</span>
        </div>
      </div>
    `,
  }),
}

export const Colors: Story = {
  render: () => ({
    components: { Icon, Heart, AlertCircle, CheckCircle2 },
    setup: () => ({ Heart, AlertCircle, CheckCircle2 }),
    template: `
      <div class="flex items-center gap-4">
        <div class="flex flex-col items-center gap-1">
          <div class="text-primary">
            <Icon :as="Heart" size="lg" />
          </div>
          <span class="text-[10px] text-muted-foreground">text-primary</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <div class="text-destructive">
            <Icon :as="AlertCircle" size="lg" />
          </div>
          <span class="text-[10px] text-muted-foreground">text-destructive</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <div class="text-success">
            <Icon :as="CheckCircle2" size="lg" />
          </div>
          <span class="text-[10px] text-muted-foreground">text-success</span>
        </div>
      </div>
    `,
  }),
}

export const Stroke: Story = {
  render: () => ({
    components: { Icon, Heart },
    setup: () => ({ Heart }),
    template: `
      <div class="flex items-end gap-8">
        <div class="flex flex-col items-center gap-1">
          <Icon :as="Heart" size="xl" class="stroke-[1]" />
          <span class="text-[10px] text-muted-foreground">stroke-[1]</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Icon :as="Heart" size="xl" class="stroke-[1.5]" />
          <span class="text-[10px] text-muted-foreground">stroke-[1.5] (default)</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Icon :as="Heart" size="xl" class="stroke-[2]" />
          <span class="text-[10px] text-muted-foreground">stroke-[2]</span>
        </div>
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Icon, MoreVertical },
    setup: () => ({ MoreVertical }),
    template: `
      <div class="flex items-center gap-4">
        <div class="flex flex-col items-center gap-1">
          <button class="rounded p-1 hover:bg-gray-100 active:bg-gray-200">
            <Icon :as="MoreVertical" size="md" />
          </button>
          <span class="text-[10px] text-muted-foreground">in button (hover/active)</span>
        </div>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Icon, Heart },
    setup: () => ({ Heart }),
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <Icon :as="Heart" />
          <Icon :as="Heart" />
          <Icon :as="Heart" />
        </div>
        <div data-density="compact" class="flex items-center gap-2">
          <Icon :as="Heart" />
          <Icon :as="Heart" />
          <Icon :as="Heart" />
        </div>
      </div>
    `,
  }),
}
