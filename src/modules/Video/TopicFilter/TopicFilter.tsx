import { FILM_TOPIC_KEYS, FILM_TOPIC_LABELS, type FilmTopicKey, toggleFilmTopic } from '@/shared/config/filmTopics';
import { FilterChips } from '@/shared/ui/components/FilterChips';

interface TopicFilterProps {
  selected: FilmTopicKey[];
  /** The catalogue address for a given selection — page 1, same category. */
  buildHref: (topics: FilmTopicKey[]) => string;
  className?: string;
}

/**
 * The subject filter: ten chips, any number of them on at once.
 *
 * Each chip links to the selection it would produce ({@link toggleFilmTopic}),
 * so «выбрать несколько» costs no client state — clicking a second topic adds
 * it, clicking it again takes it back out, and every intermediate selection is
 * a shareable URL.
 *
 * WordPress OR-matches `tags`, so two topics widen the result rather than
 * narrowing it: «Алкоголь + Табак» is every film about either, which is what a
 * teacher preparing a lesson on substances actually wants. Narrowing is what
 * the category above it does, and the two combine — `/video/multy/?topic=alcohol`
 * is the cartoons about alcohol.
 *
 * «Все темы» is the reset, and it is the active chip when nothing is selected —
 * the same shape as the «Все» chip on `/news/`.
 *
 * The caption is visible rather than only an `aria-label`, and it says «можно
 * выбрать несколько» in so many words: on a phone this row sits directly under
 * the category row, and two unlabelled strips of chips read as one wall of
 * buttons with no way to tell which question either of them answers.
 */
export const TopicFilter: React.FC<TopicFilterProps> = ({ selected, buildHref, className }) => (
  <FilterChips
    label="Тема — можно выбрать несколько"
    caption="Тема — можно выбрать несколько"
    size="small"
    className={className}
    chips={[
      { label: 'Все темы', href: buildHref([]), active: selected.length === 0 },
      ...FILM_TOPIC_KEYS.map((key) => ({
        label: FILM_TOPIC_LABELS[key],
        href: buildHref(toggleFilmTopic(selected, key)),
        active: selected.includes(key),
      })),
    ]}
  />
);
