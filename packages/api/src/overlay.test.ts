/**
 * The overlay — the single hardest piece of logic in the app, and the reason this ticket is written
 * before any screen. `ADR 0002` is the argument for it; this is the proof.
 *
 * Read the two shapes it works on as the two kinds of query: a flat list for `useQuery`, and pages for
 * `useInfiniteQuery`. The paging test near the bottom is the one that matters most — it is the bug
 * that a single `applyOverlay` mapped over `data.pages` would ship, and it only shows on page three.
 */
import type { Job, LocalJobs } from '@repairs/types';
import { applyOverlay, applyOverlayToPages, prepareRows } from './overlay';
import { availableScope, clientScope } from './scopes';

const CLIENT_ID = 13;
const OTHER_CLIENT_ID = 26;

const noLocalJobs: LocalJobs = { created: [], claims: {}, deleted: [] };

const serverJob = (id: string, over: Partial<Job> = {}): Job => ({
  id,
  title: `Server job ${id}`,
  status: 'open',
  clientId: CLIENT_ID,
  ...over,
});

const localJob = (id: string, over: Partial<Job> = {}): Job => ({
  id,
  title: `Local job ${id}`,
  status: 'open',
  clientId: CLIENT_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const claimOf = (job: Job, over: Partial<LocalJobs['claims'][string]> = {}) => ({
  proId: 'pro-1',
  claimedAt: '2026-02-01T00:00:00.000Z',
  snapshot: job,
  ...over,
});

const ids = (jobs: readonly Job[]) => jobs.map((job) => job.id);

it('leaves a page of Server jobs alone when there is nothing local to lay over it', () => {
  const page = [serverJob('1'), serverJob('2')];

  expect(prepareRows(page, noLocalJobs, clientScope(CLIENT_ID))).toEqual(page);
});

it('prepends Local jobs to a flat list, so the one just posted is the first thing seen', () => {
  const local = { ...noLocalJobs, created: [localJob('local-1')] };

  expect(ids(applyOverlay([serverJob('1')], local, clientScope(CLIENT_ID)))).toEqual(['local-1', '1']);
});

it('turns a claimed Job claimed, and names the Pro holding it', () => {
  const job = serverJob('7');
  const local = { ...noLocalJobs, claims: { '7': claimOf(job) } };

  expect(applyOverlay([job], local, clientScope(CLIENT_ID))[0]).toMatchObject({
    id: '7',
    status: 'claimed',
    proId: 'pro-1',
    claimedAt: '2026-02-01T00:00:00.000Z',
  });
});

it('reads done off the same claim record, because a completion ends the hold without removing it', () => {
  const job = serverJob('7');
  const local = {
    ...noLocalJobs,
    claims: { '7': claimOf(job, { completedAt: '2026-03-01T00:00:00.000Z' }) },
  };

  expect(applyOverlay([job], local, clientScope(CLIENT_ID))[0]).toMatchObject({
    status: 'done',
    proId: 'pro-1',
    completedAt: '2026-03-01T00:00:00.000Z',
  });
});

it('drops a cancelled Job, which is gone from every list for good', () => {
  const local = { ...noLocalJobs, deleted: ['1'] };

  expect(ids(applyOverlay([serverJob('1'), serverJob('2')], local, clientScope(CLIENT_ID)))).toEqual(['2']);
});

it('drops a cancelled Local job too, by the same id', () => {
  const local = { ...noLocalJobs, created: [localJob('local-1')], deleted: ['local-1'] };

  expect(applyOverlay([], local, clientScope(CLIENT_ID))).toEqual([]);
});

it("the Client scope keeps only the Jobs that Client posted, whatever their status", () => {
  const job = serverJob('7');
  const local = { ...noLocalJobs, claims: { '7': claimOf(job, { completedAt: '2026-03-01T00:00:00.000Z' }) } };
  const page = [job, serverJob('8', { clientId: OTHER_CLIENT_ID }), serverJob('9')];

  expect(ids(applyOverlay(page, local, clientScope(CLIENT_ID)))).toEqual(['7', '9']);
});

it('the available scope drops claimed and done, leaving only what a Pro can claim', () => {
  const claimed = serverJob('7');
  const local = { ...noLocalJobs, claims: { '7': claimOf(claimed) } };
  const page = [claimed, serverJob('8', { status: 'done' }), serverJob('9', { clientId: OTHER_CLIENT_ID })];

  expect(ids(applyOverlay(page, local, availableScope()))).toEqual(['9']);
});

it("carries a Client's new Local job through to the available list, which is the path that matters", () => {
  const local = { ...noLocalJobs, created: [localJob('local-1')] };

  expect(ids(applyOverlay([], local, availableScope()))).toEqual(['local-1']);
});

it('claims a Local job exactly as it claims a Server job, and so drops it from available', () => {
  const created = localJob('local-1');
  const local = { ...noLocalJobs, created: [created], claims: { 'local-1': claimOf(created) } };

  expect(applyOverlay([], local, clientScope(CLIENT_ID))[0]).toMatchObject({
    id: 'local-1',
    status: 'claimed',
    proId: 'pro-1',
  });
  expect(applyOverlay([], local, availableScope())).toEqual([]);
});

it('keeps the description on a Local job through a claim, since nothing upstream can overwrite it', () => {
  const created = localJob('local-1', { description: 'Every morning it reads zero.' });
  const local = { ...noLocalJobs, created: [created], claims: { 'local-1': claimOf(created) } };

  expect(applyOverlay([], local, clientScope(CLIENT_ID))[0]?.description).toBe('Every morning it reads zero.');
});

it('a Local job appears exactly once across three loaded pages', () => {
  const local = { ...noLocalJobs, created: [localJob('local-1')] };
  const pages = [
    [serverJob('1'), serverJob('2')],
    [serverJob('3'), serverJob('4')],
    [serverJob('5'), serverJob('6')],
  ];

  const rows = applyOverlayToPages(pages, local, availableScope());

  expect(ids(rows).filter((id) => id === 'local-1')).toEqual(['local-1']);
  expect(ids(rows)).toEqual(['local-1', '1', '2', '3', '4', '5', '6']);
});

it('applies claims and cancellations per page, because both are keyed by Job id', () => {
  const claimed = serverJob('3');
  const local = { ...noLocalJobs, claims: { '3': claimOf(claimed) }, deleted: ['5'] };
  const pages = [[serverJob('1')], [claimed, serverJob('4')], [serverJob('5'), serverJob('6')]];

  expect(ids(applyOverlayToPages(pages, local, availableScope()))).toEqual(['1', '4', '6']);
});

it('returns an empty list from no pages at all, rather than throwing', () => {
  expect(applyOverlayToPages([], noLocalJobs, availableScope())).toEqual([]);
});

it('never mutates what it was handed, because that would be the query cache', () => {
  const job = serverJob('7');
  const page = [job];
  const local = { ...noLocalJobs, created: [localJob('local-1')], claims: { '7': claimOf(job) } };

  applyOverlay(page, local, clientScope(CLIENT_ID));
  applyOverlayToPages([page], local, availableScope());

  expect(page).toEqual([serverJob('7')]);
  expect(job).toEqual(serverJob('7'));
  expect(local.created).toEqual([localJob('local-1')]);
});
