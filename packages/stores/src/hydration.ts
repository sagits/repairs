/**
 * "Has this persisted store been read back from storage yet?", for any of them.
 *
 * It matters because storage is asynchronous: for the first frames of a launch a persisted store
 * honestly reports its initial state when what it means is "not yet asked", and rendering on that
 * answer is how a login form flashes at someone already signed in, or a claimed Job shows as open.
 *
 * Hydration is an external event with a snapshot and a subscription, which is precisely what
 * `useSyncExternalStore` is for. `useState` plus an effect would have to re-check for a hydration that
 * finished between the two. The server snapshot is `false` because the static web export has no
 * storage to read at build time.
 */
import { useSyncExternalStore } from 'react';

type Hydratable = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: () => void) => () => void;
  };
};

const notOnTheServer = () => false;

export function createHydrationHook({ persist }: Hydratable) {
  const subscribe = (onHydrated: () => void) => persist.onFinishHydration(onHydrated);
  const read = () => persist.hasHydrated();

  return () => useSyncExternalStore(subscribe, read, notOnTheServer);
}
