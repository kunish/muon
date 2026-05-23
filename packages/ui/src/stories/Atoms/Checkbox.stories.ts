import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { Checkbox } from '../../atoms/checkbox'

const meta: Meta<typeof Checkbox> = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
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

type Story = StoryObj<typeof Checkbox>

export const Default: Story = {
  render: args => ({
    components: { Checkbox },
    setup: () => ({ args }),
    template: '<Checkbox v-bind="args" />',
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Checkbox },
    template: `
      <div class="flex items-center gap-6">
        <div class="flex flex-col items-center gap-2">
          <Checkbox size="sm" :default-checked="true" />
          <span class="text-[10px] text-muted-foreground">sm</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Checkbox size="md" :default-checked="true" />
          <span class="text-[10px] text-muted-foreground">md</span>
        </div>
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Checkbox },
    setup() {
      const indet = ref<boolean | 'indeterminate'>('indeterminate')
      return { indet }
    },
    template: `
      <div class="flex items-center gap-6">
        <div class="flex flex-col items-center gap-2">
          <Checkbox :default-checked="false" />
          <span class="text-[10px] text-muted-foreground">unchecked</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Checkbox :model-value="true" />
          <span class="text-[10px] text-muted-foreground">checked</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Checkbox :model-value="indet" @update:model-value="(v) => indet = v" />
          <span class="text-[10px] text-muted-foreground">indeterminate</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <Checkbox :model-value="true" disabled />
          <span class="text-[10px] text-muted-foreground">disabled</span>
        </div>
      </div>
    `,
  }),
}

export const Controlled: Story = {
  render: () => ({
    components: { Checkbox },
    setup() {
      const checked = ref<boolean | 'indeterminate'>(false)
      return { checked }
    },
    template: `
      <div class="flex items-center gap-3">
        <Checkbox :model-value="checked" @update:model-value="(v) => checked = v" />
        <span class="text-xs text-muted-foreground">checked = {{ checked }}</span>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Checkbox },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <Checkbox :model-value="true" />
          <Checkbox :default-checked="false" />
          <span class="text-[10px] text-muted-foreground">comfortable</span>
        </div>
        <div data-density="compact" class="flex items-center gap-3">
          <Checkbox :model-value="true" />
          <Checkbox :default-checked="false" />
          <span class="text-[10px] text-muted-foreground">compact</span>
        </div>
      </div>
    `,
  }),
}
