import type { Meta, StoryObj } from '@storybook/vue3'
import { SearchBox } from '../../molecules/search-box'

const meta: Meta<typeof SearchBox> = {
  title: 'Molecules/SearchBox',
  component: SearchBox,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
    disabled: { control: 'boolean' },
  },
  args: { size: 'md', placeholder: 'Search', disabled: false },
}

export default meta
type Story = StoryObj<typeof SearchBox>

export const Default: Story = {
  render: args => ({
    components: { SearchBox },
    setup: () => ({ args }),
    template: '<div class="w-80"><SearchBox v-bind="args" /></div>',
  }),
}

export const Variants: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="flex flex-col gap-3 w-80">
        <SearchBox placeholder="Plain" />
        <SearchBox placeholder="With kbd hint" :kbd="['Cmd', 'K']" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="flex flex-col gap-3 w-80">
        <SearchBox size="sm" placeholder="Small (28)" />
        <SearchBox size="md" placeholder="Medium (32)" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="flex flex-col gap-3 w-80">
        <SearchBox placeholder="Empty" />
        <SearchBox default-value="With text" />
        <SearchBox disabled placeholder="Disabled" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="flex flex-col gap-3 w-80">
        <SearchBox placeholder="Default density" />
        <div data-density="compact"><SearchBox placeholder="Compact density" /></div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="w-80 rounded-lg border border-border bg-card p-3">
        <SearchBox placeholder="Search messages, files…" :kbd="['Cmd', 'K']" />
      </div>
    `,
  }),
}
