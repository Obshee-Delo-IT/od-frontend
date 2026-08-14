import { parseArgs } from 'node:util';

/**
 * `node:util`'s `parseArgs` over the argv pnpm hands a script.
 *
 * Two reasons this is a wrapper rather than a direct call in each script:
 * `pnpm run x -- --flag` forwards the bare `--` as the *first* argument, and
 * `parseArgs` reads it as «everything after this is a positional» — which,
 * since none of these scripts take positionals, is an error on every real
 * invocation. And the option table is the only part that differs between them.
 *
 * Unknown flags and a flag missing its value both throw, which the seven
 * hand-rolled argv loops this replaced did not do consistently.
 */
export const readArgs = (options) =>
  parseArgs({ args: process.argv.slice(2).filter((arg) => arg !== '--'), options }).values;

/** `--only 70570,71933` → a Set of trimmed ids; `undefined` stays `undefined`. */
export const idSet = (value) => (value === undefined ? null : new Set(value.split(',').map((id) => id.trim())));

/** An origin with any trailing slash removed, so `${base}${path}` never doubles it. */
export const origin = (value) => value.replace(/\/$/, '');
