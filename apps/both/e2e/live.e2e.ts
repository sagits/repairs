/**
 * The one spec that talks to the real API, so the fixture server is not the only thing this code has
 * ever been run against. Everything else in the suite runs against `@repairs/testing`'s in-memory
 * server and cannot flake on a third party; this file deliberately can, which is why it is fenced off
 * from the rest in three ways at once.
 *
 * **It only runs when the bundle was built for the real API.** `EXPO_PUBLIC_API` is inlined at bundle
 * time, so whether the app is talking to DummyJSON or to the fixtures is decided by the Metro that
 * served it, not by anything a spec can do — and `scripts/e2e-test.sh` exports the same value into this
 * process, which is what the guard below reads. A default `pnpm e2e:test` therefore reports this file
 * as skipped rather than failing it, and the only way to run it is the way the script's own comment
 * spells out:
 *
 * ```
 * EXPO_PUBLIC_API=live pnpm --filter @repairs/both e2e:test e2e/live.e2e.ts
 * ```
 *
 * The script refuses that run outright while a fixtures Metro is still serving, rather than reusing it
 * and reporting a green live pass against the fixtures. Stop the warm Metro first.
 *
 * **Nothing else in the suite depends on this having run.** It reads; it never writes. It signs in
 * through `repairs:///?reset=1` like every other spec, so it starts from a known state rather than
 * inheriting one, and it leaves the two persisted stores exactly as it found them — empty but for the
 * Role, which the next spec's own reset clears anyway.
 *
 * **An upstream problem must read as an upstream problem.** A third party going down, rate-limiting us
 * or quietly reshaping its dataset would otherwise surface here as "element not visible", which is
 * indistinguishable from a bug in the app and is the reading a tired person will take. So the real API
 * is checked from Node before the app is launched at all, and a failure there names DummyJSON, names
 * what it answered, and says that no other spec is affected. That check is also where the expected
 * titles come from: they are read from the live API over a second, independent connection rather than
 * written into this file, so what is being asserted is "the screen shows what the API served" rather
 * than "the screen shows six strings somebody typed here in October".
 *
 * The *counts* are written down, because those are a claim rather than an observation: `ADR 0004`
 * records that user 13 holds six todos of which two are completed, which is what gives the Client four
 * open Jobs and two done ones with nothing seeded. If the live dataset ever stops matching, the ADR is
 * what has to be re-verified and re-recorded — not this spec adjusted until it passes.
 *
 * Detox's `expect` is imported under another name because Jest's global `expect` is also in scope.
 */
import { by, device, element, expect as expectElement, waitFor } from 'detox';
import { resetToTheLoginForm, signIn } from './sign-in';

/** Sized for the same reason, and against the same measurements, as `login.e2e.ts`'s. */
const VISIBLE_WITHIN = 30_000;

/**
 * The real API's base, deliberately written out here rather than imported from `@repairs/api`. This
 * check exists to answer "is the third party healthy", so it must name the third party itself: reading
 * the constant the app reads would make a base URL someone had pointed elsewhere invisible to the one
 * spec whose whole job is to notice. That the app reaches the same place is asserted by the screen.
 */
const LIVE_API = 'https://dummyjson.com';

/** `ADR 0004` — not a placeholder, and not to be tidied into a rounder number. */
const THE_CLIENT = 13;

/** `ADR 0004`'s recorded counts: six Jobs, two of them done, so four still open. */
const EXPECTED_JOBS = 6;
const EXPECTED_DONE = 2;

/**
 * An id beyond the dataset's 254 rows, so the real API answers its own 404 with a message in it. No list
 * links to such an id, which is why the only way to one is a deep link, and why that test comes last.
 */
const NO_SUCH_JOB_ID = 9999;

/**
 * What a failure here means, said before the detail of it. Every other spec in this suite is insulated
 * from the real API, so a red here is news about DummyJSON until proven otherwise.
 */
const UPSTREAM = [
  '',
  'The real API did not answer the way this spec needs, so this is news about DummyJSON',
  'and not a bug in the app. Every other spec runs against the in-memory fixture server and',
  'is unaffected by this.',
  '',
].join('\n');

type LiveTodo = { id: number; todo: string; completed: boolean };

/** Filled by the check below, and read by the assertions. The live list, over our own connection. */
let liveJobs: LiveTodo[] = [];

