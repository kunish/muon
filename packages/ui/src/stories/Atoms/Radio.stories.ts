import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { Radio, RadioGroup } from '../../atoms/radio'

const meta: Meta<typeof Radio> = {
  title: 'Atoms/Radio',
  component: Radio,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
  },
  args: {
    size: 'md',
  },
}

export default meta

type Story = StoryObj<typeof Radio>

export const Default: Story = {
  render: (args) => ({
    components: { Radio, RadioGroup },
    setup: () => ({ args }),
    template: `
      <RadioGroup default-value="a">
        <Radio v-bind="args" value="a" />
      </RadioGroup>
    `,
  }),
}

export const Group: Story = {
  render: () => ({
    components: { Radio, RadioGroup },
    template: `
      <RadioGroup default-value="b">
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio value="a" />
          <span>Option A</span>
        </label>
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio value="b" />
          <span>Option B</span>
        </label>
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio value="c" />
          <span>Option C</span>
        </label>
      </RadioGroup>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Radio, RadioGroup },
    template: `
      <div class="flex items-center gap-6">
        <div class="flex flex-col items-center gap-2">
          <RadioGroup default-value="a">
            <Radio size="sm" value="a" />
          </RadioGroup>
          <span class="text-[10px] text-muted-foreground">sm</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <RadioGroup default-value="a">
            <Radio size="md" value="a" />
          </RadioGroup>
          <span class="text-[10px] text-muted-foreground">md</span>
        </div>
      </div>
    `,
  }),
}

export const Disabled: Story = {
  render: () => ({
    components: { Radio, RadioGroup },
    template: `
      <RadioGroup default-value="a" disabled>
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio value="a" />
          <span>Disabled selected</span>
        </label>
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio value="b" />
          <span>Disabled unselected</span>
        </label>
      </RadioGroup>
    `,
  }),
}

export const Controlled: Story = {
  render: () => ({
    components: { Radio, RadioGroup },
    setup() {
      const value = ref<string>('a')
      return { value }
    },
    template: `
      <div class="flex flex-col gap-3">
        <RadioGroup :model-value="value" @update:model-value="(v) => value = v">
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <Radio value="a" />
            <span>Option A</span>
          </label>
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <Radio value="b" />
            <span>Option B</span>
          </label>
        </RadioGroup>
        <span class="text-xs text-muted-foreground">value = {{ value }}</span>
      </div>
    `,
  }),
}
