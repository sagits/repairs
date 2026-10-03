/**
 * The API boundary: what DummyJSON is allowed to send us.
 *
 * Zod is already in the build for the new-job form, so using it here costs one line per endpoint and
 * is the difference between a bad response rendering the error state and the app white-screening.
 * These are strict in the sense that matters — no coercion, no defaults — because a `userId` that
 * arrived as a string is a shape change we want to hear about, not quietly paper over.
 */
import { z } from 'zod';

export const TodoSchema = z.object({
  id: z.number(),
  todo: z.string(),
  completed: z.boolean(),
  userId: z.number(),
});

/**
 * Every list endpoint returns this same envelope, and `total` is the dataset's count rather than the
 * page's — which is what makes the Pro's pagination `total`-driven instead of a guess at when to
 * stop. `GET /todos/user/{id}` is unpaged but answers in the same shape, so one schema covers both.
 */
export const TodoListSchema = z.object({
  todos: z.array(TodoSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});

/**
 * A non-2xx from this API is JSON too: `{ "message": "Todo with id '9999' not found" }`. The message
 * is the server's own words, and the not-found screen shows them rather than "Something went wrong",
 * so this schema is what makes the error state honest.
 */
export const ApiErrorSchema = z.object({ message: z.string() });

export type Todo = z.infer<typeof TodoSchema>;
export type TodoList = z.infer<typeof TodoListSchema>;
