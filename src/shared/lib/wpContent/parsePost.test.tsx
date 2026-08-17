import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parsePost } from './parsePost';

/** A gallery as an editor leaves it on a page: inside a column, next to text. */
const GALLERY_IN_A_COLUMN = `<div class="wp-block-column">
  <p>подпись под галереей</p>
  <figure class="wp-block-gallery"><img src="/a.jpg" alt="фото" /></figure>
</div>`;

describe('parsePost', () => {
  it('lifts a gallery into the header slot — and takes its parent with it', () => {
    const { header, body } = parsePost(GALLERY_IN_A_COLUMN);

    expect(header).toBeTruthy();
    render(<div>{body}</div>);
    // The sibling paragraph goes with the column. This is why `WpPage` opts out.
    expect(screen.queryByText('подпись под галереей')).toBeNull();
  });

  it('leaves the body whole when the lift is off', () => {
    const { header, body } = parsePost(GALLERY_IN_A_COLUMN, { liftHeader: false });

    expect(header).toBe('');
    render(<div>{body}</div>);
    expect(screen.getByText('подпись под галереей')).toBeInTheDocument();
    expect(screen.getByAltText('фото')).toBeInTheDocument();
  });

  describe('embeds', () => {
    const embeds = new Map([['/profile/ryazanov/', <span key="k">карточка</span>]]);

    it('replaces the paragraph a marked link is alone in, wrapper and all', () => {
      const { body } = parsePost('<p><a href="/profile/ryazanov/">Андрей Рязанов</a></p>', { embeds });

      const { container } = render(<div>{body}</div>);
      expect(screen.getByText('карточка')).toBeInTheDocument();
      expect(screen.queryByRole('link')).toBeNull();
      // The `<p>` has to go with it: `<article>` inside `<p>` is re-parsed by the
      // browser into something else and hydration then fails.
      expect(container.querySelector('p')).toBeNull();
    });

    it('leaves a link that shares its paragraph with words', () => {
      const { body } = parsePost('<p>Пишите <a href="/profile/ryazanov/">Андрею</a> напрямую.</p>', { embeds });

      render(<div>{body}</div>);
      expect(screen.getByRole('link', { name: 'Андрею' })).toBeInTheDocument();
      expect(screen.queryByText('карточка')).toBeNull();
    });

    it('leaves a link with no embed waiting for it', () => {
      const { body } = parsePost('<p><a href="/profile/someone-else/">Кто-то</a></p>', { embeds });

      render(<div>{body}</div>);
      expect(screen.getByRole('link', { name: 'Кто-то' })).toBeInTheDocument();
    });

    it('is not fooled by a content href that names an Object.prototype key', () => {
      const { body } = parsePost('<p><a href="__proto__">н</a></p>', { embeds });

      render(<div>{body}</div>);
      expect(screen.getByRole('link', { name: 'н' })).toBeInTheDocument();
    });

    it('ignores the whitespace WordPress leaves around the link', () => {
      const { body } = parsePost('<p>\n  <a href="/profile/ryazanov/">А</a>\n</p>', { embeds });

      render(<div>{body}</div>);
      expect(screen.getByText('карточка')).toBeInTheDocument();
    });
  });
});
