import { describe, expect, it } from 'vitest';
import { isNavItemActive } from './isNavItemActive';

describe('isNavItemActive', () => {
  it('matches the item whose section owns the current path', () => {
    expect(isNavItemActive('/video/', '/video/')).toBe(true);
    expect(isNavItemActive('/video/filmy/', '/video/')).toBe(true);
  });

  it('ignores a trailing slash on either side', () => {
    expect(isNavItemActive('/news', '/news/')).toBe(true);
    expect(isNavItemActive('/news/', '/news')).toBe(true);
  });

  it('does not match a sibling that merely shares a prefix', () => {
    expect(isNavItemActive('/videoteka/', '/video/')).toBe(false);
  });

  it('lights ГЛАВНАЯ only on the home page', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/news/', '/')).toBe(false);
  });

  it('never lights an external destination', () => {
    expect(isNavItemActive('/', 'https://общеедело-про.рф')).toBe(false);
  });

  it('ignores query and hash on the current path', () => {
    expect(isNavItemActive('/news/?category=articles', '/news/')).toBe(true);
  });

  it('leaves a bare post id unmatched — the URL carries no section', () => {
    expect(isNavItemActive('/28749/', '/video/')).toBe(false);
  });

  it('handles an empty href', () => {
    expect(isNavItemActive('/', '')).toBe(false);
  });
});
