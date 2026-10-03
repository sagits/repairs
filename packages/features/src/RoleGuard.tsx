/**
 * The guard in front of a route only one Role can reach. The route still exists for both Roles —
 * guarded, not deleted — because a deep link, a restored navigation state or a Role switched out from
 * under a mounted screen all arrive at it regardless, and the alternative to a redirect is a crash.
 *
 * Home is `/` for every Role, which is why one component covers every such route: `/` is the tab both
 * Roles have, and the tabs' own gate turns a `/` with nobody signed in into the login form.
 */
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { useSession } from '@repairs/stores';
import type { Role } from '@repairs/types';

export function RoleGuard({ allow, children }: { allow: Role; children: ReactNode }) {
  const role = useSession((session) => session.role);

  if (role !== allow) return <Redirect href="/" />;

  return <>{children}</>;
}
