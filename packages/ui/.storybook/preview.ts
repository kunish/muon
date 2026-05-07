import type { Preview } from '@storybook/vue3'
import { withThemeByClassName } from '@storybook/addon-themes'
import '../src/styles.css'

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true },
    layout: 'centered',
  },
  decorators: [
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
    }),
  ],
  globalTypes: {
    density: {
      description: 'Density mode',
      defaultValue: 'comfortable',
      toolbar: {
        title: 'Density',
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'compact', title: 'Compact' },
        ],
      },
    },
  },
}

export default preview
