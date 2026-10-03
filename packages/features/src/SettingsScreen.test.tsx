/**
 * Settings is the only way out of a Role, so what it owes is the two exits and the one thing that is
 * deliberately not an exit: switching Role and logging out both leave Local job data alone, and only
 * the separate confirmed action empties it. The lifetimes are the point — the session is who you
 * are, the local job store is what happened.
 *
 * `render` is awaited because it is async in React Native Testing Library 14.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent } from '@testing-library/react-native';
import { useLocalJobs, useSession } from '@repairs/stores';
import { AppRoleProvider } from './appRole';
import { SettingsScreen } from './SettingsScreen';
import type { AppRole } from '@repairs/types';

const renderSettings = (appRole: AppRole = 'both') =>
  render(
    <AppRoleProvider value={appRole}>
      <SettingsScreen />
    </AppRoleProvider>,
  );

const aPostedJob = { id: 'local-1', title: 'Leaking tap' };

beforeEach(async () => {
  await AsyncStorage.clear();
  useSession.setState({ role: null, user: null });
  useLocalJobs.setState({ created: [], claims: {}, deleted: [] });
});

it('shows the person behind the current Role: their name, their email and the Role itself', async () => {
  useSession.getState().signIn('client');

  await renderSettings();

  expect(screen.getByText('Renato Probst')).toBeOnTheScreen();
  expect(screen.getByText('renatopprobst@gmail.com')).toBeOnTheScreen();
  expect(screen.getByText('Signed in as Client')).toBeOnTheScreen();
});

it('offers the other Role by name, and switching swaps the whole session to its person', async () => {
  useSession.getState().signIn('client');

  await renderSettings();
  await userEvent.press(screen.getByRole('button', { name: 'Switch to Pro' }));

  expect(useSession.getState().role).toBe('pro');
  expect(useSession.getState().user?.name).toBe('Mike Sullivan');
  expect(screen.getByRole('button', { name: 'Switch to Client' })).toBeOnTheScreen();
});

it('has no Role switcher in a role-locked build, because there is no other Role to reach', async () => {
  useSession.getState().signIn('pro');

  await renderSettings('pro');

  expect(screen.queryByRole('button', { name: 'Switch to Client' })).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
});

it('logs out of the Role and the person, in every build', async () => {
  useSession.getState().signIn('pro');

  await renderSettings('pro');
  await userEvent.press(screen.getByRole('button', { name: 'Log out' }));

  expect(useSession.getState().role).toBeNull();
  expect(useSession.getState().user).toBeNull();
});

it('leaves Local job data alone when the Role is switched', async () => {
  useSession.getState().signIn('client');
  useLocalJobs.setState({ created: [aPostedJob] });

  await renderSettings();
  await userEvent.press(screen.getByRole('button', { name: 'Switch to Pro' }));

  expect(useLocalJobs.getState().created).toEqual([aPostedJob]);
});

it('leaves Local job data alone when you log out, so logging back in reaches the same jobs', async () => {
  useSession.getState().signIn('client');
  useLocalJobs.setState({ created: [aPostedJob] });

  await renderSettings();
  await userEvent.press(screen.getByRole('button', { name: 'Log out' }));

  expect(useLocalJobs.getState().created).toEqual([aPostedJob]);
});

it('asks before clearing Local job data, and clears nothing until the clearing is confirmed', async () => {
  useSession.getState().signIn('client');
  useLocalJobs.setState({ created: [aPostedJob] });

  await renderSettings();
  await userEvent.press(screen.getByRole('button', { name: 'Clear local job data' }));

  expect(screen.getByText('Clear local job data?')).toBeOnTheScreen();
  expect(useLocalJobs.getState().created).toEqual([aPostedJob]);
});

it('clears Local job data once the clearing is confirmed, and leaves the session signed in', async () => {
  useSession.getState().signIn('client');
  useLocalJobs.setState({ created: [aPostedJob], deleted: ['7'] });

  await renderSettings();
  await userEvent.press(screen.getByRole('button', { name: 'Clear local job data' }));
  await userEvent.press(screen.getByRole('button', { name: 'Clear it' }));

  expect(useLocalJobs.getState()).toMatchObject({ created: [], claims: {}, deleted: [] });
  expect(useSession.getState().role).toBe('client');
});

it('backs out of the clearing without clearing anything', async () => {
  useSession.getState().signIn('client');
  useLocalJobs.setState({ created: [aPostedJob] });

  await renderSettings();
  await userEvent.press(screen.getByRole('button', { name: 'Clear local job data' }));
  await userEvent.press(screen.getByRole('button', { name: 'Keep it' }));

  expect(useLocalJobs.getState().created).toEqual([aPostedJob]);
  expect(screen.getByRole('button', { name: 'Clear local job data' })).toBeOnTheScreen();
});
