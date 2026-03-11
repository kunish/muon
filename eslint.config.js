import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  formatters: true,
  ignores: [
    '.claude/**',
    '.opencode/**',
    '.github/prompts/**',
    '.github/skills/**',
    '.planning/**',
    'openspec/**',
  ],
})
