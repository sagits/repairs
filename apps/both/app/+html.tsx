/**
 * The web shell. It is not a route and never renders on a device: Expo Router wraps each statically
 * exported page in this at build time, and it is the only place the `<html>` document itself can be said.
 *
 * Three things earn their place here, and nothing else does.
 *
 * `viewport-fit=cover` is what makes `env(safe-area-inset-*)` resolve to real numbers in a browser, which
 * is what `react-native-safe-area-context` reads — so the tab bar keeps its bottom inset on a notched
 * phone's browser the same way it does in the app.
 *
 * `ScrollViewStyleReset` is Expo's own: React Native Web expects the body not to scroll, because a
 * `ScrollView` scrolls itself. Without it the page gets two scrollbars and `flex-1` has no height to fill.
 *
 * The background colour is set on `<body>` in plain CSS rather than in a class, because it has to be
 * painted before the bundle has parsed — otherwise the first frame is the browser's white, and the
 * hydration gate in `AppProviders` holds that frame deliberately. It is the one hardcoded token in the
 * codebase: `tokens.js` is CommonJS consumed by Tailwind, and the shell is the one file that runs before
 * any style has been generated from it.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const bodyBackground = `body { background-color: #F1F2F6; }`;

export default function WebShell({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: bodyBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
