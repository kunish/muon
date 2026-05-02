import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
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
      '@muon/ui/media': resolve(__dirname, 'packages/ui/src/composables/useAuthMedia.ts'),
      '@muon/ui/avatar/Avatar.vue': resolve(__dirname, 'packages/ui/src/components/ui/avatar/Avatar.vue'),
      '@muon/ui': resolve(__dirname, 'packages/ui/src/components/ui'),
    },
  },
})
