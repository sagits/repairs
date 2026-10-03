/**
 * The login form is the only way into the app, so what it owes is narrow: validate what was typed, sign in
 * as whichever Role the switch is on, and **store none of the credentials**.
 *
 * That last one is the test with the most to say. The whole point of the change is that the form got a
 * password field without the session gaining a password: `useSession` persists the Role and nothing else,
 * so this asserts against AsyncStorage directly rather than against the store, because the store having
 * forgotten the email is not the same claim as the email never having been written down.
 *
 * Validation is driven by pressing Login rather than by blurring a field. Both work — `mode: 'onTouched'`
 * means a submit marks every field touched — but the press is the gesture a person actually makes when
 * they think they are done, and it is the one that has to produce the message.
 *
 * `expo-router` is stubbed because the screen redirects once a Role is set, and a `Redirect` outside a
 * navigator has nowhere to go. Where it redirects *to* is the Detox spec's business.
 *
 * `render` and `userEvent` are awaited because both are async in React Native Testing Library 14.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SESSION_STORAGE_KEY, useSession } from '@repairs/stores';
import { LoginScreen } from './LoginScreen';

jest.mock('expo-router', () => ({ Redirect: () => null }));

const AN_EMAIL = 'renatopprobst@gmail.com';
const A_PASSWORD = 'hunter2';

const emailField = () => screen.getByTestId('login-email');
const passwordField = () => screen.getByTestId('login-password');
const login = () => screen.getByRole('button', { name: 'Login' });

/** Valid-looking credentials, typed into both fields. Which Role they sign you in as is the switch's call. */
const fillCredentials = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(emailField(), AN_EMAIL);
  await user.type(passwordField(), A_PASSWORD);
};

beforeEach(async () => {
  await AsyncStorage.clear();
  useSession.setState({ role: null, user: null });
});

it('offers an email, a masked password, a reveal link and the two Roles', async () => {
  await render(<LoginScreen />);

  expect(screen.getByTestId('login-title')).toHaveTextContent('Login');
  expect(emailField()).toBeOnTheScreen();
  expect(passwordField().props.secureTextEntry).toBe(true);
  expect(screen.getByText('Show Password')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Client' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Pro' })).toBeOnTheScreen();
});

it('signs in as the Client, by name, when the switch is left where it starts', async () => {
  const user = userEvent.setup();
  await render(<LoginScreen />);

  await fillCredentials(user);
  await user.press(login());

  expect(useSession.getState().role).toBe('client');
  expect(useSession.getState().user?.name).toBe('Renato Probst');
});

it('signs in as the Pro, by name, when the switch is moved to Pro', async () => {
  const user = userEvent.setup();
  await render(<LoginScreen />);

  await fillCredentials(user);
  await user.press(screen.getByRole('button', { name: 'Pro' }));
  await user.press(login());

  expect(useSession.getState().role).toBe('pro');
  expect(useSession.getState().user?.name).toBe('Mike Sullivan');
});

it('refuses an email that is not one, and says so under the field', async () => {
  const user = userEvent.setup();
  await render(<LoginScreen />);

  await user.type(emailField(), 'renato');
  await user.type(passwordField(), A_PASSWORD);
  await user.press(login());

  expect(screen.getByTestId('login-email-error')).toHaveTextContent('Enter a valid email address');
  expect(useSession.getState().role).toBeNull();
});

it('refuses an empty password, and says so under that field instead', async () => {
  const user = userEvent.setup();
  await render(<LoginScreen />);

  await user.type(emailField(), AN_EMAIL);
  await user.press(login());

  expect(screen.getByTestId('login-password-error')).toHaveTextContent('Enter your password');
  expect(screen.queryByTestId('login-email-error')).not.toBeOnTheScreen();
  expect(useSession.getState().role).toBeNull();
});

it('clears the message as soon as the email is corrected, without another press', async () => {
  const user = userEvent.setup();
  await render(<LoginScreen />);

  await user.type(emailField(), 'renato');
  await user.press(login());
  expect(screen.getByTestId('login-email-error')).toBeOnTheScreen();

  await user.clear(emailField());
  await user.type(emailField(), AN_EMAIL);

  expect(screen.queryByTestId('login-email-error')).not.toBeOnTheScreen();
});

it('reveals and re-masks the password on the Show Password link', async () => {
  const user = userEvent.setup();
  await render(<LoginScreen />);

  await user.press(screen.getByRole('link', { name: 'Show Password' }));

  expect(passwordField().props.secureTextEntry).toBe(false);
  expect(screen.getByText('Hide Password')).toBeOnTheScreen();

  await user.press(screen.getByRole('link', { name: 'Hide Password' }));

  expect(passwordField().props.secureTextEntry).toBe(true);
});

it('persists the Role and neither the email nor the password', async () => {
  const user = userEvent.setup();
  await render(<LoginScreen />);

  await fillCredentials(user);
  await user.press(login());

  /** The write to storage is asynchronous, so the Role arriving there is what there is to wait for. */
  await waitFor(async () =>
    expect(await AsyncStorage.getItem(SESSION_STORAGE_KEY)).toContain('client'),
  );

  const persisted = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  expect(persisted).not.toContain(AN_EMAIL);
  expect(persisted).not.toContain(A_PASSWORD);
});
