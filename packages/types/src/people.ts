/** Who you can be signed in as. There are two Roles and nothing else is one. */
export type Role = 'client' | 'pro';

/**
 * The person a Role signs you in as. `id` is a `number` for a Client, because it is a real
 * DummyJSON `userId`, and a `string` for a Pro, because Pro identity is ours alone — the API has no
 * notion of one. See `PRD.md`'s Identity section for why Client `13` is load-bearing.
 */
export type User = {
  role: Role;
  id: number | string;
  name: string;
  email: string;
};

/**
 * Which Roles a *build* offers, as opposed to which Role you are signed in as. Repairs is `'both'`
 * and shows the login form's Role switch and a Role switcher; Repairs Client and Repairs Pro are locked to one
 * Role and show neither. It is a build-time constant per app, handed to `AppProviders` rather than
 * persisted — a persisted copy of a constant is only a stale value waiting to outlive a change to it.
 */
export type AppRole = Role | 'both';
