import { describe, expect, it } from 'vitest';
import { toInternalHref } from './toInternalHref';

const ORIGINS = ['https://od-dev.tmweb.ru', 'https://obshee-delo.ru'];

describe('toInternalHref', () => {
  it('strips the WordPress origin so nav links stay on this site', () => {
    expect(toInternalHref('https://od-dev.tmweb.ru/video/', ORIGINS)).toBe('/video/');
  });

  it('strips our own public origin too', () => {
    expect(toInternalHref('https://obshee-delo.ru/news/', ORIGINS)).toBe('/news/');
  });

  it('keeps query and hash', () => {
    expect(toInternalHref('https://od-dev.tmweb.ru/news/?category=articles#top', ORIGINS)).toBe(
      '/news/?category=articles#top'
    );
  });

  it('leaves genuinely external links alone', () => {
    expect(toInternalHref('https://pro.obshee-delo.ru', ORIGINS)).toBe('https://pro.obshee-delo.ru');
    expect(toInternalHref('http://od1.reformal.ru/', ORIGINS)).toBe('http://od1.reformal.ru/');
  });

  it('passes relative paths through untouched', () => {
    expect(toInternalHref('/materials/', ORIGINS)).toBe('/materials/');
    expect(toInternalHref('#anchor', ORIGINS)).toBe('#anchor');
  });

  it('matches on origin, not on a prefix of the host', () => {
    expect(toInternalHref('https://od-dev.tmweb.ru.evil.test/phish/', ORIGINS)).toBe(
      'https://od-dev.tmweb.ru.evil.test/phish/'
    );
  });

  it('survives an empty or unparseable origin list', () => {
    expect(toInternalHref('https://od-dev.tmweb.ru/video/', [])).toBe('https://od-dev.tmweb.ru/video/');
    expect(toInternalHref('https://od-dev.tmweb.ru/video/', ['', 'not a url'])).toBe('https://od-dev.tmweb.ru/video/');
  });

  it('returns the input when it is empty', () => {
    expect(toInternalHref('', ORIGINS)).toBe('');
  });
});
