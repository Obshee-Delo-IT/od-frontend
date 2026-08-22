/**
 * The contract between the injected runtime and `LegacyEmbed` — the one thing
 * that crosses the frame boundary, so it lives in its own module rather than in
 * either side's file. Importing it into the client bundle must not drag the
 * runtime's source along with it.
 */

/** Namespaced so an unrelated `postMessage` on the page cannot be mistaken for one of ours. */
export const LEGACY_HEIGHT_MESSAGE = 'od:legacy-height';

/**
 * Above this, a reported height is a bug rather than a tall page — the largest
 * legacy page measured is a few thousand pixels, and an absurd value would
 * otherwise blow the layout out to a scrollbar nobody can use.
 */
export const LEGACY_MAX_HEIGHT = 50_000;

/** The starting height, so a frame whose sync never arrives still shows content. */
export const LEGACY_INITIAL_HEIGHT = '60vh';
