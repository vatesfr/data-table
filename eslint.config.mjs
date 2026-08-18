import eslint from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.vue'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // react-hooks rules (rules-of-hooks, ref immutability, etc.) are React-specific and don't apply
  // to packages/vanilla's Solid components — Solid's ref callbacks/reactivity model is
  // structurally different (e.g. reassigning a plain `let` ref variable in a callback ref is the
  // normal, idiomatic Solid pattern, not a rules-of-hooks violation) — so this plugin is scoped to
  // packages/react only, rather than applied to every .tsx file in the repo.
  {
    files: ['packages/react/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
)
