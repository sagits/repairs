/**
 * The Role lock, as context. `AppProviders` is handed it as a prop by the one app file that differs
 * between the three products, and the two screens that have to care read it from here: Settings, deciding
 * whether a Role switcher is a thing this build has at all, and the login form, deciding whether there is
 * a Role to choose or only the one the build is.
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
