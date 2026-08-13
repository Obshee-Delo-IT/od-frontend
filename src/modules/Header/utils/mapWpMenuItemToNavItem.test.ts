import { describe, expect, it } from 'vitest';
import { SourceNavItem } from '../types';
import { mapWpMenuItemToNavItem } from './mapWpMenuItemToNavItem';

const wpItem = (url: string): SourceNavItem => ({ id: 1, parent: 0, url, title: { rendered: 'Пункт' } });

const PRO_HREF = 'https://pro.obshee-delo.ru/';

describe('mapWpMenuItemToNavItem', () => {
  it('keeps the WordPress URL when nothing overrides it', () => {
    expect(mapWpMenuItemToNavItem(wpItem('https://external.example/')).href).toBe('https://external.example/');
  });

  // The entry is hidden from the nav today, so this is the only place the
  // corrected href is observable — and the reason it is worth asserting for
  // *each* install's spelling rather than just the one we develop against.
  it('substitutes the corrected destination for the address od-dev carries', () => {
    expect(mapWpMenuItemToNavItem(wpItem('https://общеедело-про.рф')).href).toBe(PRO_HREF);
  });

  it('substitutes it for the address prod carries too', () => {
    expect(mapWpMenuItemToNavItem(wpItem('https://od-pro.ru/')).href).toBe(PRO_HREF);
  });

  it('does not mistake the PRO subdomain for this site', () => {
    // `pro.obshee-delo.ru` shares a registrable domain with SITE_URL, so a
    // suffix test would strip the corrected href down to `/` and send visitors
    // to our own home page. Origins must compare exactly.
    expect(mapWpMenuItemToNavItem(wpItem('https://od-pro.ru/'), ['https://obshee-delo.ru']).href).toBe(PRO_HREF);
  });

  it('still resolves an override that points back at this site', () => {
    expect(mapWpMenuItemToNavItem(wpItem('https://общеедело-про.рф'), ['https://pro.obshee-delo.ru']).href).toBe('/');
  });
});
