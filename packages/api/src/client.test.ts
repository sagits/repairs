/**
 * The HTTP client, driven against the fixture server that `apps/both/jest.setup.ts` installs over
 * `globalThis.fetch`. Nothing here knows the fixtures exist — that is the point of installing them at
 * the `fetch` seam, and it is why these same functions are what `live.e2e.ts` exercises against the
 * real API.
 *
 * What is being pinned is the boundary's two promises: a good response arrives parsed, and a bad one
 * arrives as an `ApiError` with something a screen can print.
 */
import { CLIENT_USER_ID, FIXTURE_FAILURE_ID, FIXTURE_TODO_COUNT } from '@repairs/testing';
import { API_BASE_URL, ApiError, createTodo, fetchTodoPage, fetchUserTodos } from './client';

it('fetches a page of the available list and returns the parsed envelope, not the array', async () => {
  const page = await fetchTodoPage(0);

  expect(page.total).toBe(FIXTURE_TODO_COUNT);
  expect(page.skip).toBe(0);
  expect(page.todos).toHaveLength(20);
});

it('pages off the skip it is given', async () => {
  const page = await fetchTodoPage(20);

  expect(page.skip).toBe(20);
  expect(page.todos[0]?.id).toBe(21);
});

it("fetches the Client's own list, which is every Job they posted", async () => {
  const list = await fetchUserTodos(CLIENT_USER_ID);

  expect(list.todos).toHaveLength(6);
  expect(list.todos.every((todo) => todo.userId === CLIENT_USER_ID)).toBe(true);
});

/**
 * The create, and the one thing about it worth pinning: **the response is thrown away.** `POST
 * /todos/add` answers `id: 255` every time and does not keep the row, so there is nothing in that
 * response an app could use — the `local-N` id the store minted is the id that survives. The request
 * goes out anyway, because its pending and its failure are states a screen has to handle, and those
 * are only real if there is a real request behind them.
 */
it('posts a create as JSON and returns nothing, because the response carries nothing', async () => {
  const body = { todo: 'Gutter overflows at the corner', completed: false, userId: CLIENT_USER_ID };
  const realFetch = globalThis.fetch;
  let sent: [RequestInfo | URL, RequestInit | undefined] | undefined;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    sent = [input, init];
    return realFetch(input, init);
  }) as typeof fetch;

  try {
    await expect(createTodo(body)).resolves.toBeUndefined();
  } finally {
    globalThis.fetch = realFetch;
  }

  expect(String(sent?.[0])).toBe(`${API_BASE_URL}/todos/add`);
  expect(sent?.[1]?.method).toBe('POST');
  expect(JSON.parse(String(sent?.[1]?.body))).toEqual(body);
});

it("throws the server's own words when a create fails, like every other request does", async () => {
  await expect(
    createTodo({ todo: 'Gutter overflows', completed: false, userId: FIXTURE_FAILURE_ID }),
  ).rejects.toThrow(`Fixture failure seeded for id ${FIXTURE_FAILURE_ID}`);
});

it("throws a typed error carrying the server's own message on a non-2xx", async () => {
  await expect(fetchUserTodos(FIXTURE_FAILURE_ID)).rejects.toThrow(ApiError);
  await expect(fetchUserTodos(FIXTURE_FAILURE_ID)).rejects.toThrow(
    `Fixture failure seeded for id ${FIXTURE_FAILURE_ID}`,
  );
});

it('carries the status alongside the message, so a 404 can be told from a 500', async () => {
  const error = await fetchTodoPage(FIXTURE_FAILURE_ID).catch((thrown: unknown) => thrown);

  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(500);
});

it('rejects a malformed response rather than mapping it, with a message a screen can print', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ todos: [{ id: 1 }], total: 254, skip: 0, limit: 20 }), {
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

  try {
    const error = await fetchTodoPage(0).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('The server sent a response this app does not understand');
  } finally {
    globalThis.fetch = realFetch;
  }
});

it('falls back to the status when a non-2xx body carries no message of its own', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('<html>502</html>', { status: 502 })) as typeof fetch;

  try {
    const error = await fetchTodoPage(0).catch((thrown: unknown) => thrown);

    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).message).toBe('The server returned an error (502)');
  } finally {
    globalThis.fetch = realFetch;
  }
});
