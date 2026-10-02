/**
 * The smoke test for the whole render path: tokens -> Tailwind preset -> a screen re-exported
 * through the package barrel. If the monorepo's wiring breaks, this is what goes red first.
 *
 * `render` is awaited because it is async in React Native Testing Library 14 — without the await,
 * `screen` is never populated and every query throws "render function has not been called".
 */
import { render, screen } from '@testing-library/react-native';
import { WelcomeScreen } from './WelcomeScreen';

it('renders the wordmark and the strapline', async () => {
  await render(<WelcomeScreen />);

  expect(screen.getByText('Repairs')).toBeOnTheScreen();
  expect(screen.getByText('Post a job, or claim one.')).toBeOnTheScreen();
});
