import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  outDir: 'dist',
  platform: 'browser',
  format: 'esm',
  dts: true,
  sourcemap: true,
  clean: false,
  external: [/^@deepseek-ai\//u, /^react(?:\/.*)?$/u],
})
