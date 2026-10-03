/**
 * The fixed dataset the fixture server answers from.
 *
 * It is generated rather than written out, because the shape that matters is statistical — 254
 * todos over 13 pages of 20, with the Client owning six of them — and 254 hand-written literals
 * would bury that in noise. Generated is not the same as arbitrary: every value here is a pure
 * function of the todo's own id, so the dataset is byte-identical on every run, in every process,
 * on every machine. That is the whole point of the fixture server, and a `Math.random()` or a
 * `Date.now()` anywhere in this file would quietly undo it.
 *
 * Two numbers are copied from the live API rather than chosen, so a spec asserting against the
 * fixtures still asserts something true about production:
 *
 * - **254 todos**, which is what `GET /todos` reports as its `total`, and what makes the Pro's
 *   available list exactly 13 pages at `limit=20`.
 * - **The Client's six**, four open and two done. `ADR 0004` explains at length why the Client's
 *   upstream id is `13` and why that is load-bearing; the short version is that `13` is the one
 *   user with enough todos, in the right mix, for every status to render on a cold install. The
 *   fixtures reproduce that mix instead of inventing an easier one, so the Detox suite sees the
 *   same first screen whether it ran against fixtures or against the real API.
 */

/** The Client's upstream user id. Not a placeholder — see `ADR 0004` before touching it. */
export const CLIENT_USER_ID = 13;

/** What `GET /todos` reports as its `total`, matching the live dataset. */
export const FIXTURE_TODO_COUNT = 254;

/**
 * The six todos belonging to the Client, in the live dataset's proportion: the first two are
 * `completed`, so the Client's posted-jobs list opens with four open Jobs and two done ones.
 *
 * The ids are spread across the range on purpose. If the Client's six were `1..6` they would all
 * land on the available list's first page, and a Pro paging past page one would never meet one.
 */
const CLIENT_TODO_IDS = [3, 11, 24, 56, 142, 201];
const CLIENT_COMPLETED_COUNT = 2;

/**
 * Cycled by id to give every todo a title that reads like a repair job. A real sentence matters
 * more than it looks: these strings are what the layout gets checked by eye against `reference/`,
 * and `Todo 184` would make every card the same width and hide every wrapping bug.
 */
const TITLES = [
  'Kitchen tap drips constantly',
  'Replace cracked bathroom tile',
  'Bedroom radiator stays cold',
  'Front door lock sticks shut',
  'Hallway light flickers',
  'Washing machine will not drain',
  'Garden gate hinge has rusted through',
  'Loose floorboard on the landing',
  'Shower pressure has dropped',
  'Window latch will not close',
  'Boiler loses pressure overnight',
  'Extractor fan rattles under load',
];

export type FixtureTodo = {
  id: number;
  todo: string;
  completed: boolean;
  userId: number;
};

/**
 * Every id but the Client's belongs to somebody else, and the live dataset spreads its todos over
 * 149 users. `13` is stepped over rather than skipped in the cycle, so no other user can shadow the
 * Client's list — one stray `userId: 13` here and `GET /todos/user/13` returns seven Jobs, which
 * would look like a bug in the overlay rather than in the fixtures.
 */
const otherUserId = (id: number) => {
  const userId = (id % 149) + 1;
  return userId === CLIENT_USER_ID ? 149 : userId;
};

const todoFor = (id: number): FixtureTodo => {
  const clientIndex = CLIENT_TODO_IDS.indexOf(id);
  const isClients = clientIndex >= 0;
  return {
    id,
    todo: TITLES[id % TITLES.length] as string,
    // Every seventh todo elsewhere is done, which is roughly the live proportion and enough for
    // a done Job to appear on more than one page of the available list.
    completed: isClients ? clientIndex < CLIENT_COMPLETED_COUNT : id % 7 === 0,
    userId: isClients ? CLIENT_USER_ID : otherUserId(id),
  };
};

/** The dataset, ids `1..254`, in id order — which is the order the live API returns them in. */
export const fixtureTodos: readonly FixtureTodo[] = Array.from(
  { length: FIXTURE_TODO_COUNT },
  (_, index) => todoFor(index + 1),
);

export const fixtureTodoById = (id: number): FixtureTodo | undefined =>
  fixtureTodos.find((todo) => todo.id === id);

export const fixtureTodosForUser = (userId: number): readonly FixtureTodo[] =>
  fixtureTodos.filter((todo) => todo.userId === userId);
