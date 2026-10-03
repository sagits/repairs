/**
 * The Role picker is the only way into the app, so what it owes is narrow: offer both Roles with a
 * line each on what that Role does, and sign in as the right person when one is picked.
 *
 * `expo-router` is stubbed because the screen redirects once a Role is set, and a `Redirect`
 * outside a navigator has nowhere to go. Where it redirects *to* is the Detox spec's business.
 *
 * `render` is awaited because it is async in React Native Testing Library 14.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent } from '@testing-library/react-native';
import { useSession } from '@repairs/stores';
import { LoginScreen } from './LoginScreen';

jest.mock('expo-router', () => ({ Redirect: () => null }));

beforeEach(async () => {
  await AsyncStorage.clear();
  useSession.setState({ role: null, user: null });
});

it('offers both Roles, each with a line on what that Role does', async () => {
  await render(<LoginScreen />);

  expect(screen.getByText('Continue as Client')).toBeOnTheScreen();
  expect(screen.getByText('Post repair jobs and track them.')).toBeOnTheScreen();
  expect(screen.getByText('Continue as Pro')).toBeOnTheScreen();
  expect(screen.getByText('Claim open jobs and complete them.')).toBeOnTheScreen();
});

it('signs in as the Client, by name, when the Client is picked', async () => {
  await render(<LoginScreen />);

  await userEvent.press(screen.getByRole('button', { name: 'Continue as Client' }));

  expect(useSession.getState().role).toBe('client');
  expect(useSession.getState().user?.name).toBe('Renato Probst');
});

it('signs in as the Pro, by name, when the Pro is picked', async () => {
  await render(<LoginScreen />);

  await userEvent.press(screen.getByRole('button', { name: 'Continue as Pro' }));

  expect(useSession.getState().role).toBe('pro');
  expect(useSession.getState().user?.name).toBe('Mike Sullivan');
});
