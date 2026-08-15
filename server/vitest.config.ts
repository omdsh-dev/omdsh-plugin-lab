import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['server/tests/**/*.spec.ts'],
    testTimeout: 10_000,
  },
})
