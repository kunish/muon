import type { Meta, StoryObj } from '@storybook/vue3'
import { Progress } from '../../components/ui/progress'

const meta: Meta<typeof Progress> = {
  title: 'Components/Progress',
  component: Progress,
  tags: ['autodocs'],
  args: { modelValue: 60 },
}

export default meta
type Story = StoryObj<typeof Progress>

export const Default: Story = {
  render: args => ({
    components: { Progress },
    setup: () => ({ args }),
    template: `<div class="w-72"><Progress :model-value="args.modelValue" /></div>`,
  }),
}

export const Steps: Story = {
  render: () => ({
    components: { Progress },
    template: `
      <div class="w-72 flex flex-col gap-3">
        <div>
          <p class="text-xs text-muted-foreground mb-1">上传中 25%</p>
          <Progress :model-value="25" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-1">同步中 60%</p>
          <Progress :model-value="60" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-1">完成 100%</p>
          <Progress :model-value="100" />
        </div>
      </div>
    `,
  }),
}
