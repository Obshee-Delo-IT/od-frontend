/**
 * Yandex Metrica, workstream A4 — `docs/prod-migration-runbook.md` §4.9.
 *
 * **The counter id is configuration, not source.** It ships in the HTML of every
 * page, so it is not a secret — but this repository is public and the id names
 * the organisation's analytics account, so it is a per-tier build-time value like
 * `SITE_URL`: `METRICA_COUNTER_ID`, set only on the tier that owns the counter.
 *
 * **It has to be set at build time *and* in the running container.** The root
 * layout renders into statically prerendered HTML, so what the build reads is
 * what those pages carry — but it renders again on every dynamic route and every
 * ISR regeneration, where the value comes from the container's environment. The
 * `Dockerfile` therefore takes the same build-arg in both stages. Set it in only
 * one and the tag is there until the first rebuild and then silently gone, which
 * is what prod did on 2026-09-15.
 *
 * Unset is the off switch, and the wanted state everywhere but production —
 * stage is built from `main` by the same workflow, and a counter it shared would
 * write its traffic, and every §5 verification gate, into production's live one,
 * where it cannot be told apart afterwards.
 */
export const METRICA_COUNTER_ID = process.env.METRICA_COUNTER_ID ?? '';

export const METRICA_ENABLED = METRICA_COUNTER_ID !== '';
