/**
 * The proof that `apps/both/jest.setup.ts` took effect: `fetch` is the fixture server in every test
 * file, with nothing installed here. It is its own file because the fixture server's own tests
 * replace `globalThis.fetch` to check the fall-through to the real one, and this has to observe the
 * untouched global.
 */
import { CLIENT_USER_ID } from './fixtures';

it('has the fixture server on global fetch, with no setup in the test itself', async () => {
  const response = await fetch('https://dummyjson.com/todos/11');

  expect(await response.json()).toMatchObject({ id: 11, userId: CLIENT_USER_ID });
});
