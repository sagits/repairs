/**
 * NativeWind needs both halves: the preset's `jsxImportSource` so `className` compiles, and its
 * own preset for the style transform.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
