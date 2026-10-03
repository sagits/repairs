/**
 * AsyncStorage is swapped for the in-memory implementation the package ships for Jest. The persisted
 * stores are under test, so they need storage that genuinely round-trips rather than a no-op: the
 * mock keeps a real object behind the same API, which is what lets a rehydrate test mean anything.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
