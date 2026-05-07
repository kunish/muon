import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h, ref, onMounted } from 'vue'

const Anchors = defineComponent({
  name: 'AnchorViewer',
  setup() {
    const images = ref<string[]>([])
    onMounted(async () => {
      const res = await fetch('/anchors-manifest.json').catch(() => null)
      images.value = res?.ok ? await res.json() : []
    })
    return () => h('div', { class: 'flex flex-col gap-6 p-4' }, [
      h('p', { class: 'text-sm text-muted-foreground' },
        'Reference images live in .storybook/anchors. If empty, supply 5–8 screenshots and re-run Storybook.'),
      ...images.value.map(src =>
        h('img', { key: src, src, class: 'max-w-full rounded-sm border border-border' }),
      ),
    ])
  },
})

const meta: Meta<typeof Anchors> = {
  title: 'Foundation/Anchors',
  component: Anchors,
  tags: ['autodocs'],
}

export default meta

export const Reference: StoryObj<typeof Anchors> = {}
