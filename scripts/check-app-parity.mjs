#!/usr/bin/env node
/**
 * `pnpm check:apps` — the claim that `apps/both`, `apps/client` and `apps/pro` are the same app three
 * times over, checked rather than asserted.
 *
 * `ADR 0003`'s whole argument is that one app plus a paragraph promising the code would split is worth
 * nothing, because the promise is the thing being demonstrated. The same objection applies one level
 * down: three app directories that are *claimed* to be identical are worth nothing either, since the
 * drift that breaks the claim is a one-line edit nobody notices. So this diffs them, and the only
 * difference it tolerates is the Role lock — `appRole="…"` in `app/_layout.tsx`, which is the one
 * constant the three products disagree about.
 *
 * ## What it compares, and why it is more than the route tree
 *
 * The route tree is the part the ADR and `PRD.md:164` name, and it is the part that matters most: every
 * file under `app/` is a route, and every route but the root layout is a one-line re-export. But the
 * route tree is not the only thing the three apps hold in common, and the files it *imports* are the
 * ones where real drift could hide — `app/_layout.tsx` imports `../fixtures` and `../dev-reset`, which
 * between them are a couple of hundred lines of test seam that must behave the same in all three
 * builds or the Detox suites stop meaning the same thing. So `SHARED` names them too, along with the
 * build config that is genuinely identical rather than merely similar.
 *
 * Everything left out of `SHARED` is left out deliberately, because it is per-app by nature and the ADR
 * says so: `app.json` carries the name, slug and bundle identifier; `package.json` the package name;
 * `.detoxrc.js` the built binary's name; and `e2e/` the specs, which differ because the shared app has
 * eight of them and the role-locked pair have the one spec that is about being role-locked.
 *
 * **A shared file added to `apps/both` and not to `SHARED` is checked nowhere.** That is the one hole
 * here, and it is left open on purpose rather than closed with a rule about which root files count:
 * every candidate rule needs its own exception list, which is the same list spelled twice. Add the file
 * to `SHARED` when you add the file.
 *
 * ## Why a script and not a test
 *
 * It needs no install — plain Node, no dependencies, no `node_modules` — which is why CI can run it on
 * a checkout alone, and why it is the one gate in `.github/workflows/ci.yml`. A Jest test would have
 * put the cheapest check in the repo behind its most expensive setup.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPS_DIR = fileURLToPath(new URL('../apps', import.meta.url));

/** `both` first: it is the baseline the other two are diffed against, being the app the brief asked for. */
const APPS = ['both', 'client', 'pro'];

/**
 * The files outside `app/` that all three apps must hold identically. See the note above on why this is
 * a list rather than a rule, and on what each omission is.
 */
const SHARED = [
  'babel.config.js',
  'dev-reset.ts',
  'fixtures.ts',
  'global.css',
  'metro.config.js',
  'nativewind-env.d.ts',
  'scripts/e2e-test.sh',
  'tailwind.config.js',
  'tsconfig.json',
  'types.d.ts',
];

/** The one line that is allowed to differ, and the only place it is allowed to differ in. */
const ROLE_LOCK = /appRole="(both|client|pro)"/;
const ROOT_LAYOUT = 'app/_layout.tsx';

const problems = [];

const read = (app, file) => {
  const path = join(APPS_DIR, app, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
};

/** Every route in an app, as paths relative to the app, so `app/(tabs)/index.tsx` reads as it is written. */
const routesOf = (app) => {
  const root = join(APPS_DIR, app);
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(root, join(dir, entry.name))],
    );

  return existsSync(join(root, 'app')) ? walk(join(root, 'app')) : [];
};

/**
 * The root layout with its Role lock blanked out, so the remaining comparison is byte-for-byte. The
 * blanking is also the only check that each app is locked to the Role its directory is named after: a
 * copy-paste that left `apps/pro` on `appRole="client"` would otherwise pass parity perfectly.
 */
const withoutTheRoleLock = (app, file, source) => {
  if (file !== ROOT_LAYOUT || source === null) return source;

  const found = ROLE_LOCK.exec(source);
  if (!found) {
    problems.push(`apps/${app}/${file} has no appRole="…", so this build is locked to nothing.`);
    return source;
  }

  const [line, role] = found;
  if (role !== app) {
    problems.push(`apps/${app}/${file} passes appRole="${role}", which is not the Role this app is.`);
  }

  return source.replace(line, 'appRole="<the Role this app is locked to>"');
};

/** Where two files first disagree, in the terms whoever has to fix it will be reading them in. */
const firstDifference = (mine, theirs) => {
  const left = mine.split('\n');
  const right = theirs.split('\n');
  const at = left.findIndex((line, index) => line !== right[index]);

  return [`  line ${at + 1}`, `  both: ${left[at] ?? '<end of file>'}`, `  this: ${right[at] ?? '<end of file>'}`].join(
    '\n',
  );
};

for (const app of APPS) {
  // `ADR 0003`: an app holds routes and build config and no product code at all. A `src/` is what that
  // failure would look like on disk, and it is the one shape worth naming outright — the parity diff
  // above would never see it, because a file only this app has is a file nothing is compared against.
  if (existsSync(join(APPS_DIR, app, 'src'))) {
    problems.push(`apps/${app}/src/ exists. An app holds routes and build config only — see ADR 0003.`);
  }
}

const files = [...new Set(APPS.flatMap((app) => [...routesOf(app), ...SHARED]))].sort();

for (const file of files) {
  const baseline = withoutTheRoleLock('both', file, read('both', file));

  for (const app of APPS.slice(1)) {
    const theirs = withoutTheRoleLock(app, file, read(app, file));
    if (theirs === baseline) continue;

    if (theirs === null) problems.push(`apps/${app}/${file} is missing, and apps/both has it.`);
    else if (baseline === null) problems.push(`apps/${app}/${file} exists, and apps/both has no such file.`);
    else problems.push(`apps/${app}/${file} differs from apps/both/${file}:\n${firstDifference(baseline, theirs)}`);
  }
}

if (problems.length > 0) {
  console.error(`The three apps are meant to differ by one line — the Role lock — and they do not:\n`);
  for (const problem of problems) console.error(`• ${problem}`);
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}. See docs/adr/0003.`);
  process.exit(1);
}

console.log(`${APPS.join(', ')}: ${files.length} shared files, identical but for the Role lock.`);
