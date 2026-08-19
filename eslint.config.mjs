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
  // ESLint's core `no-unassigned-vars` (in `eslint.configs.recommended` as of ESLint 10) flags
  // every `let x: HTMLDivElement | undefined` that's only ever written via Solid's `ref={x}`
  // idiom — passing a plain variable as `ref` compiles (via babel-preset-solid) into an
  // assignment to that variable, invisible to ESLint's static analysis since it runs on the
  // pre-compile JSX. Same root cause as the react-hooks exclusion above: Solid's ref model reads,
  // to a rule written for plain JS/React, as "declared but never assigned" when it's actually the
  // normal way this package attaches a ref to a JSX element.
  {
    files: ['packages/vanilla/**/*.tsx'],
    rules: { 'no-unassigned-vars': 'off' },
  },
)
