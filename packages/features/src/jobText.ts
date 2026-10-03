/**
 * The strings about a Job that more than one screen has to get right the same way: the Pro's name, a date,
 * and the titles of the two failures that can be reported from two places. The first two were local to
 * `PostedJobsScreen` until the detail screen needed them too, which is what earned them a file — one caller
 * would not have, and that is still the line this file is drawn on.
 */
import { PEOPLE } from '@repairs/stores';

/**
 * The Pro holding a Job, by name. There is exactly one Pro, so this is a lookup against the one person
 * rather than a directory — and it falls back to the id instead of to "Unknown", because an id on the card
 * is at least true. The API has no users endpoint we call and no assignee field, so a second Pro would
 * arrive with the store that invented them and this is where it would be read from.
 */
export const proName = (proId: string) => (proId === PEOPLE.pro.id ? PEOPLE.pro.name : proId);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A day read straight off an ISO string's own `YYYY-MM-DD`, rather than through a `Date` and a locale. A
 * `Date` would render in the device's time zone and an `Intl` format in the device's locale, and both are
 * things a Detox assertion and a Jest assertion would then disagree about on the same commit — Hermes
 * abbreviates September as "Sept" where Node gives "Sep". Every timestamp this app writes is UTC, so
 * reading UTC back is not a simplification of the truth; it is the truth, formatted.
 *
 * ponytail: a month table rather than `Intl.DateTimeFormat`, because the only thing a formatter would buy
 * here is that disagreement. If the app is ever localised, this is what it replaces.
 */
export const asDay = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
};

/**
 * The two failure titles two screens each have to word identically. A claim can fail from the available
 * list or from the detail screen, and a completion from the claimed list or from the detail screen, so each
 * of these sentences has two call sites and a Detox assertion waiting on its exact text. The ones that
 * stayed in their screens — `Could not cancel this job`, and the three `Could not load …` titles — have one
 * caller each, which is the same test `proName` and `asDay` passed to get here.
 */
export const CLAIM_FAILED = 'Could not claim this job';
export const COMPLETE_FAILED = 'Could not mark this job done';
