# CLAUDE.md

## Project context

- **Stack**: TypeScript, npm workspaces monorepo; adapters for React, Vue 3, Solid, plus a framework-free vanilla wrapper; Vite builds, Vitest tests.
- **Layout**:
  ```
  packages/
    core/    — @vates/data-table-core    (pure TS, zero dependencies; not a public API — see below)
    react/   — @vates/data-table-react   (peer dep: react)
    vue/     — @vates/data-table-vue     (peer dep: vue)
    solid/   — @vates/data-table-solid   (peer dep: solid-js)
    vanilla/ — @vates/data-table-vanilla (no framework dependency; bundles @vates/data-table-solid)
  demo/      — one Vite app per adapter, written the way a real consumer would use it
  docs/      — design docs, see Documentation
  ```
- **Setup**: `npm install`; husky hooks install via `prepare`. No services needed.
- **Build**: `npm run build` (order matters: core → react/vue/solid → vanilla); one package: `npm run build -w packages/X`.
- **Test**: `npm run test` (~20 s) — one package: `npm run test -w packages/X` (`test:watch` for watch mode) — one file: `npx vitest run <path>` from the package dir. Tests run in jsdom with no network or external services. Benchmarks: `npm run bench -w packages/core`.
- **Type-check**: `npm run type-check`.
- **Lint/format**: ESLint (`npm run lint`) + Prettier (`npm run format`); lint-staged runs both on commit. `npm run check:docs` fails when a code span in `docs/*.md`/CLAUDE.md names something absent from the code; list intentional mentions (removed or external names) in a `<!-- check-docs-ignore: … -->` comment in that doc.
- **Demos**: `npm run dev:react|vue|solid|vanilla` (ports 58981–58984).
- **UX**: `ux-review` walks `docs/use-cases.md` on the demos and records findings in `docs/improvements.md`; `ux-fix` fixes them, one commit each.

## Architecture

- `@vates/data-table-core` exists only so adapters share code. Its main entry is a small deliberate **public** surface that every adapter re-exports identically; everything else lives behind `@vates/data-table-core/internal`, imported only by adapter source. An ESLint `no-restricted-imports` rule fails if a demo imports core directly. Authoritative list: `packages/core/README.md`'s "Public API surface".
- Core sub-paths `/locales` and `/theme` are re-exported by every adapter (its own `/theme` sub-path, built by a separate `vite.theme.config.ts` pass because UMD/IIFE builds allow one entry).
- Each adapter has a state hook (`useTableState`/`createTableState`) returning a namespaced `TableState`, a render layer `DataTableView` taking it as a `table` prop, and a thin `DataTable` wrapper combining the two.
- Pre-1.0: breaking changes ship as hard cuts, no compat shims.

## Documentation

Read the relevant doc before changing that area.

- `docs/packages.md` — per-package structure (core, react, vue, vanilla), `DataTableView`/`DataTable` split
- `docs/solid-package.md` — Solid adapter design and Solid-specific workarounds
- `docs/table-state.md` — namespaced `TableState` shape, `visibleCols` reconciliation
- `docs/columns.md` — computed columns (`value`), global search, column categories
- `docs/sorting.md` — header-click sorting, `sortable`/`defaultSortDir`, custom `compare`
- `docs/filter-dropdown.md` — filter dropdown design and core primitives
- `docs/grouped-columns.md` — grouping, `groupValue` bucketers, group/sort sync, aggregation
- `docs/column-reordering.md` — `columnOrder`, drag-and-drop
- `docs/selection-and-row-click.md` — row selection (`getRowId`, shift-range), `onRowClick`
- `docs/keyboard-navigation.md` — table-body roving tabindex, external row focus
- `docs/dropdown-keyboard-nav.md` — dropdown search and keyboard nav
- `docs/pagination.md` — pagination, grouping × pagination
- `docs/toolbar.md` — toolbar layout, clear buttons, active bar chips, viewport clamping, visual hierarchy
- `docs/i18n.md` — labels and locales
- `docs/view-persistence.md` — `TableViewState`, encoding, `initialViewState`, persistence helpers
- `docs/testing.md` — per-package test setup
- `docs/performance.md` — benchmarks and past optimizations
- `docs/build.md` — cross-package resolution in dev, build order
- `docs/use-cases.md` — end-user journeys, the yardstick for UX reviews
- `docs/ui-guidelines.md` — UI conventions where feature docs are silent
- `docs/improvements.md` — UX backlog (`U<n>` items)
- `docs/pitfalls.md` — surprising behaviors, misleading errors, failures and their fixes; check it when something fails or behaves unexpectedly

