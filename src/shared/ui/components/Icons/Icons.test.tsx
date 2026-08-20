import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchIcon } from './index';

/**
 * The `aria-hidden` default lives in the svgr loader config (`next.config.ts`,
 * mirrored in `vitest.config.ts`), not in these wrappers — so it is worth one
 * check that it survives the pipeline, and one that a call site can still undo
 * it. The second is what makes the app-wide default safe: it depends on svgr
 * spreading the caller's props *after* its own.
 */
describe('icon components', () => {
  it('hides the glyph from the accessibility tree by default', () => {
    const { container } = render(<SearchIcon />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lets a call site opt back in', () => {
    const { container } = render(<SearchIcon aria-hidden={false} role="img" aria-label="Поиск" />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'false');
  });
});
