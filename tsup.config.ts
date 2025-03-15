import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  splitting: false,
  sourcemap: false,
  outDir: './lib',
  format: ['cjs'],
  clean: true,
  dts: false,
  external: [
    'effect',
    '@effect/platform',
    '@effect/platform-node',
    '@effect/cli',
    '@inquirer/prompts',
    'jscodeshift',
    'prettier',
    'glob',
    'mustache',
    'cli-color',
  ],
});
