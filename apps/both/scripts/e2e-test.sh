#!/usr/bin/env bash
#
# `pnpm e2e:test` from a cold shell: the Debug build loads its JS from Metro, so Metro has to be
# running before Detox launches the app — and a Metro left behind holds port 8081 and breaks the
# next run as badly as not starting one. Started here, waited for, killed on the way out whatever
# happened, including a failing suite.
#
# Any arguments are passed through to `detox test`, which is how a single spec runs on its own:
#   pnpm --filter @repairs/both e2e:test e2e/launch.e2e.ts
#
set -euo pipefail

# Job control, so the background Metro leads its own process group and `kill -- -$pid` takes its
# children with it. Killing the `npx expo start` process alone leaves the real Metro orphaned.
set -m

cd "$(dirname "$0")/.."

log="metro.log"
npx expo start --port 8081 >"$log" 2>&1 &
metro=$!
trap 'kill -- -"$metro" 2>/dev/null || true' EXIT

for _ in $(seq 60); do
  if curl -sf http://localhost:8081/status | grep -q 'packager-status:running'; then
    ready=1
    break
  fi
  sleep 1
done

if [ -z "${ready:-}" ]; then
  echo "Metro did not come up on :8081 within 60s. Its output:" >&2
  cat "$log" >&2
  exit 1
fi

npx detox test --configuration ios.sim.debug "$@"
