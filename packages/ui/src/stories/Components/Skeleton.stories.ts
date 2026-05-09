import type { Meta, StoryObj } from '@storybook/vue3'
import { Skeleton } from '../../components/ui/skeleton'

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Skeleton>

export const ListItem: Story = {
  render: () => ({
    components: { Skeleton },
    template: `
      <div class="w-80 flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <Skeleton class="h-8 w-8 rounded-md" />
          <div class="flex-1 flex flex-col gap-1.5">
            <Skeleton class="h-3.5 w-32" />
            <Skeleton class="h-3 w-48" />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Skeleton class="h-8 w-8 rounded-md" />
          <div class="flex-1 flex flex-col gap-1.5">
            <Skeleton class="h-3.5 w-28" />
            <Skeleton class="h-3 w-44" />
          </div>
        </div>
      </div>
    `,
  }),
}

export const Card: Story = {
  render: () => ({
    components: { Skeleton },
    template: `
      <div class="w-72 flex flex-col gap-3">
        <Skeleton class="h-32 w-full" />
        <Skeleton class="h-4 w-2/3" />
        <Skeleton class="h-3 w-full" />
      </div>
    `,
  }),
}
