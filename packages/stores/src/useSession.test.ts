/**
 * The session store is the whole of "signed in": a Role, the person it stands for, and the promise
 * that both survive a restart. Storage is the in-memory AsyncStorage mock, so the restart test is a
 * real round-trip through the same code path the device takes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SESSION_STORAGE_KEY, useSession } from './useSession';

beforeEach(async () => {
  await AsyncStorage.clear();
  useSession.setState({ role: null, user: null });
});

it('signs in as the Client, as a named person', () => {
  useSession.getState().signIn('client');

  expect(useSession.getState().role).toBe('client');
  expect(useSession.getState().user).toEqual({
    role: 'client',
    id: 13,
    name: 'Renato Probst',
    email: 'renatopprobst@gmail.com',
  });
});

it('signs in as the Pro, as a different named person', () => {
  useSession.getState().signIn('pro');

  expect(useSession.getState().role).toBe('pro');
  expect(useSession.getState().user).toEqual({
    role: 'pro',
    id: 'pro-1',
    name: 'Mike Sullivan',
    email: 'mike.sullivan@example.com',
  });
});

it('keeps the Role across a restart and rebuilds the person from it', async () => {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: { role: 'pro' }, version: 0 }));

  await useSession.persist.rehydrate();

  expect(useSession.getState().role).toBe('pro');
  expect(useSession.getState().user?.name).toBe('Mike Sullivan');
});

it('comes back signed out when storage holds nothing', async () => {
  await useSession.persist.rehydrate();

  expect(useSession.getState().role).toBeNull();
  expect(useSession.getState().user).toBeNull();
});

it('signs out of both the Role and the person, and does not come back', async () => {
  useSession.getState().signIn('client');

  useSession.getState().signOut();
  await useSession.persist.rehydrate();

  expect(useSession.getState().role).toBeNull();
  expect(useSession.getState().user).toBeNull();
});
