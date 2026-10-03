/**
 * The todo↔Job mapping, both directions. Small enough to read in one go and load-bearing enough that
 * every list, every detail screen and every write passes through it.
 *
 * The one fact worth stating twice: `completed` is a boolean and Job status has three values, so
 * **claimed cannot come from the API at all**. These tests pin that from both sides — nothing the API
 * can send maps to claimed, and a claimed Job maps back to a todo that is not yet done.
 */
import type { Job } from '@repairs/types';
import { toJob, toTodoBody } from './map';

const todo = { id: 7, todo: 'Hallway light flickers', completed: false, userId: 13 };

it('maps an open todo to an open Job, with the id as a string', () => {
  expect(toJob(todo)).toEqual({
    id: '7',
    title: 'Hallway light flickers',
    status: 'open',
    clientId: 13,
  });
});

it('maps a completed todo to a done Job', () => {
  expect(toJob({ ...todo, completed: true }).status).toBe('done');
});

it('gives a Server job no description, because the API has no field for one', () => {
  expect(toJob(todo).description).toBeUndefined();
});

it('gives a Server job no Pro and no timestamps, because the API has no field for those either', () => {
  const job = toJob(todo);

  expect(job.proId).toBeUndefined();
  expect(job.claimedAt).toBeUndefined();
  expect(job.completedAt).toBeUndefined();
  expect(job.createdAt).toBeUndefined();
});

it('never produces a claimed Job, whichever way `completed` falls', () => {
  const statuses = [false, true].map((completed) => toJob({ ...todo, completed }).status);

  expect(statuses).toEqual(['open', 'done']);
  expect(statuses).not.toContain('claimed');
});

it('maps a Job back to a todo body, dropping everything the API cannot hold', () => {
  const job: Job = {
    id: 'local-1',
    title: 'Boiler loses pressure overnight',
    description: 'Every morning it reads zero.',
    status: 'open',
    clientId: 13,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  expect(toTodoBody(job)).toEqual({
    todo: 'Boiler loses pressure overnight',
    completed: false,
    userId: 13,
  });
});

it('sends a claimed Job upstream as not completed, because claimed has nowhere to go', () => {
  const claimed: Job = {
    id: '7',
    title: 'Hallway light flickers',
    status: 'claimed',
    clientId: 13,
    proId: 'pro-1',
  };

  expect(toTodoBody(claimed).completed).toBe(false);
});

it('sends a done Job upstream as completed', () => {
  expect(toTodoBody({ id: '7', title: 'Hallway light flickers', status: 'done', clientId: 13 }).completed).toBe(true);
});

it('round-trips a Server job, which is the only kind the API can represent in full', () => {
  expect(toTodoBody(toJob(todo))).toEqual({ todo: todo.todo, completed: todo.completed, userId: todo.userId });
});
