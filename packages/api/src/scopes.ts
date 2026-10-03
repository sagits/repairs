/**
 * A scope is a predicate on a Job, built by a hook and handed to the overlay. There are two, and
 * nothing else is ever passed in that position — a scope that needed more than a Job to decide would
 * be a filter the server should be doing.
 *
 * They are filters on the overlaid rows rather than on the query, which is the cost `ADR 0002`
 * records: a page of twenty can render fewer than twenty open Jobs. The first thing a real backend
 * fixes is making this unnecessary.
 */
import type { Job, Scope } from '@repairs/types';

/** Posted jobs: every Job this Client posted, whatever its status. */
export const clientScope = (clientId: number): Scope => (job: Job) => job.clientId === clientId;

/**
 * Available jobs: every open Job, from every Client. It reads `status`, which is why it has to run
 * *after* the claims are laid on — a Job the API still calls incomplete may be one a Pro already
 * holds, and that is precisely the row this scope must drop.
 */
export const availableScope = (): Scope => (job: Job) => job.status === 'open';
