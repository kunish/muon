import antfu from '@antfu/eslint-config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default antfu(
  {
    vue: true,
    typescript: true,
    stylistic: false,
    formatters: false,
    ignores: [
      '.claude/**',
      '.opencode/**',
      '.github/prompts/**',
      '.github/skills/**',
      '.planning/**',
      '.playwright-cli/**',
      'design/stitch/**',
      'docs/superpowers/**',
      'output/playwright/**',
      'openspec/**',
      'out/**',
      'release/**',
    ],
  },
  eslintConfigPrettier,
  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      'yaml/plain-scalar': 'off',
    },
  },
)
