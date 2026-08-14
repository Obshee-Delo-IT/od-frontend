/**
 * The A6 legacy-page fallback.
 *
 * Deliberately **not** re-exported from `src/shared/api/index.ts`: every
 * neighbour there is a WordPress REST fetcher that carries the application
 * password, and the one thing this code must never do is send that password to
 * the legacy origin. Keeping the two barrels apart makes the mistake awkward to
 * make by accident.
 *
 * This lists what the app imports *through* the barrel — the catch-all page, the
 * `/legacy/*` route and `LegacyEmbed`. Everything else in the folder (the
 * transform, the store, the loader factory, `legacyOrigin`) is imported by
 * module path from inside this folder or from `src/proxy.ts`, and re-exporting it
 * here only produced a second name for the same thing.
 */
export { isEmbeddable } from './isEmbeddable';
export { LEGACY_HEIGHT_MESSAGE, LEGACY_INITIAL_HEIGHT, LEGACY_MAX_HEIGHT } from './legacyMessage';
export { decodeSegments, legacyPathname } from './legacyPath';
export { loadLegacyDocument } from './loadLegacyDocument';
export type { LegacyLoad } from './types';
