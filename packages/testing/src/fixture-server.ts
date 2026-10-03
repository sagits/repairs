/**
 * The in-memory fixture server: a function shaped exactly like `fetch`, answering the six DummyJSON
 * endpoints the app uses off the fixed dataset in `fixtures.ts`.
 *
 * It is deliberately a `fetch`, not a client. Everything above it — the query hooks, the mapping,
 * the screens — then has no idea whether it is talking to fixtures or to the real API, so the two
 * configurations exercise the same code rather than two code paths that have to be kept in step.
 */
import {
  FIXTURE_TODO_COUNT,
  fixtureTodoById,
  fixtureTodos,
  fixtureTodosForUser,
} from './fixtures';

/**
 * A flat 600ms, never a window, and never shortened.
 *
 * Screens hold their skeleton a minimum of 300ms, and the Detox specs all read "skeleton visible,
 * then wait for the content". At equal timings that assertion is a coin flip; the 300ms of daylight
 * on either side of 600 is what makes it a fact. `ADR 0001` records that a previous build lost real
 * time to a random 600–1200ms delay that raced its own specs, which is why this is a constant.
 */
export const FIXTURE_DELAY_MS = 600;

/**
 * The id the live API hands back from every create, every time, so it carries no information. The
 * app keeps its own `local-N` instead; this is here so the fixtures lie in exactly the same way.
 */
export const FIXTURE_CREATED_ID = 255;

/**
 * The seeded failure case, and the only one: an id that is poison wherever an id can appear — a
 * todo id, a user id, a `skip`, or the `userId` in a create's body. One poisoned value rather than a
 * `failNext()` switch, because it needs no setup call and no mutable state: a Jest test reaches the
 * error path by asking for the id, and a Detox spec reaches it through a launch argument, with
 * nothing having to bridge a function call into the running app.
 */
export const FIXTURE_FAILURE_ID = 9001;

/**
 * A fixed timestamp, because a `Date.now()` in a fixture server is how a suite comes to pass only on
 * a Tuesday. Nothing asserts on the value, only that a delete echoes one back.
 */
const FIXTURE_DELETED_ON = '2026-01-01T00:00:00.000Z';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * A 404 from this API is JSON too, and the message carries the id. The not-found screen shows the
 * server's own words rather than "Something went wrong", so the wording is part of the contract.
 */
const notFound = (id: string) => json({ message: `Todo with id '${id}' not found` }, 404);

const serverError = () =>
  json({ message: `Fixture failure seeded for id ${FIXTURE_FAILURE_ID}` }, 500);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Query strings are read with a regex rather than with `URL`/`URLSearchParams` because this runs
 * inside React Native as well as under Jest, and React Native's `URL` is a partial polyfill rather
 * than the platform's. Two integers off a query string are not worth a dependency or a resolver
 * surprise.
 */
const intParam = (query: string, key: string, fallback: number) => {
  const match = new RegExp(`(?:^|&)${key}=(-?\\d+)`).exec(query);
  return match ? Number(match[1]) : fallback;
};

const parseBody = (init?: RequestInit): Record<string, unknown> =>
  typeof init?.body === 'string' ? JSON.parse(init.body) : {};

export async function fixtureFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = String(input);
  const [path = '', query = ''] = url.split('?');
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = parseBody(init);

  await sleep(FIXTURE_DELAY_MS);

  const seeded = String(FIXTURE_FAILURE_ID);
  if (
    path.split('/').includes(seeded) ||
    intParam(query, 'skip', 0) === FIXTURE_FAILURE_ID ||
    body.userId === FIXTURE_FAILURE_ID
  ) {
    return serverError();
  }

  // POST /todos/add — the create. Its response is shaped like a record and is worth nothing: the id
  // is always 255 and the write is not kept, which is the whole reason the write overlay exists.
  if (method === 'POST' && /\/todos\/add$/.test(path)) {
    return json({ ...body, id: FIXTURE_CREATED_ID });
  }

  // GET /todos/{id}, PUT /todos/{id}, DELETE /todos/{id} — one id, three verbs. `/todos/user/13`
  // cannot reach here: this wants digits directly after `/todos/`.
  const [, recordId = ''] = /\/todos\/(\d+)$/.exec(path) ?? [];
  if (recordId) {
    const todo = fixtureTodoById(Number(recordId));
    if (!todo) return notFound(recordId);
    // Neither write touches `fixtureTodos`. The live API answers a write and forgets it, and the
    // write overlay exists for exactly that reason — a fixture server that remembered would make the
    // overlay look unnecessary here and leave it broken against the real API.
    if (method === 'DELETE') {
      return json({ ...todo, isDeleted: true, deletedOn: FIXTURE_DELETED_ON });
    }
    return method === 'GET' ? json(todo) : json({ ...todo, ...body, id: todo.id });
  }

  // GET /todos/user/{userId} — the Client's own list. The live API returns it unpaged, with `limit`
  // echoing how many came back rather than how many were asked for.
  const [, listUserId = ''] = /\/todos\/user\/(\d+)$/.exec(path) ?? [];
  if (listUserId) {
    const todos = fixtureTodosForUser(Number(listUserId));
    return json({ todos, total: todos.length, skip: 0, limit: todos.length });
  }

  // GET /todos?limit=20&skip=N — the Pro's available list. `total` is the dataset's, not the page's,
  // because that is what stops the pagination.
  if (/\/todos$/.test(path)) {
    const skip = intParam(query, 'skip', 0);
    const limit = intParam(query, 'limit', 30);
    return json({
      todos: fixtureTodos.slice(skip, skip + limit),
      total: FIXTURE_TODO_COUNT,
      skip,
      limit,
    });
  }

  // Loud rather than a polite 404: an unrecognised URL here means the app is calling something the
  // fixtures were never told about, and a 404 would surface as an empty screen instead.
  throw new Error(`No fixture for ${method} ${url}`);
}

/**
 * Replaces `globalThis.fetch` with a wrapper that asks, **on every call**, whether this run is on
 * the fixtures, and routes to the fixture server or to whatever `fetch` was there before. Returns
 * the undo.
 *
 * The per-call question is the load-bearing part. The Jest suite and `live.e2e.ts` share a process
 * with `EXPO_PUBLIC_API` set differently, so an answer captured at module load would pin whichever
 * value happened to be in place when the first import ran. A predicate called per request cannot do
 * that: there is nowhere for the answer to be cached.
 *
 * The predicate is passed in rather than read here, and that is not indirection for its own sake.
 * `babel-preset-expo` rewrites a literal `process.env.EXPO_PUBLIC_API` into a read against
 * `expo/virtual/env`, and `expo` is a dependency of the app, not of `packages/*` — so that injected
 * import cannot resolve from this file, under Jest or under Metro. Reading the flag in the app, where
 * the rewrite works, and handing the answer down keeps the fixture server free of Expo entirely.
 *
 * Nothing in `packages/api` knows this exists: production code calls `fetch` and gets the fixtures
 * or the network depending on how the process was started. That is also why there is no MSW here —
 * in React Native it would be a setup tax for one thing, and the one thing is these six lines.
 */
export function installFixtureFetch(usingFixtures: () => boolean): () => void {
  const networkFetch = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    usingFixtures()
      ? fixtureFetch(input, init)
      : networkFetch(input as RequestInfo, init)) as typeof fetch;

  return () => {
    globalThis.fetch = networkFetch;
  };
}
