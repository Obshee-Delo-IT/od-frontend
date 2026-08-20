import { describe, expect, it } from 'vitest';
import { collectProfileHrefs, collectQueryCardProfileHrefs, profileSlug } from './profileLinks';

/** The encoded Cyrillic shape WordPress stores 67 of the 139 profile slugs in. */
const ENCODED = '/profile/%d0%b3%d0%be%d1%80%d0%b4%d0%b8%d0%ba%d0%be%d0%b2%d0%b0-%d0%b5%d0%ba%d0%b0%d1%82/';

describe('collectProfileHrefs', () => {
  it('finds a profile link, in either quote style', () => {
    expect(collectProfileHrefs(`<p><a href="${ENCODED}">Андрей Рязанов</a></p>`)).toEqual([ENCODED]);
    expect(collectProfileHrefs(`<p><a href='${ENCODED}'>А</a></p>`)).toEqual([ENCODED]);
  });

  it('keeps document order and drops a repeat', () => {
    const html = `<a href="/profile/b/">b</a><a href="/profile/a/">a</a><a href="/profile/b/">b</a>`;
    expect(collectProfileHrefs(html)).toEqual(['/profile/b/', '/profile/a/']);
  });

  it('ignores other links and an absolute one — bodies are run through resolveContentLinks first', () => {
    const html = '<a href="/materials/">м</a><a href="https://other.example/profile/x/">x</a>';
    expect(collectProfileHrefs(html)).toEqual([]);
  });

  it('caps the fan-out at 16 — the input is editor-controlled and each one is a WP request', () => {
    const html = Array.from({ length: 20 }, (_, i) => `<a href="/profile/p${i}/">p</a>`).join('');
    expect(collectProfileHrefs(html)).toHaveLength(16);
  });

  it('clears /team/, the page that needs the most — 11 links, none dropped', () => {
    const html = Array.from({ length: 11 }, (_, i) => `<p><a href="/profile/p${i}/">p</a></p>`).join('');
    expect(collectProfileHrefs(html)).toHaveLength(11);
  });

  it('answers for an empty body', () => {
    expect(collectProfileHrefs(undefined)).toEqual([]);
    expect(collectProfileHrefs('')).toEqual([]);
  });
});

describe('profileSlug', () => {
  it('takes the last segment and leaves it encoded', () => {
    expect(profileSlug(ENCODED)).toBe(
      '%d0%b3%d0%be%d1%80%d0%b4%d0%b8%d0%ba%d0%be%d0%b2%d0%b0-%d0%b5%d0%ba%d0%b0%d1%82'
    );
  });

  it('works without the trailing slash', () => {
    expect(profileSlug('/profile/tikhomirov-sv')).toBe('tikhomirov-sv');
  });

  it('yields the id for an id-shaped link, which then matches no slug', () => {
    expect(profileSlug('/profile/28087/')).toBe('28087');
  });
});

describe('collectQueryCardProfileHrefs', () => {
  /** What a `wp:query` teaser on a regional `/contacts/<region>/` page renders. */
  const card = (href: string) => `<li class="wp-block-post post-41337 profile">
      <figure class="wp-block-post-featured-image"><a href="${href}"><img src="/p.jpg" alt=""/></a></figure>
      <h2 class="wp-block-post-title"><a href="${href}">Титова Ирина</a></h2>
    </li>`;

  it('finds the profile a card addresses, once', () => {
    expect([...collectQueryCardProfileHrefs(card('/profile/titova/'))]).toEqual(['/profile/titova/']);
  });

  it('finds one per card', () => {
    const html = `<ul class="wp-block-post-template">${card('/profile/a/')}${card('/profile/b/')}</ul>`;

    expect([...collectQueryCardProfileHrefs(html)]).toEqual(['/profile/a/', '/profile/b/']);
  });

  it('ignores a link that is not in a card', () => {
    expect(collectQueryCardProfileHrefs('<p><a href="/profile/a/">А</a></p>').size).toBe(0);
    // `wp-block-post-title` contains `wp-block-post` as a substring; the class
    // list is compared whole.
    expect(collectQueryCardProfileHrefs('<li class="wp-block-post-title"><a href="/profile/a/">А</a></li>').size).toBe(
      0
    );
  });

  it('handles an empty body', () => {
    expect(collectQueryCardProfileHrefs().size).toBe(0);
  });
});
