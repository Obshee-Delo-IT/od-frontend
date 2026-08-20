import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUSSIA_MAP_REGIONS } from './regions.generated';
import { RussiaMap } from './RussiaMap';

/**
 * The 74 published children of page 529 plus `/khabarovskiy/`, which sits at the
 * WordPress root. Written out rather than derived from the generated table,
 * because the thing worth catching is a *generated* href that no page answers
 * for — checking the table against itself would catch nothing.
 *
 * Refresh from `node --env-file=.env scripts/generate-russia-map.mjs`, which
 * fails rather than emitting an href outside this set.
 */
const REGION_PAGES = new Set([
  '/khabarovskiy/',
  ...[
    'alaniya',
    'altayskiy-kray',
    'amurskaya',
    'arkhangelskaya',
    'astrakhanskaya',
    'bashkortostan',
    'belarus',
    'belgorodskaya',
    'bryanskaya',
    'buryatiya',
    'chechnya',
    'chelyabinskaya',
    'chukotskiy-ao',
    'chuvashiya',
    'dnr',
    'evreiskaya-ao',
    'hanty-mansiyskiy-ao',
    'irkutskaya',
    'ivanovskaya',
    'kalmykiya',
    'kalujskaya',
    'kamchatskiy-kray',
    'karelia',
    'kemerovo',
    'khakasiya',
    'kirovskaya',
    'komi',
    'kostromskaya',
    'krasnodarskiy-kray',
    'krasnoyarskiy-kray',
    'krym',
    'kurskaya',
    'lnr',
    'magadanskaya',
    'mordoviya',
    'moscow',
    'moscow-oblast',
    'murmanskaya',
    'nizegorodskaya',
    'novgorodskaya',
    'novosibirskaya',
    'omskaya',
    'orenburgskaya',
    'orlovskaya',
    'penzenskaya',
    'permskiy-kray',
    'primorskiy-kray',
    'pskovskaya',
    'rostovskaya',
    'ryazanskaya',
    'sakhalinskaya',
    'samarskaya',
    'smolenskaya',
    'st-petersburg',
    'stavropolskiy-kray',
    'sverdlovskaya',
    'tambovskaya',
    'tatarstan',
    'tomskaya',
    'tulskaya',
    'tverskaya',
    'tyumenskaya',
    'tyva',
    'udmurtiya',
    'ukraine',
    'uliyanovskaya',
    'vladimirskaya',
    'volgogradskaya',
    'vologodskaya',
    'voronejskaya',
    'yakutiya',
    'yamalo-nenetskiy-ao',
    'yaroslavskaya',
    'zabaikalskiy-kray',
  ].map((slug) => `/contacts/${slug}/`),
]);

const linked = RUSSIA_MAP_REGIONS.filter(({ href }) => href);

describe('<RussiaMap />', () => {
  it('links every region to a page that exists', () => {
    const dead = linked.map(({ href }) => href).filter((href) => !REGION_PAGES.has(href as string));

    expect(dead).toEqual([]);
  });

  it('renders one anchor per linked region, named after the region', () => {
    render(<RussiaMap />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(linked.length);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(linked.map(({ href }) => href));
    // A real href, not a JS handler: middle-click has to give a URL.
    links.forEach((link) => expect(link.getAttribute('href')).toMatch(/^\/[\w-]+\//));
    expect(screen.getByRole('link', { name: 'Амурская область' })).toHaveAttribute('href', '/contacts/amurskaya/');
  });

  /* The map has to say which regions it can take you to: twelve have no page, and
     a uniform silhouette would offer a click that does not exist. The old page
     drew the same distinction with jqvmap's `selectRegion`. */
  it('greys the regions with no page, and only those', () => {
    const { container } = render(<RussiaMap />);

    const unlinked = container.querySelectorAll('path.unlinked');
    expect(unlinked).toHaveLength(RUSSIA_MAP_REGIONS.length - linked.length);
    expect(container.querySelectorAll('a path.unlinked')).toHaveLength(0);
  });

  it('draws every region, linked or not, and ships no script', () => {
    const { container } = render(<RussiaMap />);

    expect(container.querySelectorAll('path')).toHaveLength(RUSSIA_MAP_REGIONS.length);
    expect(container.querySelectorAll('script')).toHaveLength(0);
    // Cropped to the drawn continent, not the plugin's declared 990×593 — see
    // `VIEW_BOX` in the generator for the 116 units of empty space that removes.
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '4 51 983 481');
  });

  /* The point of the rebuild: the old map was 100 % client JavaScript. A
     `'use client'` here would send 150 KiB of path data down as an RSC payload
     *and* as a client chunk, for behaviour an `<a href>` already has. */
  it('stays a Server Component', () => {
    const source = fs.readFileSync(path.join(import.meta.dirname, 'RussiaMap.tsx'), 'utf8');

    expect(source).not.toMatch(/['"]use client['"]/);
  });

  it('gives every linked region a <title> for the native tooltip', () => {
    const { container } = render(<RussiaMap />);

    expect(container.querySelectorAll('a > title')).toHaveLength(linked.length);
  });
});
