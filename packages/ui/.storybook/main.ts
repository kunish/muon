import type { StorybookConfig } from '@storybook/vue3-vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { mergeConfig } from 'vite'

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-themes'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  staticDirs: ['./anchors'],
  docs: { autodocs: 'tag' },
  // Storybook's Vite needs both Vue and Tailwind v4 plugins explicitly:
  // @storybook/vue3-vite 8.6 doesn't auto-register @vitejs/plugin-vue, and
  // Tailwind v4 emits no utility CSS without @tailwindcss/vite. Without these,
  // stories silently render unstyled (or as Vite error pages) and visual
  // regression "passes" against worthless baselines.
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      plugins: [vue(), tailwindcss()],
    })
  },
}

export default config
