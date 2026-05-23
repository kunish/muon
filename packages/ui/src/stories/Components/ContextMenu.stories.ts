import type { Meta, StoryObj } from '@storybook/vue3'
import { Copy, Pin, Reply, Trash } from 'lucide-vue-next'
import { defineComponent, h, onMounted, ref } from 'vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../../components/ui/context-menu'

const meta: Meta<typeof ContextMenu> = {
  title: 'Components/ContextMenu',
  component: ContextMenu,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof ContextMenu>
type ContextMenuStoryItem = { label: string; icon?: any; danger?: boolean; separator?: false } | { separator: true }

// reka-ui's ContextMenuTrigger listens for the native `contextmenu` event
// (no controlled `open` prop, unlike Dialog/Popover). The story dispatches
// the event programmatically after mount so the screenshot pipeline can
// capture the open state without manual interaction.
function makeContextMenuStory(triggerLabel: string, items: ContextMenuStoryItem[]) {
  return defineComponent({
    setup() {
      const triggerEl = ref<HTMLElement>()

      onMounted(() => {
        // small delay so reka-ui's listeners attach before we fire
        setTimeout(() => {
          const target = triggerEl.value
          if (!target) return
          const rect = target.getBoundingClientRect()
          target.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
            }),
          )
        }, 100)
      })

      return () =>
        h('div', { class: 'flex items-center justify-center min-h-screen' }, [
          h(ContextMenu, null, {
            default: () => [
              h(
                ContextMenuTrigger,
                { asChild: true },
                {
                  default: () =>
                    h(
                      'div',
                      {
                        ref: triggerEl,
                        class: 'rounded-md border bg-card px-6 py-4 text-sm text-muted-foreground',
                      },
                      triggerLabel,
                    ),
                },
              ),
              h(ContextMenuContent, null, {
                default: () =>
                  items.map((item, i) => {
                    if (item.separator) return h(ContextMenuSeparator, { key: `sep-${i}` })
                    return h(ContextMenuItem, { key: i, class: item.danger ? 'text-destructive' : undefined }, () => [
                      item.icon ? h(item.icon) : null,
                      h('span', null, item.label),
                    ])
                  }),
              }),
            ],
          }),
        ])
    },
  })
}

export const MessageBubble: Story = {
  render: () =>
    makeContextMenuStory('右键此消息', [
      { label: '回复', icon: Reply },
      { label: '复制', icon: Copy },
      { label: '置顶', icon: Pin },
      { separator: true },
      { label: '删除', icon: Trash, danger: true },
    ]),
}
