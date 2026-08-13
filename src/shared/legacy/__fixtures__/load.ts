import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The three captured legacy pages, read from disk at test time.
 *
 * Never fetched: the legacy origin is a committed capture, so the suite runs
 * offline and cannot change under us. See this directory's README for the
 * capture command, the hashes and every number the tests assert.
 */
export const LEGACY_FIXTURES = {
  team: { file: 'team.html', path: '/team/' },
  plakati: { file: 'materials-plakati.html', path: '/materials/plakati/' },
  faq: { file: 'faq.html', path: '/faq/' },
} as const;

export type LegacyFixtureName = keyof typeof LEGACY_FIXTURES;

/**
 * Resolved from the working directory rather than `import.meta.url`: under
 * Vitest's jsdom environment `import.meta.url` is rewritten and loses the
 * project prefix, which silently turns every fixture read into an ENOENT.
 */
const FIXTURE_DIR = join(process.cwd(), 'src/shared/legacy/__fixtures__');

export const loadFixture = (name: LegacyFixtureName): string =>
  readFileSync(join(FIXTURE_DIR, LEGACY_FIXTURES[name].file), 'utf8');

export const fixtureNames = Object.keys(LEGACY_FIXTURES) as LegacyFixtureName[];
