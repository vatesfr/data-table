---
name: perf-review
description: Measure the table's speed and memory — core function costs, adapter recomputes, demo interaction timings, leaks — and report ranked findings, or before/after numbers for a perf change. Use when asked for a performance or memory review, to profile or benchmark a change, or to check a perf fix.
---

# Perf review

Measures, never guesses. Prefer numbers machine load can't move (instructions, bytes, call counts); timings only compare runs taken in one session, on a quiet machine. Background and past findings: [performance](../../../docs/performance.md).

## Machine

- Quiet: other test suites or builds (other sessions, other projects) skew timings and time out unit tests. `uptime`; `perf-browser.mjs` waits for a 1-minute load below 2 and its summaries drop runs above it.
- `perf` for instruction counts (`sudo dnf install perf`); without it `perf-core.mjs` reports bytes only.
- Timing runs: ask the user to set the CPU governor (`! sudo cpupower frequency-set -g performance`), and to restore `powersave` afterwards.

## Measure

- **Core costs** — `node scripts/perf-core.mjs [--rows=200000] [--out=<f>] [--compare=<f>] [case…]`: instructions, bytes allocated and retained per call, each case in a fresh process. Compare only results from this script: other setups (CPU pinning, heap flags) shift absolute numbers. A non-zero `gcDuringCall` undercounts bytes.
- **Speed per call** — `npm run bench -w packages/core` (Vitest bench, 10k–500k rows).
- **Recomputes** — each adapter's `recompute.test.ts` spies on core's `logic.ts` (`vi.mock(..., { spy: true })`) and counts pipeline calls per interaction. A suspected rerun gets a failing count there first.
- **Interactions** — `node scripts/perf-browser.mjs [--runs=6] [--demo=…] [--out=<f>] [--compare=<f>] [--leak]`: production builds of the demos' 200k-row table, Event Timing per step, median [IQR]. 6 runs ≈ 4 min on a quiet machine. `--summary=<f>` re-reads saved runs.
- **Leaks** — `--leak`: heap, DOM nodes and listeners per Filter open/close cycle against a control loop. Heap growth with flat nodes and listeners is usually V8 compiled code: confirm with a heap snapshot diff (CDP `HeapProfiler.takeHeapSnapshot`, unminified build) before calling it a leak.

## Report

- Rank by cost × frequency: per keystroke > per click > once. Thresholds at 200k rows: a keystroke > 50 ms, a click > 100 ms, retained memory well above the dataset's own, any steady growth per leak cycle.
- Each finding: what, where (`file:line`), the numbers and how they were taken.
- Findings left open go in `docs/performance.md`'s "Open findings"; a fix moves its entry to a bullet above it, with before/after numbers, also in its commit body.

## Fix

- One finding per commit: a failing test first (a `recompute.test.ts` count, or a core test), then the fix in every adapter, then before/after with the same script.

<!-- check-docs-ignore: uptime sudo cpupower frequency-set powersave takeHeapSnapshot -->
