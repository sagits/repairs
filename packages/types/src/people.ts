/** Who you can be signed in as. There are two Roles and nothing else is one. */
export type Role = 'client' | 'pro';

/**
 * What each Role is called on screen. One domain fact in one shape: the login form's switch and Settings'
 * "Signed in as" and "Switch to" were spelling these two words out separately, a `Record` in one place and
 * an array of `{ role, label }` in the other, which is the same truth kept twice and in two shapes.
 *
 * It lives beside the type rather than in a screen because it *is* the type, read out loud — `GLOSSARY.md`
 * gives Client and Pro as the domain's own words, so there is no copy to invent. Order matters where this
 * is iterated, and `client` first is the login form's default and its left-hand option.
 */
export const ROLE_LABELS: Record<Role, string> = { client: 'Client', pro: 'Pro' };

/** The two Roles in the order the login form offers them, derived so the two can never disagree. */
export const ROLES = Object.keys(ROLE_LABELS) as Role[];

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
