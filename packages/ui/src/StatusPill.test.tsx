/**
 * The pill's one behavioural promise, and the reason it is a component rather than a coloured
 * `View`: **status is never communicated by colour alone, so the pill always carries its label.**
 * A tint is invisible to a screen reader and to anyone who cannot tell `#1E68BF` from `#F2792A`, so
 * the label is the status and the colour is decoration on top of it.
 *
 * The three labels are the `GLOSSARY.md` words — Open, Claimed, Done — and nothing else is one. The
 * colours are deliberately not asserted: those are design tokens checked by eye against
 * `reference/`, and a test that pinned class names would fail on every restyle while catching no
 * regression anybody could see.
 *
 * `render` is awaited because it is async in React Native Testing Library 14.
 */
import { render, screen } from '@testing-library/react-native';
import type { JobStatus } from '@repairs/types';
import { StatusPill } from './StatusPill';

const LABELS: Record<JobStatus, string> = {
  open: 'Open',
  claimed: 'Claimed',
  done: 'Done',
};

it.each(Object.entries(LABELS))('labels a %s job "%s" rather than tinting it alone', async (status, label) => {
  await render(<StatusPill status={status as JobStatus} />);

  expect(screen.getByText(label)).toBeOnTheScreen();
});
