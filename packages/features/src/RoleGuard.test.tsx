/**
 * A route a Role cannot reach is guarded, not deleted, so a deep link to it redirects instead of
 * crashing. The guard is one component used at every such route, and it is tested for the three
 * answers it can give: the right Role passes, the wrong Role is sent home, and nobody signed in is
 * sent home too — the tabs' own gate turns that into the Role picker a frame later.
 *
 * `Redirect` is stubbed because a real one outside a navigator has nowhere to go. The stub records
 * where it was sent, which is the one thing about a redirect worth asserting; the name has to start
 * with `mock` for Jest to allow the hoisted factory to reach it.
 */
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useSession } from '@repairs/stores';
import { RoleGuard } from './RoleGuard';

const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));

beforeEach(() => {
  mockRedirect.mockClear();
  useSession.setState({ role: null, user: null });
});

const guarded = (
  <RoleGuard allow="pro">
    <Text>The jobs you have claimed</Text>
  </RoleGuard>
);

it('renders the route for the Role it is for, and redirects nowhere', async () => {
  useSession.getState().signIn('pro');

  await render(guarded);

  expect(screen.getByText('The jobs you have claimed')).toBeOnTheScreen();
  expect(mockRedirect).not.toHaveBeenCalled();
});

it('sends the other Role home rather than rendering a route that is not theirs', async () => {
  useSession.getState().signIn('client');

  await render(guarded);

  expect(screen.queryByText('The jobs you have claimed')).not.toBeOnTheScreen();
  expect(mockRedirect).toHaveBeenCalledWith('/');
});

it('sends nobody home as well, so a deep link into a cold app is not a crash either', async () => {
  await render(guarded);

  expect(screen.queryByText('The jobs you have claimed')).not.toBeOnTheScreen();
  expect(mockRedirect).toHaveBeenCalledWith('/');
});