/**
 * The real API, read from Node before the app is given a chance to read it from the simulator. Each
 * branch names what was seen, because the point of this is that the reason ends up in the failure
 * message rather than in whoever has to go and find it.
 */
const theRealApiIsHealthy = async () => {
  const url = `${LIVE_API}/todos/user/${THE_CLIENT}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new Error(`${UPSTREAM}GET ${url} could not be reached at all: ${String(cause)}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<no body>');
    throw new Error(
      `${UPSTREAM}GET ${url} answered HTTP ${response.status}, not 200. It said: ${body.slice(0, 300)}`,
    );
  }

  const body: unknown = await response.json().catch(() => undefined);
  const todos = (body as { todos?: LiveTodo[] } | undefined)?.todos;

  if (!Array.isArray(todos) || todos.some((todo) => typeof todo?.todo !== 'string')) {
    throw new Error(
      `${UPSTREAM}GET ${url} answered 200 with a shape this app does not understand. ` +
        `It expects \`{ todos: [{ id, todo, completed, userId }], total }\` and got: ` +
        `${JSON.stringify(body).slice(0, 300)}`,
    );
  }

  const done = todos.filter((todo) => todo.completed).length;
  if (todos.length !== EXPECTED_JOBS || done !== EXPECTED_DONE) {
    throw new Error(
      `${UPSTREAM}GET ${url} answered ${todos.length} todos of which ${done} are completed. ` +
        `ADR 0004 records ${EXPECTED_JOBS} and ${EXPECTED_DONE}, and the Client's first screen is ` +
        `built on that. The dataset has moved: re-verify ADR 0004 against the live API and record ` +
        `what the new numbers are before touching this spec.`,
    );
  }

  liveJobs = todos;

  await theRealApiStillAnswers404s();
};

/**
 * The other half of the check, because the other half of the spec is about a real **error** body. A 404
 * with a `message` in it is what `ApiError`'s `status` is read off and what sends the detail screen to its
 * not-found state rather than to its error card; an upstream that started answering 200-with-null, or an
 * HTML page from a proxy in front of it, would turn that into a failed matcher with nothing to explain it.
 */
const theRealApiStillAnswers404s = async () => {
  const url = `${LIVE_API}/todos/${NO_SUCH_JOB_ID}`;
  const response = await fetch(url).catch((cause: unknown) => {
    throw new Error(`${UPSTREAM}GET ${url} could not be reached at all: ${String(cause)}`);
  });

  const body: unknown = await response.json().catch(() => undefined);
  const message = (body as { message?: unknown } | undefined)?.message;

  if (response.status !== 404 || typeof message !== 'string') {
    throw new Error(
      `${UPSTREAM}GET ${url} answered HTTP ${response.status} with ` +
        `${JSON.stringify(body).slice(0, 300)}. This spec needs a 404 carrying a \`message\`, which is ` +
        `what the detail screen's not-found state is built on. The upstream error shape has changed.`,
    );
  }
};

const waitForVisible = (testID: string) =>
  waitFor(element(by.id(testID))).toBeVisible().withTimeout(VISIBLE_WITHIN);

/** The reset every spec opens with, and then this one's Role. */
const signInAsTheClient = async () => {
  await resetToTheLoginForm(waitForVisible);
  await signIn('client');
  await waitForVisible('post-job');
};

/**
 * A row is waited on for **existence**, not for visibility: six cards do not fit on one screen, and the
 * last of them being below the fold is not a failure. `DECISIONS.md` has the longer version of this,
 * from the claimed-jobs groups. The title and the status pill are then read off that row by
 * `withAncestor`, so each assertion is about the Job it names rather than about whichever element Detox
 * matched first.
 */
const row = (jobId: number) => element(by.id(`posted-job-${jobId}`));

const titleOf = (jobId: number) =>
  element(by.id('posted-job-title').withAncestor(by.id(`posted-job-${jobId}`)));

const statusOf = (jobId: number, status: string) =>
  element(by.text(status).withAncestor(by.id(`posted-job-${jobId}`)));

