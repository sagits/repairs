#!/usr/bin/env bash
#
# `pnpm e2e:test`: Metro started, waited for, and killed on the way out. Why it lives in a script
# rather than in `.detoxrc.js` is in `DECISIONS.md`.
#
# Arguments pass through to `detox test`, which is how a single spec runs on its own:
#   pnpm --filter @repairs/both e2e:test e2e/launch.e2e.ts
#
set -euo pipefail

# Job control, so the background Metro leads its own process group and `kill -- -$pid` takes its
# children with it. Killing the `npx expo start` process alone leaves the real Metro orphaned.
set -m

cd "$(dirname "$0")/.."

# Boot the target device before Detox gets to it. Detox would boot it anyway, but its `boot()`
# returns early on an already-booted device, which skips the `open -a Simulator` this machine has
# no app for — and leaves the device on screen in DeviceHub from the first frame rather than
# halfway through the run. The name is read from `.detoxrc.js` so it lives in one place.
# `simctl boot` errors when the device is already booted, which is the usual case.
xcrun simctl boot "$(node -p "require('./.detoxrc.js').devices.simulator.device.name")" 2>/dev/null || true

# The suite runs against the in-memory fixture server, so it cannot flake on the public API or on
# whatever DummyJSON happens to be serving today. It is exported rather than written into an `.env`
# because `live.e2e.ts` is the one spec that wants the real thing, and it gets it by starting this
# script with the variable already set:
#
#   EXPO_PUBLIC_API=live pnpm e2e:test e2e/live.e2e.ts
#
# One run means one Metro and so one bundle, and `EXPO_PUBLIC_*` is inlined at bundle time — which is
# why a spec cannot change this per test, and why the fixtures take their instructions from a deep
# link instead. `apps/both/fixtures.ts` has that mechanism.
export EXPO_PUBLIC_API="${EXPO_PUBLIC_API:-fixtures}"

port=8081
log=metro.log

npx expo start --port "$port" >"$log" 2>&1 &
metro=$!
trap 'kill -- -"$metro" 2>/dev/null || true' EXIT

for _ in $(seq 60); do
  if curl -sf --max-time 5 "http://localhost:$port/status" | grep -q 'packager-status:running'; then
    ready=1
    break
  fi
  kill -0 "$metro" 2>/dev/null || break
  sleep 1
done

if [ -z "${ready:-}" ]; then
  echo "Metro never answered on :$port. Its output:" >&2
  cat "$log" >&2
  exit 1
fi

npx detox test --configuration ios.sim.debug "$@"
