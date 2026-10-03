/**
 * The Role lock, as context. `AppProviders` is handed it as a prop by the one app file that differs
 * between the three products, and everything that has to care reads it from here — which today is
 * Settings, deciding whether a Role switcher is a thing this build has at all.
 *
 * The default is `'both'`, so a component rendered outside the provider behaves as the shared app.
 * That is the right default rather than a convenience: `apps/both` is the build that does not need
 * to say anything, and a missing provider should not silently hide a feature the build has.
 */
import { createContext, useContext } from 'react';
import type { AppRole } from '@repairs/types';

const AppRoleContext = createContext<AppRole>('both');

export const AppRoleProvider = AppRoleContext.Provider;

export const useAppRole = () => useContext(AppRoleContext);
