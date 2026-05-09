import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { Toaster } from '../../components/ui/sonner'

// Wrapper that mounts the Toaster and fires a single toast in onMounted with
// duration: Infinity so the slide-in animation completes once and the toast
// stays put for the screenshot.
function makeToastStory(payload: () => void) {
  return defineComponent({
    setup() {
      onMounted(() => {
        // small delay so the Toaster mounts before we push messages into it
        setTimeout(payload, 50)
      })
      return () => h(Toaster)
    },
  })
}

const meta: Meta = {
  title: 'Components/Sonner',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj

export const Success: Story = {
  render: () => makeToastStory(() => {
    toast.success('设置已保存', {
      description: '所有偏好同步到了云端账号。',
      duration: Number.POSITIVE_INFINITY,
    })
  }),
}

export const Error: Story = {
  render: () => makeToastStory(() => {
    toast.error('网络连接失败', {
      description: '请检查网络后重试。',
      duration: Number.POSITIVE_INFINITY,
    })
  }),
}
