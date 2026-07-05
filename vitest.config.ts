import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['electron/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    coverage: {
      reporter: ['text', 'lcov']
    }
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'electron'),
      '@renderer': resolve(__dirname, 'src')
    }
  }
})
