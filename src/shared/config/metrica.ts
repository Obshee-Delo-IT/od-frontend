/**
 * Yandex Metrica, workstream A4 — `docs/prod-migration-runbook.md` §4.9.
 *
 * **The counter id is configuration, not source.** It ships in the HTML of every
 * page, so it is not a secret — but this repository is public and the id names
 * the organisation's analytics account, so it is a per-tier build-time value like
 * `SITE_URL`: `METRICA_COUNTER_ID`, set only on the tier that owns the counter.
 *
 * **Build-time, not runtime**, and that is not a choice: the root layout renders
 * into statically prerendered HTML, so whatever this reads at build is what every
 * prerendered page carries. Setting the variable on a running container changes
 * nothing until the next build.
 *
 * Unset is the off switch, and the wanted state everywhere but production —
 * stage is built from `main` by the same workflow, and a counter it shared would
 * write its traffic, and every §5 verification gate, into production's live one,
 * where it cannot be told apart afterwards.
 */
export const METRICA_COUNTER_ID = process.env.METRICA_COUNTER_ID ?? '';

export const METRICA_ENABLED = METRICA_COUNTER_ID !== '';
