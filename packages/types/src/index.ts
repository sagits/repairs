/**
 * The shared domain types, and the two validation boundaries.
 *
 * Almost all of it is types. `schemas.ts` carries runtime code and the one dependency this package has, on
 * Zod, and that is deliberate: a boundary that is only a TypeScript type is not a boundary at all.
 * `ROLE_LABELS` is the other runtime export, and it is here for the same reason — what a Role is called is
 * part of what a Role is, and a screen holding its own copy is how two screens came to disagree about shape.
 */
export type { AppRole, Role, User } from './people';
export { ROLES, ROLE_LABELS } from './people';
export type { Actor, ClaimRecord, Job, JobStatus, LocalJobs, Scope } from './jobs';
export { LoginSchema, NewJobSchema, type LoginInput, type NewJobInput } from './schemas';
