// Calendar day keys ("YYYY-MM-DD") in the user's local timezone. Actions are
// stored as UTC ISO strings, so slicing the first 10 characters gives the UTC
// day, which is the wrong cell for anyone not on UTC.

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day of a Date. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar day an action is scheduled on. */
export function actionDayKey(iso: string): string {
  // A bare date (older CSV imports) already is a calendar day; parsing it would
  // make it UTC midnight and shift it to the previous day west of UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return dayKey(new Date(iso));
}
