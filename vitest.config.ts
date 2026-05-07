import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        statements: 15,
        branches: 10,
        functions: 15,
        lines: 15,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@matrix': resolve(__dirname, 'src/matrix'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@muon/enterprise-contracts': resolve(__dirname, 'packages/enterprise-contracts/src/index.ts'),
      '@muon/rich-text/editor': resolve(__dirname, 'packages/rich-text/src/editor/useRichTextEditor.ts'),
      '@muon/rich-text/html': resolve(__dirname, 'packages/rich-text/src/htmlSanitizer.ts'),
      '@muon/rich-text/linkify': resolve(__dirname, 'packages/rich-text/src/linkify.ts'),
      '@muon/rich-text/markdown': resolve(__dirname, 'packages/rich-text/src/markdown.ts'),
      '@muon/rich-text/message-content': resolve(__dirname, 'packages/rich-text/src/components/RichMessageContent.vue'),
      '@muon/rich-text': resolve(__dirname, 'packages/rich-text/src/index.ts'),
    },
  },
})
