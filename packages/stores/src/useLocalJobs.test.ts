/**
 * The local job store is tested here for one property only: its lifetime. It outlives a Role switch
 * and a log out, and the single thing that empties it is its own `clear`. Everything else about it —
 * what a created Job looks like, what a claim records, how the overlay reads it — belongs to the
 * data-layer ticket and is tested there.
 *
 * Storage is the in-memory AsyncStorage mock, so a rehydrate here is a real round-trip through the
 * same code path the device takes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_JOBS_STORAGE_KEY, useLocalJobs } from './useLocalJobs';
import { useSession } from './useSession';

const aPostedJob = { id: 'local-1', title: 'Leaking tap' };

beforeEach(async () => {
  await AsyncStorage.clear();
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
  useSession.setState({ role: null, user: null });
});

it('survives a Role switch, so a job posted as a Client is there for the Pro', async () => {
  useSession.getState().signIn('client');
  useLocalJobs.setState({ created: [aPostedJob] });

  useSession.getState().signIn('pro');

  expect(useLocalJobs.getState().created).toEqual([aPostedJob]);
});

it('survives a log out and comes back off storage, so logging back in reaches the same jobs', async () => {
  useSession.getState().signIn('client');
  useLocalJobs.setState({ created: [aPostedJob], deleted: ['7'] });
  await useLocalJobs.persist.rehydrate();

  useSession.getState().signOut();
  await useLocalJobs.persist.rehydrate();

  expect(useLocalJobs.getState().created).toEqual([aPostedJob]);
  expect(useLocalJobs.getState().deleted).toEqual(['7']);
});

it('is emptied by its own clear, and stays empty across a restart', async () => {
  useLocalJobs.setState({ created: [aPostedJob], claims: { 'local-1': { proId: 'pro-1' } }, deleted: ['7'] });

  useLocalJobs.getState().clear();
  await useLocalJobs.persist.rehydrate();

  expect(useLocalJobs.getState()).toMatchObject({ created: [], claims: {}, deleted: [] });
});

it('leaves the session alone when it is cleared, because the two have nothing to do with each other', () => {
  useSession.getState().signIn('pro');
  useLocalJobs.setState({ created: [aPostedJob] });

  useLocalJobs.getState().clear();

  expect(useSession.getState().role).toBe('pro');
  expect(LOCAL_JOBS_STORAGE_KEY).not.toBe('repairs-session');
});
