/**
 * Every Jest test runs against the fixture server, which is installed here rather than per test
 * file: the suite's whole premise is that the network is deterministic, and a test that forgot to
 * install it would reach the real API and flake on a third party.
 *
 * The flag is read on every request, not once here, so a single test can flip
 * `process.env.EXPO_PUBLIC_API` and watch the routing follow — which is what `live.e2e.ts` and any
 * test of the real client need.
 *
 * This file lives in the app rather than in `packages/testing` because `babel-preset-expo` rewrites
 * a literal `process.env.EXPO_PUBLIC_API` into a read against `expo/virtual/env`, and `expo` is a
 * dependency of the app, not of `packages/*`. `installFixtureFetch`'s own comment has the detail.
 */
import { installFixtureFetch } from '@repairs/testing';

process.env.EXPO_PUBLIC_API ??= 'fixtures';

installFixtureFetch(() => process.env.EXPO_PUBLIC_API === 'fixtures');
