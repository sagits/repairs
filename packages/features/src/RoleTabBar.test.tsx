/**
 * The tab list is derived from the Role, so this is where that derivation is pinned: a Client gets
 * two tabs, a Pro gets three, and `index` is labelled differently for each because it is a different
 * list underneath. The one tab you are on is the selected one.
 *
 * `SafeAreaProvider` is given explicit metrics because without them it reports nothing until a
 * layout pass, and children of the real provider never render in a test.
 */
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactElement } from 'react';
import { RoleTabBar } from './RoleTabBar';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderInSafeArea = (ui: ReactElement) =>
  render(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

it('gives a Client two tabs: their posted jobs, and settings', async () => {
  await renderInSafeArea(<RoleTabBar role="client" activeName="index" onSelect={jest.fn()} />);

  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.getByRole('tab', { name: 'My Jobs' })).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: 'Settings' })).toBeOnTheScreen();
});

it('gives a Pro three tabs: available jobs, their claimed jobs, and settings', async () => {
  await renderInSafeArea(<RoleTabBar role="pro" activeName="index" onSelect={jest.fn()} />);

  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(screen.getByRole('tab', { name: 'Available' })).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: 'My Jobs' })).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: 'Settings' })).toBeOnTheScreen();
});

it('marks only the tab you are on as selected', async () => {
  await renderInSafeArea(<RoleTabBar role="pro" activeName="mine" onSelect={jest.fn()} />);

  expect(screen.getByRole('tab', { name: 'My Jobs', selected: true })).toBeOnTheScreen();
  expect(screen.getAllByRole('tab', { selected: false })).toHaveLength(2);
});

it('reports the route behind a tab when it is pressed', async () => {
  const onSelect = jest.fn();
  await renderInSafeArea(<RoleTabBar role="pro" activeName="index" onSelect={onSelect} />);

  await userEvent.press(screen.getByRole('tab', { name: 'Settings' }));

  expect(onSelect).toHaveBeenCalledWith('settings');
});
