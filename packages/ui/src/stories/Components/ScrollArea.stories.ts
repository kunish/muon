import type { Meta, StoryObj } from '@storybook/vue3'
import { ScrollArea } from '../../components/ui/scroll-area'

const meta: Meta<typeof ScrollArea> = {
  title: 'Components/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ScrollArea>

export const ChatList: Story = {
  render: () => ({
    components: { ScrollArea },
    template: `
      <ScrollArea class="h-72 w-72 rounded-lg border bg-card">
        <div class="p-3 flex flex-col gap-2 text-sm">
          <div v-for="i in 20" :key="i" class="flex items-center gap-2">
            <span class="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">{{ String.fromCharCode(64 + (i % 26 || 26)) }}</span>
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">联系人 {{ i }}</p>
              <p class="text-xs text-muted-foreground truncate">最后消息预览…</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    `,
  }),
}
