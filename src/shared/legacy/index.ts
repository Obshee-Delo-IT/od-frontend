/**
 * The A6 legacy-page fallback.
 *
 * Deliberately **not** re-exported from `src/shared/api/index.ts`: every
 * neighbour there is a WordPress REST fetcher that carries the application
 * password, and the one thing this code must never do is send that password to
 * the legacy origin. Keeping the two barrels apart makes the mistake awkward to
 * make by accident.
 */
export { isEmbeddable, LEGACY_DENYLIST } from './isEmbeddable';
export { LEGACY_HEIGHT_MESSAGE, LEGACY_INITIAL_HEIGHT, LEGACY_MAX_HEIGHT } from './legacyMessage';
export type { LegacyHeightMessage } from './legacyMessage';
export { legacyOrigin, resolveLegacyOrigin } from './legacyOrigin';
export { buildLegacyUrl, decodeSegments, LEGACY_EMBED_QUERY, legacyPathname } from './legacyPath';
export { createLegacyLoader, loadLegacyDocument, LEGACY_TIMEOUT_MS } from './loadLegacyDocument';
export { createConcurrencyGate, createLegacyStore, legacyGate, legacyStore } from './legacyStore';
export { transformLegacyHtml } from './transformLegacyHtml';
export type { TransformOptions, TransformResult } from './transformLegacyHtml';
export type { LegacyDocument, LegacyLoad } from './types';
