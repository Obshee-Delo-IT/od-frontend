import { describe, expect, it } from 'vitest';
import {
  FILM_TOPIC_KEYS,
  FILM_TOPIC_LABELS,
  FILM_TOPICS,
  filmTopicIds,
  filmTopicLabels,
  type FilmTopicKey,
  resolveFilmTopics,
  toggleFilmTopic,
} from './filmTopics';

describe('FILM_TOPICS', () => {
  it('is the ten subjects `tag-film-topics` creates', () => {
    expect(FILM_TOPIC_KEYS).toEqual([
      'alcohol',
      'tobacco',
      'drugs',
      'manipulation',
      'family',
      'meaning',
      'health',
      'faith',
      'history',
      'gadgets',
    ]);
  });

  it('labels every one of them', () => {
    FILM_TOPIC_KEYS.forEach((key) => {
      expect(FILM_TOPIC_LABELS[key]).toBeTruthy();
    });
  });

  it('gives each topic its own WordPress term id', () => {
    const ids = Object.values(FILM_TOPICS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the two ids that pre-date the task', () => {
    // «Алкоголь» and «Табак» existed on the install with no posts on them, so
    // the WP task reuses them rather than making a second term with the same
    // name. Their ids are out of sequence for that reason, not by mistake.
    expect(FILM_TOPICS.alcohol).toBe(213);
    expect(FILM_TOPICS.tobacco).toBe(216);
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
    // Ten topics are 1 023 selections; without this the same set of films would
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

describe('filmTopicIds', () => {
  it('maps a selection to the ids the WP query takes', () => {
    expect(filmTopicIds(['alcohol', 'tobacco'])).toEqual([213, 216]);
    expect(filmTopicIds([])).toEqual([]);
  });
});

describe('filmTopicLabels', () => {
  it('reads a selection back in words', () => {
    expect(filmTopicLabels(['alcohol', 'tobacco'])).toBe('Алкоголь, Табак');
    expect(filmTopicLabels([])).toBe('');
  });
});
