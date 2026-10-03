/**
 * The shared domain types, and the two validation boundaries.
 *
 * The types carry no runtime code. `schemas.ts` does — it is the one dependency this package has, on
 * Zod, and it is deliberate: a boundary that is only a TypeScript type is not a boundary at all.
 */
export type { AppRole, Role, User } from './people';
export type { Actor, ClaimRecord, Job, JobStatus, LocalJobs, Scope } from './jobs';
export { LoginSchema, NewJobSchema, type LoginInput, type NewJobInput } from './schemas';
