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

    /**
     * A `wp:query` teaser renders the same post link twice — once inside the
     * featured image's `<figure>`, once inside the title's `<h3>` — so the card
     * is swapped at the `<li>`, **once**, and never at an anchor. The regional
     * `/contacts/<region>/` pages are shaped exactly like this: their
     * coordinators come out of a `pl-categs` query, so no page body names them.
     */
    it('swaps a wp:query card for the card its link names, exactly once', () => {
      const teaser = `<li class="wp-block-post">
        <figure class="wp-block-post-featured-image"><a href="/profile/ryazanov/"><img src="/p.jpg" alt=""/></a></figure>
        <h3 class="wp-block-post-title"><a href="/profile/ryazanov/">Андрей Рязанов</a></h3>
      </li>`;
      const { body } = parsePost(teaser, { liftHeader: false, embeds });

      const { container } = render(<ul>{body}</ul>);
      expect(screen.getAllByText('карточка')).toHaveLength(1);
      // Both halves of the teaser go with it — image link and title link alike.
      expect(screen.queryAllByRole('link')).toHaveLength(0);
      // The list item survives as a list item, and marked for the grid override.
      expect(container.querySelectorAll('li.od-person')).toHaveLength(1);
    });

    it('leaves a query card whose link has no embed waiting alone', () => {
      const teaser = `<li class="wp-block-post">
        <h3 class="wp-block-post-title"><a href="/profile/someone-else/">Кто-то</a></h3>
      </li>`;
      const { body } = parsePost(teaser, { liftHeader: false, embeds });

      render(<ul>{body}</ul>);
      expect(screen.getByRole('link', { name: 'Кто-то' })).toBeInTheDocument();
    });

    /** `wp-block-post-title` contains `wp-block-post`; only the `<li>` is a card. */
    it('does not read a title wrapper as the card', () => {
      const { body } = parsePost('<h3 class="wp-block-post-title"><a href="/profile/ryazanov/">А</a></h3>', {
        liftHeader: false,
        embeds,
      });

      render(<div>{body}</div>);
      expect(screen.getByRole('link', { name: 'А' })).toBeInTheDocument();
      expect(screen.queryByText('карточка')).toBeNull();
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
