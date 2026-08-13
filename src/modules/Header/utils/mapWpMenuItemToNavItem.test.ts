import { describe, expect, it } from 'vitest';
import { SourceNavItem } from '../types';
import { mapWpMenuItemToNavItem } from './mapWpMenuItemToNavItem';

const wpItem = (url: string): SourceNavItem => ({ id: 1, parent: 0, url, title: { rendered: 'Пункт' } });

describe('mapWpMenuItemToNavItem', () => {
  it('leaves an external destination as WordPress stores it', () => {
    expect(mapWpMenuItemToNavItem(wpItem('https://pro.obshee-delo.ru/')).href).toBe('https://pro.obshee-delo.ru/');
  });

  it('strips our own origin down to a path', () => {
    expect(mapWpMenuItemToNavItem(wpItem('https://obshee-delo.ru/news/'), ['https://obshee-delo.ru']).href).toBe(
      '/news/'
    );
  });

  it('does not mistake a sibling subdomain for this site', () => {
    // `pro.obshee-delo.ru` shares a registrable domain with SITE_URL, so a
    // suffix test would strip it to `/` and send visitors to our own home page.
    expect(mapWpMenuItemToNavItem(wpItem('https://pro.obshee-delo.ru/'), ['https://obshee-delo.ru']).href).toBe(
      'https://pro.obshee-delo.ru/'
    );
  });
});
