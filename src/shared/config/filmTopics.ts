/**
 * What a film is *about* — the subject axis, orthogonal to the catalogue's five
 * categories.
 *
 * The categories say what a film *is* (фильм, мультфильм, ролик,
 * короткометражный, известные люди) and never what it is about, which is the
 * gap two reviewers reported independently in August 2026: a teacher wants *the
 * film about smoking*, not the newest film. These ten tags are that axis.
 *
 * Values are WordPress `post_tag` ids, and they are **per environment** — the
 * same caveat as {@link FILM_CATEGORIES}, and the same single edit point when
 * `WP_BASE` is repointed. `wp/scripts/od-wp.php`'s `tag-film-topics` task
 * creates the terms and prints the ids it made; `od_wp_film_topics()` there is
 * the film-to-topic assignment itself. Two of the ten pre-date this — «Алкоголь»
 * (213) and «Табак» (216) were sitting on the install with no posts on them, so
 * the task reuses them, which is why their ids are out of sequence.
 *
 * **Ordinary tags, not a taxonomy of their own.** The install carries 384 tags,
 * ten years of one-off keywords, and nothing queries them; reading exactly these
 * ten ids is what makes them a filter, the same way `FILM_CATEGORIES` reads five
 * category ids out of a much larger tree.
 *
 * Declaration order is the order of the chips. It is deliberate rather than
 * alphabetical or by size: the three substances first, because that is what the
 * organisation is about and the order the request itself named them in
 * («алкоголь, никотин, наркотики, мотивация»).
 */
export const FILM_TOPICS = {
  alcohol: 213,
  tobacco: 216,
  drugs: 672,
  manipulation: 673,
  family: 674,
  meaning: 675,
  health: 676,
  faith: 677,
  history: 678,
  gadgets: 679,
} as const;

export type FilmTopicKey = keyof typeof FILM_TOPICS;

/**
 * Chip wording — one word wherever one word will do.
 *
 * **Deliberately shorter than the WordPress term names** («Манипуляция и
 * реклама», «Семья и отношения», «История и патриотизм», «Вера и традиция»,
 * «Гаджеты и игры»), which stay as they are: those name the tag for an editor
 * looking at a list of 384 of them, where the qualifier earns its place. Here
 * ten of them stand side by side under the heading «Тема», the context does the
 * qualifying, and the long forms cost two extra rows of wrapping on a phone —
 * the filter burying the films it is supposed to find.
 */
export const FILM_TOPIC_LABELS: Record<FilmTopicKey, string> = {
  alcohol: 'Алкоголь',
  tobacco: 'Табак',
  drugs: 'Наркотики',
  manipulation: 'Манипуляция',
  family: 'Семья',
  meaning: 'Смысл жизни',
  health: 'Здоровье',
  faith: 'Вера',
  history: 'История',
  gadgets: 'Гаджеты',
};

/** Declaration order — the chip order, and the order a URL lists topics in. */
export const FILM_TOPIC_KEYS = Object.keys(FILM_TOPICS) as FilmTopicKey[];

/** The query parameter the selection travels in. */
export const TOPIC_PARAM = 'topic';

/**
 * The topics a `?topic=` value selects, normalised.
 *
 * Accepts both spellings a link or a hand-typed URL can arrive in —
 * `?topic=alcohol,tobacco` and `?topic=alcohol&topic=tobacco` — drops anything
 * that is not a topic, de-duplicates, and returns them in declaration order.
 *
 * **The normalising is the point, not tidiness.** Ten topics are 1 023 possible
 * selections; without a canonical ordering the same set of films would have as
 * many addresses as there are ways to spell it, which is exactly the
 * near-duplicate family the catalogue routes already refuse to grow (SEO-10).
 * One set, one URL.
 *
 * `hasOwn` rather than `in`, for the reason {@link resolveFilmCategory} gives:
 * the value comes straight off the URL, and `?topic=constructor` would otherwise
 * resolve to something off `Object.prototype`.
 */
export const resolveFilmTopics = (value: string | string[] | undefined | null): FilmTopicKey[] => {
  const values = Array.isArray(value) ? value : [value ?? ''];
  const chosen = new Set(
    values
      .flatMap((entry) => (entry ?? '').split(','))
      .map((entry) => entry.trim())
      .filter((entry) => Object.hasOwn(FILM_TOPICS, entry))
  );

  return FILM_TOPIC_KEYS.filter((key) => chosen.has(key));
};

/** The WordPress `post_tag` ids a selection queries. */
export const filmTopicIds = (topics: FilmTopicKey[]): number[] => topics.map((topic) => FILM_TOPICS[topic]);

/**
 * The selection a chip click produces: `topic` added if it was off, removed if
 * it was on, and the result back in declaration order so the URL stays canonical.
 *
 * This is what makes the chips multi-select without a line of client state —
 * every chip is a plain link to the selection it would produce, so the filter
 * works with JavaScript off and the back button behaves.
 */
export const toggleFilmTopic = (topics: FilmTopicKey[], topic: FilmTopicKey): FilmTopicKey[] => {
  const next = new Set(topics);
  if (!next.delete(topic)) {
    next.add(topic);
  }

  return FILM_TOPIC_KEYS.filter((key) => next.has(key));
};

/** «Алкоголь, Табак» — the selection in words, for a title and a heading. */
export const filmTopicLabels = (topics: FilmTopicKey[]): string =>
  topics.map((topic) => FILM_TOPIC_LABELS[topic]).join(', ');