Load-bearing: the core public/internal split above (enforced by ESLint for demos) and the `typescript` override in `docs/pitfalls.md` (not enforced — a regression builds fine with empty `.d.ts` files).

## Code conventions

- **Tests**: Vitest, in each package's `src/__tests__/`; every new behavior is covered. Core logic is tested as pure functions; adapter UI via Testing Library (React), `@vue/test-utils` (Vue), or Solid's `render()` against jsdom. Vanilla tests drive `createDataTable` end to end.
- **Typing/strictness**: `strict: true` in every package; `any` is a lint warning. `npm run type-check` covers every package's `src/` (Vue via `vue-tsc`).
- **Error handling**: core functions don't throw on stale or malformed input (unknown column keys, non-finite page sizes, missing values); they degrade to a sane fallback so the table still renders.
- **Parity**: a feature lands in React, Vue and Solid (vanilla inherits it through Solid) unless explicitly scoped otherwise.
- **Simplicity**: build for current needs only — no speculative abstractions, options or extension points. Fix root causes rather than stacking special cases (propose it if that widens the change). Delete what the change makes dead (code, params, flags, tests, docs). Temporary code (shims, flags, workarounds) states its removal condition.
- **Style**: match the existing code; don't reformat code outside the change. Run the formatter on changed files instead of hand-formatting and don't fight its output. Lint stays at 0 problems; intended violations carry a targeted disable comment with a reason.

## Working style

- Be concise and economical everywhere: responses, code comments, and doc prose. No filler, no restating what was just done.
  - Code comments: one line, state the why only when non-obvious; skip the comment entirely if the code is self-explanatory.
  - Doc prose (README, CLAUDE.md, etc.): short bullets over paragraphs; no preamble, no summary section, lead with the point.
- Stay in scope: make the smallest change that satisfies the request, plus the Development workflow checklist below. Flag anything else — other issues, alternative approaches with your recommendation, work that would clearly pay off — instead of acting on it.
- Match the request's intent. A question or request for opinion gets an answer only — no edits or side-effecting commands, even when the fix seems obvious; offer to act instead. When unsure which it is, treat it as a question. An action request gets acted on without further go-ahead, except:
  - ambiguous request: ask clarifying questions first, batched into one round;
  - non-trivial change (multiple files, non-obvious design decisions, refactors): draft a plan and wait for approval.
- When acting on a request, ask only about real choices within it (no clear winner); otherwise apply your recommendation. Every question to the user goes through `AskUserQuestion`, including open-ended ones (offer the likely answers; the user can pick _Other_) and go-ahead requests after a plan. Never end a message with a question in prose.
- Reuse before writing: existing code, tests and docs first, then the standard library and dependencies already in use. For non-trivial problems with an established solution (parsing, dates, crypto, retries…), propose a library instead of hand-rolling it; adding one still needs approval (see Ask first). Flag duplication you spot, including code better moved to a shared module.
- When a dependency's bug or limitation gets in the way, first check for a newer version or an existing upstream issue. If it's a genuine upstream gap (not a misuse), flag it and propose an upstream issue or PR, with a draft, before working around it. Any interim workaround gets a one-line comment linking the upstream issue.
- Don't re-read a file already read in the current session unless it may have changed.
- Improve the setup when friction recurs: a correction you'd need again, a procedure repeated by hand, a rule that is stale, misleading or contradicts the code, a check better automated; friction inside a skill counts as recurring. End your response with a one-line proposal naming the target (this file, a skill, a script, a hook; see Where things belong) and the change. Prefer tightening or deleting a rule over adding one. Apply only on approval.

