#!/usr/bin/env bash
#
# `pnpm e2e:test`: the device booted, Metro serving, and Detox driven against both. Why this lives
# in a script rather than in `.detoxrc.js` is in `DECISIONS.md`.
#
# Arguments pass through to `detox test`, which is how a single spec runs on its own:
#   pnpm --filter @repairs/both e2e:test e2e/login.e2e.ts
#
# Two things here exist to keep a run short, because the suite gets run many times per ticket:
#
#   * **Metro is reused when one is already serving on the port.** Only a Metro this script started
#     is killed on the way out, so `pnpm e2e:metro` left running in another terminal survives run
#     after run and every later run skips the cold bundle — the largest single cost in a run. The
#     knob that is *not* worth reaching for is `headless`; `DECISIONS.md` has the measurement that
#     killed it.
#
#   * **`detox test --reuse`**, so the app is not uninstalled and reinstalled every run. That is safe
#     for JS changes, which Metro serves, and unsafe for native ones, which are compiled into the
#     binary. Rather than leave that distinction to whoever remembers it, the script stamps each
#     install and forces a fresh one whenever the built `.app` is newer than the stamp. `E2E_FRESH=1`
#     forces one by hand.
#
set -euo pipefail

# Job control, so a Metro we start leads its own process group and `kill -- -$pid` takes its
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
default_api=fixtures
export EXPO_PUBLIC_API="${EXPO_PUBLIC_API:-$default_api}"

port=8081
status="http://localhost:$port/status"
log=metro.log
binary=ios/build/Build/Products/Debug-iphonesimulator/Repairs.app/Repairs
stamp=ios/build/.detox-installed

metro_serving() {
  curl -sf --max-time 5 "$status" | grep -q 'packager-status:running'
}

# Reusing Metro and inlining `EXPO_PUBLIC_API` at bundle time do not mix: a Metro already serving is
# serving the value it was *started* with, and reusing it for a run that wants a different one would
# hand that run the wrong bundle while reporting success — `live.e2e.ts` passing against the fixtures
# is exactly the failure this guards. So a non-default value never reuses anything, and says so
# rather than quietly starting a second Metro that cannot have the port.
#
# The other half of that bargain is in `package.json`: `e2e:metro` starts the long-lived Metro with
# this same default rather than a bare `expo start`, because a Metro started with the variable *unset*
# would serve a bundle that talks to the real DummyJSON and would be reused here without complaint.
# It needs no `--port`: 8081 is Metro's own default, so the number stays in one place.
if [ "$EXPO_PUBLIC_API" != "$default_api" ] && metro_serving; then
  echo "A Metro is already serving on :$port, and this run wants EXPO_PUBLIC_API=$EXPO_PUBLIC_API." >&2
  echo "That value is baked into the bundle at start, so the running one cannot supply it." >&2
  echo "Stop that Metro and run this again." >&2
  exit 1
fi

# The reuse is deliberately one-sided: an outside Metro is left alone on the way out, and only a
# Metro started here gets a `trap`. Killing someone else's long-lived server would make the very
# thing this is for — starting it once and leaving it — useless.
if metro_serving; then
  echo "Reusing the Metro already serving on :$port."
else
  npx expo start --port "$port" >"$log" 2>&1 &
  metro=$!
  trap 'kill -- -"$metro" 2>/dev/null || true' EXIT

  for _ in $(seq 60); do
    if metro_serving; then
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
fi

# `--reuse` skips Detox's own check that the binary exists, so an absent one would surface as a
# puzzling launch failure rather than as the missing build it is.
if [ ! -e "$binary" ]; then
  echo "No app at $binary. Run \`pnpm e2e:build\` first." >&2
  exit 1
fi

# `--reuse` keeps whatever is already installed, which must not survive a native rebuild: the binary
# carries compiled native code, so a stale install presents as a missing JS export rather than as a
# build problem — the note at the top of `.detoxrc.js` is about exactly this. A `.app` newer than the
# stamp means `pnpm e2e:build` has run since the last install, so this run installs and re-stamps.
#
# `reuse` is one word or the empty string rather than an array, because `/bin/bash` here is 3.2, where
# expanding an *empty* array under `set -u` is an unbound-variable error — which would have aborted
# precisely the fresh-install path this is for. An empty scalar is set, so it expands to nothing, and
# the expansion is deliberately unquoted for that reason.
reuse=--reuse
if [ -n "${E2E_FRESH:-}" ]; then
  reuse=
  echo "E2E_FRESH is set: reinstalling the app."
elif [ ! -e "$stamp" ] || [ "$binary" -nt "$stamp" ]; then
  reuse=
  echo "No install on record for this binary, or it is newer than the last one: installing it."
fi

# shellcheck disable=SC2086 # empty means "no flag"; see above
npx detox test --configuration ios.sim.debug $reuse "$@"

# Only reached when Detox passed, because of `set -e`. A failed run deliberately leaves the stamp
# alone, so the next run installs again rather than reusing an install that may not have completed.
if [ -z "$reuse" ]; then
  touch "$stamp"
fi
