import type { StorybookConfig } from '@storybook/vue3-vite'

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  staticDirs: ['./anchors'],
  docs: { autodocs: 'tag' },
}

export default config
