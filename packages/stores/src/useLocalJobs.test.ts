/**
 * The Local job store: everything true about Jobs that the upstream API cannot hold. Storage is the
 * in-memory AsyncStorage mock, so the restart test is a real round-trip through the code path the
 * device takes.
 *
 * The guards are tested here rather than at a button because that is where they live. A screen can
 * only hide an action it knows about; the store is what makes claiming an already-claimed Job
 * impossible regardless of which screen, which Role or which race got there.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Job } from '@repairs/types';
import { LOCAL_JOBS_STORAGE_KEY, isLocal, useLocalJobs } from './useLocalJobs';

const CLIENT_ID = 13;
const OTHER_CLIENT_ID = 26;
const PRO_ID = 'pro-1';
const OTHER_PRO_ID = 'pro-2';

const serverJob = (id: string, over: Partial<Job> = {}): Job => ({
  id,
  title: `Server job ${id}`,
  status: 'open',
  clientId: CLIENT_ID,
  ...over,
});

const store = () => useLocalJobs.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
});

it('starts with nothing local, so a first launch is purely what the server said', () => {
  expect(store()).toMatchObject({ created: [], claims: {}, deleted: [] });
});

it('creates a Local job with a local id, the typed title and the posting Client', () => {
  const job = store().createJob({ title: 'Kitchen tap drips constantly' }, CLIENT_ID);

  expect(job).toMatchObject({
    id: 'local-1',
    title: 'Kitchen tap drips constantly',
    status: 'open',
    clientId: CLIENT_ID,
  });
  expect(job.createdAt).toEqual(expect.any(String));
  expect(store().created).toEqual([job]);
});

it('keeps the description a Client typed, which no Server job can have', () => {
  const job = store().createJob({ title: 'Boiler loses pressure', description: 'Reads zero each morning.' }, CLIENT_ID);

  expect(job.description).toBe('Reads zero each morning.');
});

it('puts the newest Local job first, and numbers ids without ever reusing one', () => {
  store().createJob({ title: 'First job posted' }, CLIENT_ID);
  store().createJob({ title: 'Second job posted' }, CLIENT_ID);
  store().cancelJob(store().created[0] as Job, CLIENT_ID);
  store().createJob({ title: 'Third job posted' }, CLIENT_ID);

  expect(store().created.map((job) => job.id)).toEqual(['local-3', 'local-2', 'local-1']);
});

it('tells a Local job from a Server job by its id, so a mutation knows whether to call the API', () => {
  expect(isLocal('local-1')).toBe(true);
  expect(isLocal('7')).toBe(false);
});

it('records a claim as one Pro holding one Job, with a snapshot of the Job itself', () => {
  const job = serverJob('7');

  store().claimJob(job, PRO_ID);

  expect(store().claims['7']).toMatchObject({ proId: PRO_ID, snapshot: job });
  expect(store().claims['7']?.claimedAt).toEqual(expect.any(String));
  expect(store().claims['7']?.completedAt).toBeUndefined();
});

it('rejects a claim on a Job another Pro already holds', () => {
  const job = serverJob('7');
  store().claimJob(job, PRO_ID);

  expect(() => store().claimJob(job, OTHER_PRO_ID)).toThrow('That job is no longer open');
  expect(store().claims['7']?.proId).toBe(PRO_ID);
});

it('rejects a claim on a Job that is already done upstream', () => {
  expect(() => store().claimJob(serverJob('8', { status: 'done' }), PRO_ID)).toThrow('That job is no longer open');
  expect(store().claims['8']).toBeUndefined();
});

it('rejects a claim on a Job the Client has cancelled', () => {
  const job = serverJob('7');
  store().cancelJob(job, CLIENT_ID);

  expect(() => store().claimJob(job, PRO_ID)).toThrow('That job is no longer open');
});

it('records a completion on the claim record rather than removing it', () => {
  const job = serverJob('7');
  store().claimJob(job, PRO_ID);

  store().completeJob('7', PRO_ID);

  expect(store().claims['7']).toMatchObject({ proId: PRO_ID, snapshot: job });
  expect(store().claims['7']?.completedAt).toEqual(expect.any(String));
});

it('rejects a completion by a Pro who does not hold the Job', () => {
  store().claimJob(serverJob('7'), PRO_ID);

  expect(() => store().completeJob('7', OTHER_PRO_ID)).toThrow('Only the Pro holding a job can complete it');
  expect(store().claims['7']?.completedAt).toBeUndefined();
});

it('rejects a completion on a Job nobody has claimed', () => {
  expect(() => store().completeJob('7', PRO_ID)).toThrow('Only the Pro holding a job can complete it');
});

it('rejects completing the same Job twice', () => {
  store().claimJob(serverJob('7'), PRO_ID);
  store().completeJob('7', PRO_ID);
  const completedAt = store().claims['7']?.completedAt;

  expect(() => store().completeJob('7', PRO_ID)).toThrow('That job is already done');
  expect(store().claims['7']?.completedAt).toBe(completedAt);
});

it('cancels an open Job the Client posted', () => {
  store().cancelJob(serverJob('7'), CLIENT_ID);

  expect(store().deleted).toEqual(['7']);
});

it("rejects cancelling a Job another Client posted", () => {
  expect(() => store().cancelJob(serverJob('7', { clientId: OTHER_CLIENT_ID }), CLIENT_ID)).toThrow(
    'You can only cancel a job you posted',
  );
  expect(store().deleted).toEqual([]);
});

it('rejects cancelling a Job a Pro has claimed', () => {
  const job = serverJob('7');
  store().claimJob(job, PRO_ID);

  expect(() => store().cancelJob(job, CLIENT_ID)).toThrow('A job can only be cancelled while it is open');
  expect(store().deleted).toEqual([]);
});

it('rejects cancelling a Job that is already done upstream', () => {
  expect(() => store().cancelJob(serverJob('8', { status: 'done' }), CLIENT_ID)).toThrow(
    'A job can only be cancelled while it is open',
  );
});

it('cancels the same Job twice without recording it twice', () => {
  const job = serverJob('7');
  store().cancelJob(job, CLIENT_ID);
  store().cancelJob(job, CLIENT_ID);

  expect(store().deleted).toEqual(['7']);
});

it('persists and rehydrates its three fields, and nothing else', async () => {
  const created = store().createJob({ title: 'Washing machine will not drain' }, CLIENT_ID);
  store().claimJob(serverJob('7'), PRO_ID);
  store().cancelJob(serverJob('9'), CLIENT_ID);

  const written = (await AsyncStorage.getItem(LOCAL_JOBS_STORAGE_KEY)) ?? '{}';
  expect(Object.keys(JSON.parse(written).state).sort()).toEqual(['claims', 'created', 'deleted']);

  // Emptying the store writes the empty state straight back out — `persist` listens to every `set` —
  // so what was just stored has to be put back before the rehydrate, or the read finds the clearing.
  // The relaunch this stands in for has the same two halves: an initial state, and a storage file.
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
  await AsyncStorage.setItem(LOCAL_JOBS_STORAGE_KEY, written);
  await useLocalJobs.persist.rehydrate();

  expect(store().created).toEqual([created]);
  expect(store().claims['7']?.proId).toBe(PRO_ID);
  expect(store().deleted).toEqual(['9']);
});

it('comes back empty when storage holds nothing, with its actions still callable', async () => {
  await useLocalJobs.persist.rehydrate();

  expect(store()).toMatchObject({ created: [], claims: {}, deleted: [] });
  expect(store().createJob({ title: 'Front door lock sticks shut' }, CLIENT_ID).id).toBe('local-1');
});
