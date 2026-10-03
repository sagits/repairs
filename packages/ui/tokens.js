/**
 * The design tokens, as plain CommonJS so `tailwind.config.js` can `require()` them with no build
 * step. `allowJs` infers the types straight from these values, so there is no hand-written `.d.ts`
 * beside this file to drift from them.
 */
const colors = {
  primary: '#37D3B1',
  primaryMuted: '#A8E9D5',
  primaryInk: '#0E8C85',
  accent: '#1E68BF',
  ink: '#2B3450',
  inkMuted: '#8A90A2',
  slate: '#6F7C8B',
  background: '#F1F2F6',
  surface: '#FFFFFF',
  surfaceMuted: '#F8F8FB',
  border: '#E3E5EC',
  skeleton: '#E7E9EE',
  mint: '#E1F3EE',
  danger: '#E2574C',
  warning: '#F2792A',
  illustration: '#CDCBCF',
  /** The dark wash a modal lays over the screen behind it. Ink at 45%, so it tints rather than greys. */
  scrim: 'rgba(43, 52, 80, 0.45)',
  openGround: '#E8F0FA',
  claimedGround: '#FDF0E6',
  doneGround: '#E1F3EE',
};

const radius = { card: 8 };

/**
 * `boxShadow` because one declaration covers native and web. The `shadow*` props are not
 * deprecated — the current React Native docs still recommend them for simple shadows — so this
 * is a choice for a single cross-platform spelling, not a migration. See `DECISIONS.md`.
 */
const shadow = { card: { boxShadow: '0px 2px 10px rgba(43, 52, 80, 0.38)' } };

const layout = { sidebarWidth: 88, maxContentWidth: 720 };

module.exports = { colors, radius, shadow, layout };
