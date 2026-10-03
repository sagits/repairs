/**
 * The todo↔Job mapping. Four fields each way, and the asymmetry between them is the whole story of
 * this app's data layer.
 *
 * Going in: `completed` is a boolean and `JobStatus` has three values, so **claimed cannot come from
 * the API at all**. It lives in the Local job store along with `proId`, `description` and every
 * timestamp, and reaches a Job through the overlay rather than through here.
 *
 * Going out: everything the API has no field for is dropped, including the status when it is
 * `claimed` — the only two things upstream can be told are "not done" and "done". That is not a lossy
 * shortcut to tidy up later; it is the shape of the endpoint. The write goes out anyway because its
 * pending and failure states are real states a screen has to handle.
 */
import type { Job } from '@repairs/types';
import type { Todo } from './schemas';

export const toJob = ({ id, todo, completed, userId }: Todo): Job => ({
  id: String(id),
  title: todo,
  status: completed ? 'done' : 'open',
  clientId: userId,
});

/**
 * The body for `POST /todos/add` and for the `PUT` that records a completion. One function serves
 * both: the extra fields on a `PUT` are the ones the record already holds, so sending them changes
 * nothing, and a second near-identical mapper would only be a second place to forget `completed`.
 */
export const toTodoBody = ({ title, status, clientId }: Job): Omit<Todo, 'id'> => ({
  todo: title,
  completed: status === 'done',
  userId: clientId,
});
