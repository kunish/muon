import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const PALETTES = ['brand', 'gray', 'red', 'green', 'orange', 'cyan'] as const
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const

const PaletteSwatches = defineComponent({
  name: 'PaletteSwatches',
  setup() {
    return () => h('div', { class: 'flex flex-col gap-4 p-4' }, PALETTES.map(p =>
      h('div', { key: p, class: 'flex flex-col gap-1' }, [
        h('div', { class: 'text-sm font-medium' }, p),
        h('div', { class: 'flex gap-1' }, STEPS.map(s =>
          h('div', {
            key: s,
            class: 'flex h-12 w-12 items-end justify-center rounded-sm text-[10px] font-mono text-white/80',
            style: { background: `var(--${p}-${s})` },
          }, s),
        )),
      ]),
    ))
  },
})

const meta: Meta<typeof PaletteSwatches> = {
  title: 'Foundation/Tokens',
  component: PaletteSwatches,
  tags: ['autodocs'],
}

export default meta

export const Palette: StoryObj<typeof PaletteSwatches> = {}
