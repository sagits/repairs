/**
 * The web shell. It is not a screen and never renders on a device: Expo Router wraps each statically
 * exported page in this at build time, and it is the only place the `<html>` document itself can be said.
 *
 * It lives here rather than in each app's `app/+html.tsx` for the reason every other route does — the
 * three apps are the same route tree three times over and `pnpm check:apps` fails if they stop being, so
 * a shell written out three times is three chances to drift. There is nothing per-app in it: the Role
 * lock is in `app/_layout.tsx` and the scheme is in `app.json`, and neither reaches the document.
 *
 * Three things earn their place here, and nothing else does.
 *
 * `viewport-fit=cover` is what makes `env(safe-area-inset-*)` resolve to real numbers in a browser, which
 * is what `react-native-safe-area-context` reads — so the tab bar keeps its bottom inset. Expo's own
 * `ScrollViewStyleReset` stops the page getting a second scrollbar beside the `ScrollView`'s, which is
 * what React Native Web expects. And the background colour is set on `<body>` in plain CSS rather than in
 * a class, because it has to be painted before the bundle has parsed — otherwise the first frame is the
 * browser's white, and the hydration gate in `AppProviders` holds that frame deliberately.
 *
 * That colour is the one hardcoded token in the codebase. `tokens.js` is CommonJS consumed by Tailwind,
 * and this is the one file that runs before any style has been generated from it.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const bodyBackground = `body { background-color: #F1F2F6; }`;

export function WebShell({ children }: PropsWithChildren) {
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
