import type { Meta, StoryObj } from '@storybook/vue3'
import { Kbd } from '../../atoms/kbd'

const meta: Meta<typeof Kbd> = {
  title: 'Atoms/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  argTypes: {
    keys: { control: 'object' },
    size: { control: 'select', options: ['sm', 'md'] },
  },
  args: { keys: ['Cmd', 'K'], size: 'md' },
}

export default meta

type Story = StoryObj<typeof Kbd>

export const Default: Story = {
  render: args => ({
    components: { Kbd },
    setup: () => ({ args }),
    template: '<Kbd v-bind="args" />',
  }),
}

export const Combos: Story = {
  render: () => ({
    components: { Kbd },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 w-32">Open palette:</span>
          <Kbd :keys="['Cmd', 'K']" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 w-32">Send message:</span>
          <Kbd :keys="['Shift', 'Enter']" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 w-32">Command palette:</span>
          <Kbd :keys="['Cmd', 'Shift', 'P']" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 w-32">Save:</span>
          <Kbd :keys="['Cmd', 'S']" />
        </div>
      </div>
    `,
  }),
}

export const MacSymbols: Story = {
  render: () => ({
    components: { Kbd },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 w-32">Modifiers:</span>
          <Kbd :keys="['Cmd']" />
          <Kbd :keys="['Ctrl']" />
          <Kbd :keys="['Alt']" />
          <Kbd :keys="['Shift']" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 w-32">Whitespace:</span>
          <Kbd :keys="['Enter']" />
          <Kbd :keys="['Tab']" />
          <Kbd :keys="['Backspace']" />
          <Kbd :keys="['Esc']" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 w-32">Arrows:</span>
          <Kbd :keys="['ArrowUp']" />
          <Kbd :keys="['ArrowDown']" />
          <Kbd :keys="['ArrowLeft']" />
          <Kbd :keys="['ArrowRight']" />
        </div>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Kbd },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 w-32">Small (sm):</span>
          <Kbd :keys="['Cmd', 'K']" size="sm" />
          <Kbd :keys="['Shift', 'Enter']" size="sm" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 w-32">Medium (md):</span>
          <Kbd :keys="['Cmd', 'K']" size="md" />
          <Kbd :keys="['Shift', 'Enter']" size="md" />
        </div>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Kbd },
    template: `
      <div class="flex flex-col gap-4">
        <div>
          <p class="text-sm text-gray-600 mb-2">Default density</p>
          <div class="flex items-center gap-2">
            <Kbd :keys="['Cmd', 'K']" />
            <Kbd :keys="['Shift', 'Enter']" />
            <Kbd :keys="['Cmd', 'Shift', 'P']" />
          </div>
        </div>
        <div data-density="compact">
          <p class="text-sm text-gray-600 mb-2">Compact density</p>
          <div class="flex items-center gap-2">
            <Kbd :keys="['Cmd', 'K']" size="sm" />
            <Kbd :keys="['Shift', 'Enter']" size="sm" />
            <Kbd :keys="['Cmd', 'Shift', 'P']" size="sm" />
          </div>
        </div>
      </div>
    `,
  }),
}
