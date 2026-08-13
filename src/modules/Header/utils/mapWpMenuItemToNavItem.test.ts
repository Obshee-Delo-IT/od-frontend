import { describe, expect, it } from 'vitest';
import { SourceNavItem } from '../types';
import { mapWpMenuItemToNavItem } from './mapWpMenuItemToNavItem';

const wpItem = (url: string): SourceNavItem => ({ id: 1, parent: 0, url, title: { rendered: 'Пункт' } });

describe('mapWpMenuItemToNavItem', () => {
  it('keeps the WordPress URL when nothing overrides it', () => {
    expect(mapWpMenuItemToNavItem(wpItem('https://od-pro.example/')).href).toBe('https://od-pro.example/');
  });

  it('substitutes the corrected destination from navOverrides', () => {
    // The entry is hidden from the nav today, so this is the only place the
    // corrected href is observable — and the reason it is worth asserting.
    expect(mapWpMenuItemToNavItem(wpItem('https://общеедело-про.рф')).href).toBe('https://pro.obshee-delo.ru/');
  });

  it('still resolves an override that points back at this site', () => {
    expect(mapWpMenuItemToNavItem(wpItem('https://общеедело-про.рф'), ['https://pro.obshee-delo.ru']).href).toBe('/');
  });
});
