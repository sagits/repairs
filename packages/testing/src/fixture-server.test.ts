/**
 * The fixture server is driven directly here, through the one interface anything else will use it
 * by: a call shaped like `fetch`. Nothing in these tests goes near a screen or a query hook — the
 * point of this seam is that the network is deterministic before anything is layered on top of it.
 */
import { CLIENT_USER_ID } from './fixtures';
import {
  FIXTURE_DELAY_MS,
  FIXTURE_FAILURE_ID,
  fixtureFetch,
  installFixtureFetch,
} from './fixture-server';

const call = async (method: string, path: string, body?: unknown) => {
  const response = await fixtureFetch(`https://dummyjson.com${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return { response, body: await response.json() };
};

const get = (path: string) => call('GET', path);

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

it('answers the paged available list with the envelope every list endpoint shares', async () => {
  const { response, body } = await get('/todos?limit=20&skip=0');

  expect(response.ok).toBe(true);
  expect(body).toMatchObject({ total: 254, skip: 0, limit: 20 });
  expect(body.todos).toHaveLength(20);
  expect(body.todos[0]).toEqual({
    id: expect.any(Number),
    todo: expect.any(String),
    completed: expect.any(Boolean),
    userId: expect.any(Number),
  });
});

it('pages the available list off the total, down to a short last page', async () => {
  const second = await get('/todos?limit=20&skip=20');
  expect(second.body.skip).toBe(20);
  expect(second.body.todos[0].id).toBe(21);

  // 254 over pages of 20 is 13 pages, the last one holding 14.
  const last = await get('/todos?limit=20&skip=240');
  expect(last.body.todos).toHaveLength(14);
  expect(last.body.todos[13].id).toBe(254);
});

it("answers the Client's own list in the same envelope, four open and two done", async () => {
  const { response, body } = await get(`/todos/user/${CLIENT_USER_ID}`);

  expect(response.ok).toBe(true);
  expect(body).toMatchObject({ total: 6, skip: 0, limit: 6 });
  expect(body.todos.map((todo: { userId: number }) => todo.userId)).toEqual(
    Array(6).fill(CLIENT_USER_ID),
  );
  // ADR 0004: this mix is the reason the Client's id is 13, so it is asserted, not assumed.
  expect(body.todos.filter((todo: { completed: boolean }) => todo.completed)).toHaveLength(2);
});

it('answers an empty list for a user with no todos, rather than a 404', async () => {
  // 777 is outside the dataset's 149 users. The empty list is a screen state in its own right, so
  // it has to be reachable without seeding anything.
  const { response, body } = await get('/todos/user/777');

  expect(response.ok).toBe(true);
  expect(body).toMatchObject({ todos: [], total: 0, skip: 0, limit: 0 });
});

it('answers one todo by id', async () => {
  const { response, body } = await get('/todos/11');

  expect(response.ok).toBe(true);
  expect(body).toMatchObject({ id: 11, userId: CLIENT_USER_ID, completed: true });
  expect(typeof body.todo).toBe('string');
});

it("404s an unknown id with the live API's own message shape", async () => {
  const { response, body } = await get('/todos/9999');

  expect(response.status).toBe(404);
  expect(body).toEqual({ message: "Todo with id '9999' not found" });
});

it('answers a create with id 255, whatever was posted', async () => {
  const { response, body } = await call('POST', '/todos/add', {
    todo: 'Rehang the shed door',
    completed: false,
    userId: CLIENT_USER_ID,
  });

  expect(response.ok).toBe(true);
  expect(body).toEqual({
    id: 255,
    todo: 'Rehang the shed door',
    completed: false,
    userId: CLIENT_USER_ID,
  });
});

it('echoes an update back with the change applied', async () => {
  // 24 is one of the Client's open Jobs, so completing it is a real change rather than a no-op.
  const { response, body } = await call('PUT', '/todos/24', { completed: true });

  expect(response.ok).toBe(true);
  expect(body).toEqual({
    id: 24,
    todo: expect.any(String),
    completed: true,
    userId: CLIENT_USER_ID,
  });
});

it('answers a delete with the record and isDeleted', async () => {
  const { response, body } = await call('DELETE', '/todos/56');

  expect(response.ok).toBe(true);
  expect(body).toMatchObject({ id: 56, isDeleted: true });
  expect(typeof body.deletedOn).toBe('string');
});

it('does not persist any of the three writes, exactly as the live API does not', async () => {
  // This is the one behaviour the fixtures must not improve on. The whole write overlay exists
  // because DummyJSON answers a write and forgets it; a fixture server that remembered would make
  // the overlay's tests pass for the wrong reason and the real app fail.
  await call('POST', '/todos/add', { todo: 'Rehang the shed door', completed: false, userId: 13 });
  await call('PUT', '/todos/24', { completed: true });
  await call('DELETE', '/todos/56');

  const { body } = await get(`/todos/user/${CLIENT_USER_ID}`);
  expect(body.total).toBe(6);
  expect(body.todos.find((todo: { id: number }) => todo.id === 24).completed).toBe(false);
  expect(body.todos.some((todo: { id: number }) => todo.id === 56)).toBe(true);
});

describe('the delay', () => {
  afterEach(() => jest.useRealTimers());

  it('is a flat 600ms, identical on every endpoint', async () => {
    // Asserted on fake timers rather than by measuring a real one: the claim is that the delay is a
    // constant, and "it took roughly 600ms" is the weaker claim that a window would also satisfy.
    jest.useFakeTimers();

    const settled: string[] = [];
    const list = fixtureFetch('https://dummyjson.com/todos?limit=20&skip=0').then(() =>
      settled.push('list'),
    );
    const detail = fixtureFetch('https://dummyjson.com/todos/11').then(() => settled.push('detail'));

    await jest.advanceTimersByTimeAsync(FIXTURE_DELAY_MS - 1);
    expect(settled).toEqual([]);

    await jest.advanceTimersByTimeAsync(1);
    await Promise.all([list, detail]);
    expect(settled).toEqual(['list', 'detail']);
  });

  it('leaves 300ms of daylight either side of the skeleton minimum', () => {
    // ADR 0001: the Detox specs assert "skeleton visible, then wait for the content". 600 against
    // the skeleton's 300ms minimum is what makes that a fact rather than a coin flip.
    expect(FIXTURE_DELAY_MS).toBe(600);
  });
});

describe('the seeded failure', () => {
  // One poisoned id, honoured wherever an id appears, is the whole mechanism. It needs no setup
  // call and no mutable state, which is what lets a Detox spec reach the error state through a
  // launch argument and a Jest test reach it by asking for the id.
  it('fails the detail endpoint', async () => {
    const { response, body } = await get(`/todos/${FIXTURE_FAILURE_ID}`);
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
    expect(body.message).toEqual(expect.any(String));
  });

  it("fails a Client's list", async () => {
    const { response } = await get(`/todos/user/${FIXTURE_FAILURE_ID}`);
    expect(response.status).toBe(500);
  });

  it('fails a page of the available list', async () => {
    const { response } = await get(`/todos?limit=20&skip=${FIXTURE_FAILURE_ID}`);
    expect(response.status).toBe(500);
  });

  it('fails all three writes', async () => {
    const created = await call('POST', '/todos/add', {
      todo: 'Rehang the shed door',
      completed: false,
      userId: FIXTURE_FAILURE_ID,
    });
    expect(created.response.status).toBe(500);
    expect((await call('PUT', `/todos/${FIXTURE_FAILURE_ID}`, { completed: true })).response.status).toBe(500);
    expect((await call('DELETE', `/todos/${FIXTURE_FAILURE_ID}`)).response.status).toBe(500);
  });

  it('leaves every other id answering normally', async () => {
    expect((await get('/todos/11')).response.ok).toBe(true);
  });
});

describe('installFixtureFetch', () => {
  const realFetch = jest.fn(async () => json({ from: 'the real network' }));
  let onFixtures: boolean;
  let restore: () => void;

  beforeEach(() => {
    realFetch.mockClear();
    globalThis.fetch = realFetch as unknown as typeof fetch;
    restore = installFixtureFetch(() => onFixtures);
  });

  afterEach(() => restore());

  it('answers from the fixtures when the flag says so', async () => {
    onFixtures = true;

    const body = await (await fetch('https://dummyjson.com/todos/11')).json();

    expect(body).toMatchObject({ id: 11 });
    expect(realFetch).not.toHaveBeenCalled();
  });

  it('falls through to the real fetch when it does not', async () => {
    onFixtures = false;

    const body = await (await fetch('https://dummyjson.com/todos/11')).json();

    expect(body).toEqual({ from: 'the real network' });
    expect(realFetch).toHaveBeenCalledTimes(1);
  });

  it('asks per call, so a test can flip the flag mid-run', async () => {
    // The whole point: the answer is never cached. One process runs the Jest suite on the fixtures
    // and `live.e2e.ts` against the real API, and a value captured at module load or at install
    // time would pin whichever was set first.
    onFixtures = true;
    expect(await (await fetch('https://dummyjson.com/todos/11')).json()).toMatchObject({ id: 11 });

    onFixtures = false;
    expect(await (await fetch('https://dummyjson.com/todos/11')).json()).toEqual({
      from: 'the real network',
    });

    onFixtures = true;
    expect(await (await fetch('https://dummyjson.com/todos/11')).json()).toMatchObject({ id: 11 });

    expect(realFetch).toHaveBeenCalledTimes(1);
  });

  it('puts the original fetch back when restored', () => {
    restore();
    expect(globalThis.fetch).toBe(realFetch);
  });
});
