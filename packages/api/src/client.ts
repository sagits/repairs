/**
 * The HTTP client. It calls `globalThis.fetch` and nothing else — no injected client, no base-URL
 * option, no fixtures switch. The fixture server is installed **over** `fetch` by whoever starts the
 * process, so this file cannot tell the difference and the fixture runs and the live run exercise the
 * same code rather than two paths that have to be kept in step.
 *
 * It deliberately does not read `EXPO_PUBLIC_API` itself: `babel-preset-expo` rewrites that literal
 * into a read against `expo/virtual/env`, and `expo` is a dependency of `apps/both`, not of
 * `packages/*`, so the injected import cannot resolve from here. `DECISIONS.md` has the long version.
 */
import type { z } from 'zod';
import { ApiErrorSchema, TodoListSchema, type TodoList } from './schemas';

export const API_BASE_URL = 'https://dummyjson.com';

/** How many rows a page of the available list asks for. 254 todos over this is the Pro's 13 pages. */
export const PAGE_SIZE = 20;

/**
 * One error type for both ways a request can fail, so a screen's error state has one shape to render
 * and one `status` to branch on — a 404 is the not-found screen, anything else is the error state.
 *
 * `cause` keeps the `ZodError` when the failure was a malformed response, because that is the detail
 * a developer wants and the one a user must never see.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * The server's own words are what the error state shows, so a non-2xx body is parsed for its
 * `message` before anything is invented. Only when there is no message — a proxy's HTML, an empty
 * body — does the status stand in for one.
 */
const errorFrom = async (response: Response): Promise<ApiError> => {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = ApiErrorSchema.safeParse(body);

  return new ApiError(
    response.status,
    parsed.success ? parsed.data.message : `The server returned an error (${response.status})`,
  );
};

/**
 * Every response passes through a schema before it is returned, which is what turns a third-party
 * shape change into the error state instead of `undefined.todo` three components deep. The Zod error
 * is kept as the `cause` and replaced with a sentence, because the one thing a `ZodError`'s message is
 * not is something to put on a screen.
 */
async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) throw await errorFrom(response);

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError(response.status, 'The server sent a response this app does not understand', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

/**
 * One page of every Job, for the Pro's available list. The envelope is returned whole rather than
 * unwrapped to `.todos`, because `total` is what stops the pagination and unwrapping here would throw
 * it away; `select` reads `.todos` instead.
 */
export const fetchTodoPage = (skip: number): Promise<TodoList> =>
  getJson(`/todos?limit=${PAGE_SIZE}&skip=${skip}`, TodoListSchema);

/**
 * Every Job one Client posted. Unpaged upstream — the Client has six — but it answers in the same
 * envelope as the paged list, so one schema covers both.
 */
export const fetchUserTodos = (userId: number): Promise<TodoList> =>
  getJson(`/todos/user/${userId}`, TodoListSchema);
