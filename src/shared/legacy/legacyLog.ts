/**
 * The A6 fallback's only production signal.
 *
 * There is no alerting stack in this project and no logging channel beyond
 * stdout, which Coolify captures — so these four lines *are* the observability
 * story, and each one is deliberately distinct and greppable:
 *
 * - `[legacy] WP_LEGACY_BASE missing — legacy fallback disabled` (once, at boot)
 * - `[legacy] upstream <status> for <path>`
 * - `[legacy] boundary miss for <path>`
 * - `[legacy] rejected path <path>`
 *
 * Centralised so the `no-console` escape hatch is written once and so a grep for
 * `legacyWarn` finds every place the fallback can complain.
 */
export const legacyWarn = (message: string): void => {
  // eslint-disable-next-line no-console
  console.warn(`[legacy] ${message}`);
};
