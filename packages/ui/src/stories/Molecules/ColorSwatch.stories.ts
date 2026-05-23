import type { Meta, StoryObj } from '@storybook/vue3'
import { ColorSwatch, PRESET_COLORS } from '../../molecules/color-swatch'

const meta: Meta<typeof ColorSwatch> = {
  title: 'Molecules/ColorSwatch',
  component: ColorSwatch,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    selected: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { color: 'var(--brand-500)', size: 'md', selected: false, disabled: false },
}

export default meta
type Story = StoryObj<typeof ColorSwatch>

export const Default: Story = {
  render: (args) => ({
    components: { ColorSwatch },
    setup: () => ({ args }),
    template: '<ColorSwatch v-bind="args" />',
  }),
}

export const Variants: Story = {
  render: () => ({
    components: { ColorSwatch },
    setup: () => ({ PRESET_COLORS }),
    template: `
      <div class="grid grid-cols-6 gap-2 w-fit">
        <ColorSwatch v-for="c in PRESET_COLORS" :key="c" :color="c" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { ColorSwatch },
    template: `
      <div class="flex items-end gap-2">
        <ColorSwatch color="var(--brand-500)" size="sm" />
        <ColorSwatch color="var(--brand-500)" size="md" />
        <ColorSwatch color="var(--brand-500)" size="lg" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { ColorSwatch },
    template: `
      <div class="flex gap-2">
        <ColorSwatch color="var(--brand-500)" />
        <ColorSwatch color="var(--red-500)" :selected="true" />
        <ColorSwatch color="var(--green-500)" :disabled="true" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { ColorSwatch },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex gap-2">
          <ColorSwatch color="var(--brand-500)" />
          <ColorSwatch color="var(--red-500)" />
        </div>
        <div data-density="compact" class="flex gap-2">
          <ColorSwatch color="var(--brand-500)" />
          <ColorSwatch color="var(--red-500)" />
        </div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { ColorSwatch },
    setup: () => ({ PRESET_COLORS }),
    template: `
      <div class="w-[260px] rounded-lg border border-border bg-card p-4">
        <div class="mb-3 text-sm font-medium text-gray-700">Event color</div>
        <div class="grid grid-cols-6 gap-2">
          <ColorSwatch v-for="(c, i) in PRESET_COLORS" :key="c" :color="c" :selected="i === 0" />
        </div>
      </div>
    `,
  }),
}
