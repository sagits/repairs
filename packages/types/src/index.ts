/**
 * The shared domain types. Types only, no runtime code and no dependencies, so every other package
 * can depend on this one without pulling anything in.
 */
export type { AppRole, Role, User } from './people';
