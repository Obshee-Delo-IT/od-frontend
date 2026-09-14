import { siteUrl } from '@/shared/config/site';

/**
 * Yandex Metrica, workstream A4 — `docs/prod-migration-runbook.md` §4.9.
 *
 * **Production's own counter, not a new one.** The apex domain does not change
 * at cutover, so the counter keeps its whole history — which is also why there
 * must never be a second one: the «Страницы входа» export that `pnpm url:check`
 * replays comes out of this account. One counter, one source. That is why
 * `transformLegacyHtml` strips `mc.yandex.ru` out of every page the A6 iframe
 * proxies, and why the tag is cut out of the frozen copy at cutover (§5.5).
 */
export const METRICA_COUNTER_ID = 34478865;

/**
 * Whether *this* deployment is the one that owns the counter.
 *
 * Both tiers are built from `main` by the same workflow, so without this the
 * stage application at `new.obshee-delo.ru` would write its own traffic — ours,
 * and every §5 verification gate — into production's live counter, where it
 * cannot be told apart after the fact. `SITE_URL` is the discriminator the repo
 * already has: it is a per-tier build-arg, and it is what every canonical is
 * built from, so a tier that advertises production's URLs is production.
 */
export const METRICA_ENABLED = siteUrl === 'https://obshee-delo.ru';
