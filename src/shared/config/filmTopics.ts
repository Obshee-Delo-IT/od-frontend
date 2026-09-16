/**
 * What a film is *about* — the subject axis, orthogonal to the catalogue's five
 * categories.
 *
 * Nine of them. «История и патриотизм» was a tenth and was dropped on
 * 2026-09-12: the five films under it were old clips, and the two worth keeping
 * («Почему князь Владимир выбрал Христианство?», «История трезвеннических
 * движений») are carried by «Вера» and «Алкоголь» anyway. The term stays in
 * WordPress rather than being re-used for something else — a tag whose name no
 * longer matches its films is worse than an unused one — and on od-wp, which
 * ran the task after the drop, it was never created at all.
 *
 * The categories say what a film *is* (фильм, мультфильм, ролик,
 * короткометражный, известные люди) and never what it is about, which is the
 * gap two reviewers reported independently in August 2026: a teacher wants *the
 * film about smoking*, not the newest film. These nine tags are that axis.
 *
 * Values are the WordPress **slugs**, and the term ids are looked up from them
 * (`shared/api/termIds.ts`) — the same move, and for the same reason, as
 * {@link FILM_CATEGORY_SLUGS}: an id is whatever the install that created the
 * term handed out, so the ids `tag-film-topics` produced on od-stage are one
 * apart from the ids the same task produced on od-wp, and a build carrying one
 * set served the other tier «Наркотики» films under «Манипуляция» and nothing
 * at all under «Гаджеты» (2026-09-16). `wp/scripts/od-wp.php`'s
 * `tag-film-topics` task creates the terms; `od_wp_film_topics()` there is the
 * film-to-topic assignment itself.
 *
 * «Алкоголь» and «Табак» are the two that pre-date the task — they were sitting
 * on the install with no posts on them, so it reuses them, which is why their
 * slugs are WordPress's percent-encoded transliteration of a Russian name
 * rather than the latin slugs the task writes. Those two are `%d0%b0%d0%bb…` on
 * every tier, and renaming them would move the `/tag/…/` archive the old site
 * still answers for, so they stay as WordPress spelled them.
 *
 * **Ordinary tags, not a taxonomy of their own.** The install carries 384 tags,
 * ten years of one-off keywords, and nothing queries them; reading exactly these
 * nine slugs is what makes them a filter, the same way {@link FILM_CATEGORY_SLUGS}
 * reads five category slugs out of a much larger tree.
 *
 * Declaration order is the order of the chips. It is deliberate rather than
 * alphabetical or by size: the three substances first, because that is what the
 * organisation is about and the order the request itself named them in
 * («алкоголь, никотин, наркотики, мотивация»).
 */
export const FILM_TOPICS = {
  alcohol: '%d0%b0%d0%bb%d0%ba%d0%be%d0%b3%d0%be%d0%bb%d1%8c',
  tobacco: '%d1%82%d0%b0%d0%b1%d0%b0%d0%ba',
  drugs: 'drugs',
  manipulation: 'manipulation',
  family: 'family',
  meaning: 'meaning',
  health: 'health',
  faith: 'faith',
  gadgets: 'gadgets',
} as const;

export type FilmTopicKey = keyof typeof FILM_TOPICS;

/**
 * Chip wording — one word wherever one word will do.
 *
 * **Deliberately shorter than the WordPress term names** («Манипуляция и
 * реклама», «Семья и отношения», «История и патриотизм», «Вера и традиция»,
 * «Гаджеты и игры»), which stay as they are: those name the tag for an editor
 * looking at a list of 384 of them, where the qualifier earns its place. Here
 * nine of them stand side by side under the heading «Тема», the context does the
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
 * **The normalising is the point, not tidiness.** Nine topics are 511 possible
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
