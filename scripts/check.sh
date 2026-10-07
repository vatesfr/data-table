#!/usr/bin/env sh
# Runs the given npm scripts in order (default: every check), printing one line per step and a
# step's full output only when it fails.
set -u
[ $# -eq 0 ] && set -- check:docs lint type-check test e2e build check:dist-types size
log=$(mktemp)
trap 'rm -f "$log"' EXIT
for step in "$@"; do
  start=$(date +%s)
  if npm run "$step" >"$log" 2>&1; then
    echo "✓ $step ($(($(date +%s) - start))s)"
  else
    echo "✗ $step"
    cat "$log"
    exit 1
  fi
done