## Ask first

- Anything destructive or hard to reverse: `git reset --hard`, `git push --force`, rewriting pushed history, deleting files, `rm -rf node_modules` (use `npm ci` to resync instead).
- Publishing to npm: pushing a `v*` tag triggers `.github/workflows/publish.yml`. Never push a tag unprompted (see the `release` skill).
- Committing or pushing — only when explicitly asked.
- Outward-facing actions: opening PRs or issues, commenting, posting to external services.
- Adding a new dependency.
- Adding a skill, hook, plugin or agent.

## Where things belong

- Team/project conventions, workflow rules, architecture decisions: this file — version-controlled and binding for every contributor. Substantial detail goes in a project doc linked from Documentation above, not duplicated here; prefer a package README or `docs/` file.
- Multi-step procedures invoked on demand: `.claude/skills/` (e.g. `release`). Invoke a matching skill rather than improvising; it is the source of truth for its procedure, but if it contradicts this file, this file wins — flag the conflict. Propose a new skill when a procedure recurs. A skill keeps the judgment; its deterministic steps live in scripts it runs (`scripts/`).
- Automated behaviors ("always run X after Y"): Claude Code hooks in `.claude/settings.json`; instructions here cannot guarantee them.
- Facts specific to one person (role, working-style preferences, machine setup, session context): Claude's memory.
- Secrets, credentials, API keys, `.env` values, ephemeral state: nowhere — never committed.

## Git workflow

- Atomic commits: one logical change each, passing tests on its own.
- Commit messages explain the _why_, not just the _what_: short subject, body when context is needed.
- **Message format**: Conventional Commits with a scope where one applies (`feat(dropdowns): …`, `fix(ci): …`, `chore(release): …`). A commit fixing a GitHub issue carries a closing keyword (`Fixes #N`) in its body; if the issue number isn't known, ask before committing.
- Rewrite unpushed history freely: amend the commit just made instead of adding a fixup, and squash (`git reset --soft <parent>`, then recommit) several unpushed commits covering the same feature. Once pushed, a commit is shared — stop rewriting it.
- **Branching and merging**: no PRs; commit directly to `main`. Features spanning more than one commit get a dedicated branch closed with `git merge --no-ff` — never fast-forward or rebase-merge into `main`; the merge commit marks the unit of work.

## Development workflow

After making changes:

1. Update or add tests to cover the change. Run the single-package or single-file test command while iterating, then the full suite, type checker and linter once at the end; report actual results, not assumptions. Never skip, disable or weaken tests or assertions to get green, and never bypass hooks (`--no-verify`) — report the failure instead. Sole exception: a commit that genuinely needs no changelog entry may use `--no-verify` to skip `check-changelog.sh`, after running the other hook checks manually.
2. Update the demos (`demo/react`, `demo/vue`, `demo/solid`, `demo/vanilla`) to showcase a new feature where applicable.
3. Update affected docs (see Where things belong) and `CHANGELOG.md` under `## [Unreleased]` in [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format, in the same commit as the code.
4. Record what was surprising, misleading or broken, and its fix: as a comment or test when tied to specific code, otherwise in `docs/pitfalls.md`; machine-specific ones in Claude's memory. Symptom first (exact error text), then cause and fix. Delete entries once obsolete.
5. Git hooks: husky's `pre-commit` runs `scripts/check-changelog.sh` (fails if `packages/*/src/` or `demo/*/src/` changed outside `__tests__/` without a `CHANGELOG.md` change), `check:docs`, lint-staged (Prettier + ESLint `--fix`), `type-check`, `test`, `build` and `size`. `post-merge`/`post-checkout` run `npm ci` when `package-lock.json` changes. Hooks install via `npm install` (`prepare`). Don't manually rerun checks step 1 already passed.

<!-- check-docs-ignore: AskUserQuestion settings Fixes no-ff -->
