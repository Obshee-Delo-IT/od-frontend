import { describe, expect, it } from 'vitest';
import { resolveNavOverride, SHOW_PRO_IN_NAV } from './navOverrides';

const PRO_HREF = 'https://pro.obshee-delo.ru/';

describe('resolveNavOverride', () => {
  // The addresses «ОБЩЕЕДЕЛО-ПРО» actually carries, one per WordPress install.
  // Dropping any of them is a silent regression rather than a failure: the
  // override stops matching, and the entry returns to the header with its
  // uncorrected URL. All four were verified against live data on 2026-08-13.
  const spellings = [
    ['od-dev stores', 'https://общеедело-про.рф'],
    ['od-dev stores, as Punycode', 'https://xn----9sbjdab6bsgbkm2i.xn--p1ai/'],
    ['prod stores', 'https://od-pro.ru/'],
    ['the property answers on', PRO_HREF],
  ] as const;

  spellings.forEach(([label, url]) => {
    it(`corrects and hides the address ${label}`, () => {
      expect(resolveNavOverride(url)).toMatchObject({ href: PRO_HREF, hidden: true });
    });
  });

  it('matches on host alone, ignoring scheme case, path and query', () => {
    expect(resolveNavOverride('HTTP://OD-PRO.RU/contest/?utm_source=header')?.href).toBe(PRO_HREF);
  });

  it('leaves every other destination alone', () => {
    expect(resolveNavOverride('https://od-dev.tmweb.ru/video/')).toBeUndefined();
    expect(resolveNavOverride('https://obshee-delo.ru/news/')).toBeUndefined();
    // A sibling subdomain is not the PRO one; only exact hosts match.
    expect(resolveNavOverride('https://reg.pro.obshee-delo.ru/')).toBeUndefined();
    expect(resolveNavOverride('/materials/')).toBeUndefined();
    expect(resolveNavOverride('mailto:info@obshee-delo.ru')).toBeUndefined();
    expect(resolveNavOverride('')).toBeUndefined();
  });
});

describe('SHOW_PRO_IN_NAV', () => {
  it('is the single switch behind the hiding', () => {
    expect(resolveNavOverride(PRO_HREF)?.hidden).toBe(!SHOW_PRO_IN_NAV);
  });
});
