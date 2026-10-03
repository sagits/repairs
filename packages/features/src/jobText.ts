/**
 * The two strings about a Job that more than one screen has to get right the same way: the Pro's name, and
 * a date. Both were local to `PostedJobsScreen` until the detail screen needed them too, which is what
 * earned them a file — one caller would not have.
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