/**
 * `describe.skip` rather than an early return, so a default run says "skipped" in the reporter instead
 * of quietly reporting a pass for a spec that did nothing. The reason is in the name, because that is
 * the one string the reporter prints.
 *
 * **The alias is load-bearing, and `process.env.EXPO_PUBLIC_API` here is not the same thing.** These
 * specs are compiled by the app's `babel.config.js`, and `babel-preset-expo`'s `inline-env-vars`
 * rewrites any `process.env.EXPO_PUBLIC_*` *member expression* into a read against `expo/virtual/env`
 * and injects that import. That module is ESM inside `node_modules`, which the Detox Jest project does
 * not transform, so the literal spelling fails the **whole file** at parse time with
 * `Unexpected token 'export'` reported against line 2 of this comment — which is about as misleading as
 * a build error gets. This file runs in Node, not in the bundle: the variable it wants is the real one
 * `scripts/e2e-test.sh` exported, not a build-time constant.
 *
 * `const { EXPO_PUBLIC_API } = process.env` does **not** avoid it, which was the first fix and was
 * wrong: Babel's own destructuring transform rewrites the pattern into exactly the member expression
 * the env plugin is looking for, in the same traversal, and the injected import comes back. Reading
 * through a binding is what works, because then the member expression's object is a plain identifier
 * and the plugin's `process.env` test does not match it. Any future spec wanting an `EXPO_PUBLIC_*`
 * value needs the same two lines.
 */
const nodeEnv = process.env;
const itIsALiveBuild = nodeEnv.EXPO_PUBLIC_API === 'live';
const describeLive = itIsALiveBuild ? describe : describe.skip;

describeLive(
  itIsALiveBuild ? 'the real API' : 'the real API (skipped: this bundle is not EXPO_PUBLIC_API=live)',
  () => {
    beforeAll(theRealApiIsHealthy);

    /**
     * The Client's posted jobs, straight off `GET /todos/user/13` with no fixture anywhere in the path:
     * the real `fetch`, the real envelope, `TodoListSchema` against a body nobody here wrote, and `toJob`
     * turning `completed` into a status. The titles are the live API's own, compared against what this
     * process read over a separate connection, so the assertion is that the screen renders what the
     * server served.
     */
    it('shows the Client their six posted Jobs, as the real API serves them', async () => {
      await signInAsTheClient();

      // `!` because the check in `beforeAll` has already refused to let the spec reach here on fewer
      // than six, which `noUncheckedIndexedAccess` has no way of knowing.
      await waitFor(row(liveJobs[0]!.id)).toExist().withTimeout(VISIBLE_WITHIN);

      for (const todo of liveJobs) {
        await expectElement(row(todo.id)).toExist();
        await expectElement(titleOf(todo.id)).toHaveText(todo.todo);
        await expectElement(statusOf(todo.id, todo.completed ? 'Done' : 'Open')).toExist();
      }
    });

    /**
     * The second live endpoint, and the only one that answers a bare record rather than the envelope:
     * the detail screen has its own query key and its own `GET /todos/{id}`, so opening a row is a fresh
     * request against `TodoSchema` rather than a read of the list it came from.
     *
     * The sentence in place of a description is the part worth seeing against the real thing. A todo is
     * one string upstream, so there is nothing to describe a Job with — and that is a fact about the
     * API, not about the fixtures, which is exactly the sort of claim this spec exists to hold.
     */
    it('opens one of them, which is a second request and a second shape', async () => {
      // `!` for the same reason as above: four of the six are open, and the check in `beforeAll` is
      // what has already guaranteed it.
      const job = liveJobs.find((todo) => !todo.completed)!;

      await row(job.id).tap();
      await waitForVisible('job-title');

      await expectElement(element(by.id('job-title'))).toHaveText(job.todo);
      await expectElement(element(by.text('Open'))).toBeVisible();
      await expectElement(element(by.text('Posted by you'))).toBeVisible();
      await expectElement(element(by.text('No description provided.'))).toBeVisible();
    });

    /**
     * The real error body, which is the one thing a fixture can only imitate. An id past the dataset's 254
     * rows gets DummyJSON's own 404 with a `message` in it, `ApiError` carries the status through, and the
     * detail screen answers with its not-found state rather than with the error card and a Retry — because
     * those are different news, and the negative assertion is the point of the test.
     *
     * **Last in the file, deliberately.** The deep link pushes a route the Back button has nothing to pop
     * to, so anything after it would start somewhere unknown.
     */
    it('gives an id the real API does not have its own screen, not the error state', async () => {
      await device.openURL({ url: `repairs:///job/${NO_SUCH_JOB_ID}` });

      await waitForVisible('job-not-found');
      await expectElement(element(by.id('job-error'))).not.toExist();
      await expectElement(element(by.id('job-title'))).not.toExist();
    });
  },
);
