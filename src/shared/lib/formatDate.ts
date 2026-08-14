/**
 * The one date format this site shows: `DD.MM.YYYY`.
 *
 * `Intl` rather than a date library — every call site did
 * `dayjs(x).format('DD.MM.YYYY')` and nothing else, and `ru-RU` numeric is that
 * format exactly. The options are spelled out anyway, so a locale-data change
 * cannot quietly turn it into `4.8.2026`.
 *
 * WordPress sends `date` as site-local time with no zone designator, which both
 * this and `new Date()` read as the container's local time — the same reading
 * the previous `dayjs` calls made. Use `date_gmt` if that ever needs to be
 * exact.
 *
 * A missing date formats to `''`, not to today: `dayjs(undefined)` is *now*,
 * which is how an article with no date used to be stamped with the day it was
 * rendered.
 */
const formatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : formatter.format(parsed);
};
