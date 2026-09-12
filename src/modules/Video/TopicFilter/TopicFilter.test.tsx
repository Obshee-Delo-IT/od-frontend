import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { catalogueHref } from '@/shared/config/filmCategories';
import { FILM_TOPIC_KEYS, type FilmTopicKey } from '@/shared/config/filmTopics';
import { TopicFilter } from './TopicFilter';

const buildHref = (topics: FilmTopicKey[]) => catalogueHref({ segment: 'multy', topics });

const renderWith = (selected: FilmTopicKey[]) => render(<TopicFilter selected={selected} buildHref={buildHref} />);

const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href') ?? '';

/* What this component decides is which topics end up in a chip's link. The URL
   those topics are written into belongs to `catalogueHref` and is tested there —
   and has to be read off the query here rather than the whole href, because
   `next/link` normalises the trailing slash against a `trailingSlash` setting
   that the test environment does not load. */
const queryOf = (name: string) => hrefOf(name).split('?')[1] ?? '';

describe('<TopicFilter />', () => {
  it('renders «Все темы» plus a chip per topic', () => {
    renderWith([]);

    expect(screen.getAllByRole('link')).toHaveLength(FILM_TOPIC_KEYS.length + 1);
    expect(queryOf('Все темы')).toBe('');
    expect(queryOf('Алкоголь')).toBe('topic=alcohol');
    expect(hrefOf('Алкоголь').split('?')[0]).toMatch(/^\/video\/multy\/?$/);
  });

  it('adds to the selection rather than replacing it — this is the multi-select', () => {
    renderWith(['alcohol']);

    expect(queryOf('Табак')).toBe('topic=alcohol,tobacco');
    expect(queryOf('Наркотики')).toBe('topic=alcohol,drugs');
  });

  it('takes a selected topic back out when its own chip is followed', () => {
    renderWith(['alcohol', 'tobacco']);

    expect(queryOf('Алкоголь')).toBe('topic=tobacco');
    expect(queryOf('Табак')).toBe('topic=alcohol');
  });

  it('flags every selected chip, not just one', () => {
    renderWith(['alcohol', 'tobacco']);

    expect(screen.getByRole('link', { name: 'Алкоголь' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Табак' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Наркотики' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Все темы' })).not.toHaveAttribute('aria-current');
  });

  it('makes «Все темы» the active chip when nothing is chosen, and the reset when something is', () => {
    const { unmount } = renderWith([]);
    expect(screen.getByRole('link', { name: 'Все темы' })).toHaveAttribute('aria-current', 'true');
    unmount();

    renderWith(['health', 'faith']);
    expect(queryOf('Все темы')).toBe('');
    expect(screen.getByRole('link', { name: 'Все темы' })).not.toHaveAttribute('aria-current');
  });

  it('drops the page when the selection changes, so a filter never lands past its own end', () => {
    // Narrowing from 40 films to 4 while on page 3 would 404 — the catalogue
    // treats a page past the end as `notFound()` (SEO-10).
    renderWith(['alcohol']);

    screen.getAllByRole('link').forEach((link) => {
      expect(link.getAttribute('href')).not.toContain('page=');
    });
  });

  it('says in visible words that it is a multi-select, and which question it answers', () => {
    // On a phone this row sits straight under the category row; without a
    // caption the two are one undifferentiated wall of buttons.
    renderWith([]);

    expect(screen.getByText('Тема — можно выбрать несколько')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /выбрать несколько/i })).toBeInTheDocument();
  });
});
