/**
 * Calendar boundary helpers.
 *
 * Boundaries are computed in the athlete's local timezone and returned as epoch
 * milliseconds so the feed filters and the weekly aggregates agree on "week".
 */

/** Epoch ms of Monday 00:00:00.000 local time for the week containing `date`. */
export function getStartOfWeek(date: Date = new Date()): number {
  const d = new Date(date.getTime());
  const day = d.getDay();
  // getDay() is 0 for Sunday; shift Sunday back to Monday (-6) and Monday onto itself.
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Epoch ms of the first day of the month containing `date`, at local midnight. */
export function getStartOfMonth(date: Date = new Date()): number {
  const d = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  return d.getTime();
}
