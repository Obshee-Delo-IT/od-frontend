/**
 * Export the film catalogue to a CSV data-entry worksheet.
 *
 *   pnpm film:export                     # → .scratch/film-worksheet.csv
 *   pnpm film:export -- --out sheet.csv --delimiter ';' --all
 *
 * Every `group_film_meta` column is pre-filled with the value WordPress holds
 * today, so the sheet is a faithful mirror: an editor fills the blanks and
 * `pnpm film:import` writes back only what changed.
 *
 * Candidates mined from the legacy post body land in `hint_*` columns and are
 * NEVER pre-filled into the ACF columns — body parsing isn't reliable enough to
 * become canonical data unattended (that's why ACF exists). A human promotes a
 * hint by copying it into the real column.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readArgs } from './lib/args.mjs';
import { stringifyCsv } from './lib/csv.mjs';
import {
  ACF_FIELDS,
  FILM_CATEGORY_IDS,
  FILM_CATEGORY_NAMES,
  fetchAllFilms,
  plainText,
  readEnv,
} from './lib/wp.mjs';

const HINT_COLUMNS = ['hint_body_youtube', 'hint_body_rutube', 'hint_body_downloads', 'hint_featured_image'];
const META_COLUMNS = ['id', 'title', 'category', 'wp_link'];

const OPTIONS = {
  out: { type: 'string', default: '.scratch/film-worksheet.csv' },
  delimiter: { type: 'string', default: ',' },
  all: { type: 'boolean', default: false },
};

/** Links to a video host or a download, harvested from the rendered body. */
const mineBody = (html = '') => {
  const urls = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map((match) => match[1]);
  const unique = (list) => [...new Set(list)];

  return {
    // A bare channel/profile URL is not a video — require a video-ish path.
    hint_body_youtube: unique(urls.filter((url) => /youtu\.be\/|youtube\.com\/(watch|embed|shorts)/.test(url))),
    hint_body_rutube: unique(urls.filter((url) => /rutube\.ru\/video/.test(url))),
    hint_body_downloads: unique(urls.filter((url) => /disk\.yandex|yadi\.sk/.test(url))),
  };
};

const main = async () => {
  const args = readArgs(OPTIONS);
  const env = readEnv();

  const films = await fetchAllFilms(env, {
    categories: args.all ? [] : FILM_CATEGORY_IDS,
    fields: ['id', 'title', 'link', 'categories', 'acf', 'content', 'date', 'featured_media'],
  });

  // Newest first, mirroring the catalogue order editors see on /video.
  films.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

  const header = [...META_COLUMNS, ...ACF_FIELDS, ...HINT_COLUMNS];
  const rows = films.map((film) => {
    const acf = film.acf ?? {};
    const hints = mineBody(film.content?.rendered);
    const category = (film.categories ?? []).map((id) => FILM_CATEGORY_NAMES[id]).find(Boolean) ?? '—';

    return [
      film.id,
      plainText(film.title?.rendered),
      category,
      film.link ?? '',
      ...ACF_FIELDS.map((field) => acf[field] ?? ''),
      hints.hint_body_youtube.join(' | '),
      hints.hint_body_rutube.join(' | '),
      hints.hint_body_downloads.join(' | '),
      film.featured_media ? 'yes' : '',
    ];
  });

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, stringifyCsv([header, ...rows], { delimiter: args.delimiter }));

  const filled = (field) => films.filter((film) => String(film.acf?.[field] ?? '').trim() !== '').length;
  const withDownload = films.filter((film) =>
    Array.from({ length: 5 }, (_, i) => film.acf?.[`download_${i + 1}_url`]).some((url) => String(url ?? '').trim())
  ).length;

  console.log(`Wrote ${films.length} films → ${args.out}`);
  console.log('Currently populated:');
  console.log(`  kinescope_id        ${filled('kinescope_id')}`);
  console.log(`  watch_url           ${filled('watch_url')}`);
  console.log(`  poster_image_url    ${filled('poster_image_url')}`);
  console.log(`  share_* (any)       ${films.filter((f) => ['share_vk', 'share_youtube', 'share_rutube'].some((k) => String(f.acf?.[k] ?? '').trim())).length}`);
  console.log(`  download_N_url      ${withDownload}`);
};

await main();
