/**
 * The adapter's two directions, which is all this file owns that `RoleTabBar.test.tsx` does not.
 *
 * They are worth pinning because they used to come from the navigator for free: the bar was handed
 * `state` and `navigation`, and the names it speaks in were the navigator's own. Reading the route from
 * the router instead means `/` has to be recognised as `index` and `index` has to be sent back as `/`,
 * and nothing else in the suite would notice if either half drifted — a wrong route would still navigate,
 * to the wrong screen.
 *
 * `expo-router` is stubbed for the same reason `RoleGuard.test.tsx` stubs it: outside a navigator there
 * is nothing real to redirect into or push onto. `Tabs` becomes a marker so the tree still renders, and
 * the stub names start with `mock` because Jest allows nothing else through a hoisted factory.
 */
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '@repairs/stores';
import { TabsLayout } from './TabsLayout';

const mockRedirect = jest.fn();
const mockNavigate = jest.fn();
let mockPathname = '/';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  Tabs: () => null,
  usePathname: () => mockPathname,
  useRouter: () => ({ navigate: mockNavigate }),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderTabs = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TabsLayout />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  mockRedirect.mockClear();
  mockNavigate.mockClear();
  mockPathname = '/';
  useSession.setState({ role: null, user: null });
});

it('sends anyone with no Role to the login form, because there is no tab list to derive', async () => {
  await renderTabs();

  expect(mockRedirect).toHaveBeenCalledWith('/login');
  expect(screen.queryByTestId('tab-bar')).not.toBeOnTheScreen();
});

it('reads `/` as the index tab, which is the one tab whose name never appears in a path', async () => {
  useSession.getState().signIn('pro');

  await renderTabs();

  expect(screen.getByRole('tab', { name: 'Available', selected: true })).toBeOnTheScreen();
});

it('reads a named route as that tab', async () => {
  useSession.getState().signIn('pro');
  mockPathname = '/mine';

  await renderTabs();

  expect(screen.getByRole('tab', { name: 'My Jobs', selected: true })).toBeOnTheScreen();
});

it('sends the index tab back as `/` rather than `/index`', async () => {
  useSession.getState().signIn('pro');
  mockPathname = '/settings';

  await renderTabs();
  await userEvent.press(screen.getByRole('tab', { name: 'Available' }));

  expect(mockNavigate).toHaveBeenCalledWith('/');
});

it('sends a named tab back as its own route', async () => {
  useSession.getState().signIn('pro');

  await renderTabs();
  await userEvent.press(screen.getByRole('tab', { name: 'Settings' }));

  expect(mockNavigate).toHaveBeenCalledWith('/settings');
});

