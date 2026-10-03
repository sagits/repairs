/**
 * Who you are signed in as. A Role, the person that Role stands for, and the two verbs that change
 * it — and all of it survives a restart, because the Role is persisted to AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Role, User } from '@repairs/types';
import { createHydrationHook } from './hydration';

/**
 * The two hardcoded people. There is no sign up and no credentials: picking a Role *is* signing in,
 * so each Role has exactly one person behind it.
 *
 * The Client's `13` is a real DummyJSON `userId` and is not arbitrary — it is the one id whose todos
 * give the Client list four open jobs and two done ones with nothing seeded. `PRD.md`'s Identity
 * section has the distribution, and says to re-check it before changing this.
 */
export const PEOPLE: Record<Role, User> = {
  client: { role: 'client', id: 13, name: 'Renato Probst', email: 'renatopprobst@gmail.com' },
  pro: { role: 'pro', id: 'pro-1', name: 'Mike Sullivan', email: 'mike.sullivan@example.com' },
};

export const SESSION_STORAGE_KEY = 'repairs-session';

type SessionState = {
  role: Role | null;
  user: User | null;
  signIn: (role: Role) => void;
  signOut: () => void;
};

/**
 * Only the Role is written to storage. `user` is derived from it, and persisting a derived constant
 * buys nothing while costing a stale copy that outlives an edit to `PEOPLE` — so `merge` rebuilds
 * the person from the Role on the way back in, every launch.
 */
type PersistedSession = { role: Role | null };

export const useSession = create<SessionState>()(
  persist<SessionState, [], [], PersistedSession>(
    (set) => ({
      role: null,
      user: null,
      signIn: (role) => set({ role, user: PEOPLE[role] }),
      signOut: () => set({ role: null, user: null }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ role }) => ({ role }),
      merge: (persisted, current) => {
        const role = (persisted as PersistedSession | undefined)?.role ?? null;
        return { ...current, role, user: role ? PEOPLE[role] : null };
      },
    },
  ),
);

/**
 * Whether the persisted Role has been read back yet. Storage is asynchronous, so for the first frames
 * of a launch the store says "signed out" when what it means is "not yet asked" — rendering on that
 * answer is what flashes the Role picker at someone who is already signed in, and `AppProviders` holds
 * the splash on this. `hydration.ts` has the rest of the reasoning; the Local job store needs the same
 * hook for the same reason, which is why it is shared rather than written out twice.
 */
export const useSessionHydrated = createHydrationHook(useSession);
