import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { Switch } from '../../atoms/switch'

const meta: Meta<typeof Switch> = {
  title: 'Atoms/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
    disabled: { control: 'boolean' },
    defaultChecked: { control: 'boolean' },
  },
  args: {
    size: 'md',
    disabled: false,
    defaultChecked: false,
  },
}

export default meta

type Story = StoryObj<typeof Switch>

export const Default: Story = {
  render: args => ({
    components: { Switch },
    setup: () => ({ args }),
    template: '<Switch v-bind="args" />',
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Switch },
    template: `
      <div class="flex items-center gap-6">
        <div class="flex flex-col items-center gap-2">
          <Switch size="sm" :default-checked="true" />
          <span class="text-[10px] text-muted-foreground">sm</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Switch size="md" :default-checked="true" />
          <span class="text-[10px] text-muted-foreground">md</span>
        </div>
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Switch },
    template: `
      <div class="flex items-center gap-6">
        <div class="flex flex-col items-center gap-2">
          <Switch :default-checked="false" />
          <span class="text-[10px] text-muted-foreground">off</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Switch :default-checked="true" />
          <span class="text-[10px] text-muted-foreground">on</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Switch :default-checked="false" disabled />
          <span class="text-[10px] text-muted-foreground">disabled off</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Switch :default-checked="true" disabled />
          <span class="text-[10px] text-muted-foreground">disabled on</span>
        </div>
      </div>
    `,
  }),
}

export const Controlled: Story = {
  render: () => ({
    components: { Switch },
    setup() {
      const checked = ref(false)
      return { checked }
    },
    template: `
      <div class="flex items-center gap-3">
        <Switch :model-value="checked" @update:model-value="(v) => checked = v" />
        <span class="text-xs text-muted-foreground">checked = {{ checked }}</span>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Switch },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <Switch :default-checked="true" />
          <Switch :default-checked="false" />
          <span class="text-[10px] text-muted-foreground">comfortable</span>
        </div>
        <div data-density="compact" class="flex items-center gap-3">
          <Switch :default-checked="true" />
          <Switch :default-checked="false" />
          <span class="text-[10px] text-muted-foreground">compact</span>
        </div>
      </div>
    `,
  }),
}
