import { describe, expect, it } from 'vitest';
import {
  FILM_TOPIC_KEYS,
  FILM_TOPIC_LABELS,
  FILM_TOPICS,
  filmTopicLabels,
  type FilmTopicKey,
  resolveFilmTopics,
  toggleFilmTopic,
} from './filmTopics';

describe('FILM_TOPICS', () => {
  it('is the nine subjects `tag-film-topics` creates', () => {
    expect(FILM_TOPIC_KEYS).toEqual([
      'alcohol',
      'tobacco',
      'drugs',
      'manipulation',
      'family',
      'meaning',
      'health',
      'faith',
      'gadgets',
    ]);
  });

  it('does not carry «История и патриотизм», which was five old clips', () => {
    // Dropped 2026-09-12. Two of its films are on «Вера» and «Алкоголь» anyway,
    // and a chip is a promise that there is something behind it worth a click.
    expect(FILM_TOPIC_KEYS).not.toContain('history');
  });

  it('labels every one of them', () => {
    FILM_TOPIC_KEYS.forEach((key) => {
      expect(FILM_TOPIC_LABELS[key]).toBeTruthy();
    });
  });

  it('keeps every label short enough for a phone-width chip', () => {
    // Ten chips wrap; the WordPress term names («Манипуляция и реклама»,
    // «История и патриотизм») cost two extra rows of wrapping at 390px, which
    // is the filter burying the films it exists to find. Twelve characters fits
    // three chips to a row.
    FILM_TOPIC_KEYS.forEach((key) => {
      expect(FILM_TOPIC_LABELS[key].length).toBeLessThanOrEqual(12);
    });
    expect(FILM_TOPIC_LABELS.manipulation).toBe('Манипуляция');
    expect(FILM_TOPIC_LABELS.family).toBe('Семья');
  });

  it('keeps them distinct — a chip has to say which topic it is', () => {
    const labels = FILM_TOPIC_KEYS.map((key) => FILM_TOPIC_LABELS[key]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives each topic its own WordPress slug', () => {
    const slugs = Object.values(FILM_TOPICS);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('holds slugs, not term ids', () => {
    // The ids `tag-film-topics` handed out differ between od-stage and od-wp,
    // and one build serves both: a number here served «Наркотики» films under
    // «Манипуляция» on the live site (2026-09-16). `shared/api/termIds.ts`
    // resolves the id from the slug against whatever install is being read.
    Object.values(FILM_TOPICS).forEach((slug) => {
      expect(typeof slug).toBe('string');
    });
  });

  it('keeps the two slugs that pre-date the task', () => {
    // «Алкоголь» and «Табак» existed on the install with no posts on them, so
    // the WP task reuses them rather than making a second term with the same
    // name — which is why their slugs are WordPress's percent-encoded form of
    // a Russian name and not the latin slugs the task writes.
    expect(FILM_TOPICS.alcohol).toBe('%d0%b0%d0%bb%d0%ba%d0%be%d0%b3%d0%be%d0%bb%d1%8c');
    expect(FILM_TOPICS.tobacco).toBe('%d1%82%d0%b0%d0%b1%d0%b0%d0%ba');
  });
});

describe('resolveFilmTopics', () => {
  it('reads the comma-separated form a link builds', () => {
    expect(resolveFilmTopics('alcohol,tobacco')).toEqual(['alcohol', 'tobacco']);
  });

  it('reads the repeated-parameter form a hand-typed URL can arrive in', () => {
    expect(resolveFilmTopics(['alcohol', 'tobacco'])).toEqual(['alcohol', 'tobacco']);
    expect(resolveFilmTopics(['alcohol,drugs', 'tobacco'])).toEqual(['alcohol', 'tobacco', 'drugs']);
  });

  it('normalises to declaration order, so one selection has one address', () => {
    // Nine topics are 511 selections; without this the same set of films would
    // have as many URLs as there are ways to spell it.
    expect(resolveFilmTopics('tobacco,alcohol')).toEqual(['alcohol', 'tobacco']);
    expect(resolveFilmTopics('gadgets,drugs,alcohol')).toEqual(['alcohol', 'drugs', 'gadgets']);
  });

  it('de-duplicates', () => {
    expect(resolveFilmTopics('alcohol,alcohol,alcohol')).toEqual(['alcohol']);
  });

  it('drops anything that is not a topic, rather than 404ing the page', () => {
    expect(resolveFilmTopics('nonsense')).toEqual([]);
    expect(resolveFilmTopics('alcohol,nonsense')).toEqual(['alcohol']);
    expect(resolveFilmTopics('')).toEqual([]);
    expect(resolveFilmTopics(undefined)).toEqual([]);
    expect(resolveFilmTopics(null)).toEqual([]);
  });

  it('is not fooled by inherited properties', () => {
    expect(resolveFilmTopics('constructor')).toEqual([]);
    expect(resolveFilmTopics('toString')).toEqual([]);
  });

  it('tolerates the spaces a pasted URL picks up', () => {
    expect(resolveFilmTopics('alcohol, tobacco')).toEqual(['alcohol', 'tobacco']);
  });
});

describe('toggleFilmTopic', () => {
  it('adds a topic that was off', () => {
    expect(toggleFilmTopic([], 'alcohol')).toEqual(['alcohol']);
    expect(toggleFilmTopic(['alcohol'], 'drugs')).toEqual(['alcohol', 'drugs']);
  });

  it('removes a topic that was on', () => {
    expect(toggleFilmTopic(['alcohol', 'drugs'], 'alcohol')).toEqual(['drugs']);
    expect(toggleFilmTopic(['alcohol'], 'alcohol')).toEqual([]);
  });

  it('returns declaration order whatever order it was given', () => {
    expect(toggleFilmTopic(['gadgets', 'drugs'], 'alcohol')).toEqual(['alcohol', 'drugs', 'gadgets']);
  });

  it('round-trips: on then off is where it started', () => {
    const start: FilmTopicKey[] = ['tobacco', 'health'];
    expect(toggleFilmTopic(toggleFilmTopic(start, 'faith'), 'faith')).toEqual(start);
  });
});

describe('filmTopicLabels', () => {
  it('reads a selection back in words', () => {
    expect(filmTopicLabels(['alcohol', 'tobacco'])).toBe('Алкоголь, Табак');
    expect(filmTopicLabels([])).toBe('');
  });
});
