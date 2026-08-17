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
});
