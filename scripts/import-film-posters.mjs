/**
 * Fill `poster_image_url` — the artwork of the film page's poster card — from the
 * best source the site already holds, in priority order:
 *
 *   1. the плакат the editor supplied on Яндекс.Диск — either a file the film links
 *      to in `poster_download_url`, or a named file inside a folder, listed in
 *      {@link FOLDER_POSTERS} below; both get downloaded and uploaded, and a table
 *      entry also fills «Скачать плакат» when that field is empty;
 *   2. a плакат-named image already in the post body (the legacy vertical А2 art);
 *   3. the editor's featured image — the 16∶9 cover `/video/` draws.
 *
 *   pnpm film:posters                    # dry run
 *   pnpm film:posters -- --apply
 *   pnpm film:posters -- --apply --only 71770
 *
 * Why this exists: `FilmPosterCard` needs the *image*, and on the prod clone only
 * 22 of the 83 catalogue films have one, so most film pages draw no poster card at
 * all — while `/video/` shows a cover for the same film. Source 1 closes the gap
 * where «Скачать плакат» was filled but the artwork never was (the Telegram channel
 * gave the link, not the file); its metadata reads without a token, so the плакат is
 * already on the site in every sense except being in the library. Sources 2 and 3
 * fill the rest with what WordPress already has, which is also the point: the editor
 * then sees which films show a real vertical плакат and which a landscape cover, and
 * uploads the plакат where it matters.
 *
 * **A плакат is never overwritten.** A landscape cover written by source 3 *is* —
 * the value is recomputed every run, so a плакат that arrives later still wins.
 * A link that turns out not to be a web image is left alone (a TIFF or PDF plate is
 * a перепечатка master, not something a card can show), and an upload is reused when
 * the library already holds the same target filename, so a second run writes
 * nothing and says so. A body плакат served from the old Punycode domain is left
 * alone too: `extractFilmPoster` already draws it from the body, and a foreign host
 * has no business in the canonical field.
 *
 * **Sizes.** Sources 2 and 3 write the sized variant (`…-1024x576.jpg`) when
 * WordPress made one. The site strips `-WxH` before loading the file
 * (`toFullSizeImageUrl`) but reads it as the card's aspect ratio, so a landscape
 * cover renders as a landscape card instead of being cropped into the portrait А2
 * frame.
 *
 * It reads the catalogue over REST rather than the worksheet, because unlike the
 * rest of the `film:*` tooling nothing here is editorial — every pairing is the
 * film's own link, body or cover, not a judgement someone made in a spreadsheet.
 */

import { idSet, readArgs } from './lib/args.mjs';
import { fetchAllFilms, plainText, readEnv, wpFetch } from './lib/wp.mjs';

const OPTIONS = {
  apply: { type: 'boolean', default: false },
  only: { type: 'string' },
};

/** Yandex's public-resource API — no token, no account, just the share URL. */
const YANDEX_API = 'https://cloud-api.yandex.net/v1/disk/public/resources';

/** «Плакаты по фильмам» — the shared folder several films draw their плакат from. */
const POSTER_LIBRARY = 'https://disk.yandex.ru/d/3jRhHMui3TdiSi';

/** A readable, collision-proof media filename: `film-poster-<postId>.<ext>`. */
const targetFilename = (postId, type = 'image/jpeg') => `film-poster-${postId}.${WEB_IMAGES[type]}`;

/**
 * The types a card can actually show, mime → extension. A плакат link is often a
 * print master — TIFF, PDF, PSD — which WordPress refuses to store anyway, and
 * uploading one under a `.jpg` name (which is what this did until 2026-08-23)
 * makes the site serve a file whose bytes don't match its extension.
 */
const WEB_IMAGES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** JSON or null — WordPress answers a failed request with PHP's HTML, which `res.json()` throws on. */
const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const readJson = async (res) => parseJson(await res.text().catch(() => ''));

const IMG_SRC = /<img\b[^>]*\bsrc="([^"]+)"/gi;
/** WordPress's `name-WIDTHxHEIGHT.ext` variant suffix — two URLs of one upload differ only by it. */
const SIZED_VARIANT = /-\d+x\d+(?=\.\w+(?:[?#].*)?$)/;
/** Same test `extractFilmPoster` uses on the frontend, so both pick the same figure. */
const POSTER_NAME = /плакат|постер|plakat|poster/i;
/** Ratio-preserving WP variants, largest first — `thumbnail` is a square crop, so never it. */
const RATIO_SIZES = ['large', 'medium_large', 'medium'];

/**
 * Posters the editor supplied as Яндекс.Диск **folders** (Telegram, 2026-08-23):
 * film id → `[folder share link, path of the file to use inside it]`.
 *
 * A folder holds one плакат in six renditions — А2, квадрат, ютюб, PSD, TIFF, RAR —
 * so which file is the card's is a human call, not something to rank heuristically;
 * hence a table rather than a heuristic. `poster_download_url` stays free for the
 * single-file links it already holds, and a film that has an entry here needs no
 * link at all.
 *
 * An entry also supplies **«Скачать плакат»** when the film's `poster_download_url`
 * is empty: a deep link at the path the listing resolved, so the button matches the
 * films whose link the editor filled by hand. That fill happens even when the image
 * field already holds the плакат, which is how the seven films of 2026-08-23 got
 * their button on a second run.
 *
 * **Ids are prod's**, which od-stage shares as its clone. od-dev descends from the
 * same site, so its older posts carry the same ids and three of these entries match
 * there too — the same плакат for the same film, which is right; ids minted since the
 * fork simply don't match and fall through to the body/cover.
 *
 * Paths are matched **Unicode-normalised**: the folders were authored on macOS and
 * their names are NFD, so a typed NFC copy of the same name does not resolve.
 */
const FOLDER_POSTERS = {
  74794: ['https://disk.yandex.ru/d/r4FNKEDLkQkObA', 'sugar_attac_a2_full_res.jpg'],
  73381: ['https://disk.yandex.ru/d/e1Uff2osPRUA2A', 'Познавалов Бактерии а2.jpg'],
  19869: ['https://disk.yandex.ru/d/-sdTjV_A5TWOzw', 'Poster_02_RGB_high_res.jpg'],
  19871: [POSTER_LIBRARY, 'плакат и заглушка Алкоголь Секреты манипуляции /Poster_03_HighRes.jpg'],
  73084: [POSTER_LIBRARY, 'Плакат Алкоголь взгляд изнутри/alkohol_plakatA2.jpg'],
  19123: [POSTER_LIBRARY, 'Команда Познавалова плакаты/Плакат Тайна едкого дыма.jpg'],
  72705: [POSTER_LIBRARY, 'плакаты как найти призвание/knp1.jpg'],
};
// Deliberately absent: the library's `история одного обмана.png` (1509×663) and
// `почему же они курят.png` (3298×1878) are landscape banners, not плакаты — 19864
// and 34169 keep the featured cover, whose `-WxH` at least gives the card its own
// shape instead of cropping a wide image into the portrait А2 frame.

/** One listing page of a public folder; `path` is '' for the folder's own root. */
const yandexList = async (link, path) => {
  const query = `public_key=${encodeURIComponent(link)}&limit=200${path ? `&path=${encodeURIComponent(path)}` : ''}`;
  const res = await fetch(`${YANDEX_API}?${query}`);
  return res.ok ? ((await readJson(res))?._embedded?.items ?? []) : null;
};

/** A named file inside a public folder, walked segment by segment so NFD names resolve. */
const folderFile = async (link, spec) => {
  let path = '';
  for (const segment of spec.split('/')) {
    const items = await yandexList(link, path);
    if (!items) {
      return { error: `folder listing failed at «${segment}»` };
    }
    const hit = items.find((item) => item.name.normalize('NFC') === segment.normalize('NFC'));
    if (!hit) {
      return { error: `«${segment}» is not in the folder` };
    }
    path = hit.path;
    if (hit.type === 'file') {
      if (!WEB_IMAGES[hit.mime_type]) {
        return { error: `${hit.name} is not a web image (${hit.mime_type})` };
      }
      const hrefRes = await fetch(
        `${YANDEX_API}/download?public_key=${encodeURIComponent(link)}&path=${encodeURIComponent(path)}`
      );
      if (!hrefRes.ok) {
        return { error: `download link refused (${hrefRes.status})` };
      }
      return { name: hit.name, size: hit.size, type: hit.mime_type, path, href: (await readJson(hrefRes))?.href };
    }
  }
  return { error: `«${spec}» is a folder, not a file` };
};

/**
 * The public file behind a Яндекс.Диск share link: its name, type and a
 * download href. Two calls because the metadata endpoint does not return the
 * href and the download endpoint does not return the type — and the type is
 * what decides whether the file is usable at all.
 */
const yandexFile = async (shareUrl) => {
  const key = encodeURIComponent(shareUrl);
  const metaRes = await fetch(`${YANDEX_API}?public_key=${key}`);
  if (!metaRes.ok) {
    return { error: `Яндекс.Диск returned ${metaRes.status}` };
  }
  const meta = await metaRes.json();
  if (!WEB_IMAGES[meta.mime_type]) {
    return { error: `not a web image (${meta.mime_type ?? meta.type ?? 'unknown'})` };
  }

  const hrefRes = await fetch(`${YANDEX_API}/download?public_key=${key}`);
  if (!hrefRes.ok) {
    return { error: `download link refused (${hrefRes.status})` };
  }
  return { name: meta.name, size: meta.size, type: meta.mime_type, href: (await readJson(hrefRes))?.href };
};

/** Source 2: a плакат-named image in the body — already in the library, nothing to upload. */
const bodyPoster = (html = '') => {
  for (const [, src] of html.matchAll(IMG_SRC)) {
    if (POSTER_NAME.test(decodeURIComponent(src))) {
      return src;
    }
  }
  return null;
};

/**
 * The same URL under this install's own origin, or null when it lives elsewhere —
 * at least one плакат is still served from the old Punycode domain, and the
 * canonical field is not the place for a foreign host.
 */
const ownHostUrl = (src, base) => {
  if (src.startsWith('/')) {
    return `${base}${src}`;
  }
  return src.startsWith(`${base}/`) ? src : null;
};

/** The same upload, whichever sized variant each URL points at. */
const sameUpload = (a, b) => Boolean(a) && Boolean(b) && a.replace(SIZED_VARIANT, '') === b.replace(SIZED_VARIANT, '');

/** Source 3: the featured image, at its largest ratio-preserving variant. */
const featuredPoster = async (env, mediaId) => {
  if (!mediaId) {
    return null;
  }
  const res = await wpFetch(env, `/wp/v2/media/${mediaId}?_fields=source_url,media_details`);
  if (!res.ok) {
    return null;
  }
  const media = await res.json();
  const sizes = media.media_details?.sizes ?? {};
  const sized = RATIO_SIZES.map((size) => sizes[size]?.source_url).find(Boolean);
  return sized ?? media.source_url ?? null;
};

/** Upload the Яндекс.Диск file, reusing an earlier upload of the same target filename. */
const uploadPoster = async (env, postId, file) => {
  const filename = targetFilename(postId, file.type);
  const existingRes = await wpFetch(
    env,
    `/wp/v2/media?search=${encodeURIComponent(filename)}&per_page=1&_fields=id,slug,source_url`
  );
  const existing = (existingRes.ok && (await readJson(existingRes))) || [];
  const reused = existing.find((item) => item.slug === filename.replace(/\.\w+$/, ''));
  if (reused) {
    console.log(`  reusing existing media ${reused.id}`);
    return reused.source_url;
  }

  const download = await fetch(file.href);
  if (!download.ok) {
    console.log(`  ✗ download failed (${download.status})`);
    return null;
  }
  const upload = await wpFetch(env, '/wp/v2/media', {
    method: 'POST',
    headers: { 'Content-Type': file.type, 'Content-Disposition': `attachment; filename="${filename}"` },
    body: Buffer.from(await download.arrayBuffer()),
  });
  // Read the body as text first: a failed upload answers with PHP's HTML, and the
  // diagnostic is in it — `res.json()` would throw and take the whole batch down.
  const raw = await upload.text().catch(() => '');
  const media = upload.ok ? parseJson(raw) : null;
  if (!media?.source_url) {
    console.log(`  ✗ upload failed (${upload.status}): ${raw.replace(/\s+/g, ' ').slice(0, 160)}`);
    return null;
  }
  console.log(`  uploaded as media ${media.id}`);
  return media.source_url;
};

/** Write the given ACF fields and read them back — ACF silently ignores an unknown key. */
const writePoster = async (env, postId, fields) => {
  const write = await wpFetch(env, `/wp/v2/posts/${postId}`, {
    method: 'POST',
    body: JSON.stringify({ acf: fields }),
  });
  if (!write.ok) {
    console.log(`  ✗ could not write (${write.status}): ${(await write.text()).slice(0, 160)}`);
    return false;
  }
  const acf = (await readJson(write))?.acf ?? {};
  for (const [key, value] of Object.entries(fields)) {
    if ((acf[key] ?? '') !== value) {
      console.log(`  ✗ ${key} did not persist`);
      return false;
    }
    console.log(`  ${key} ← ${value}`);
  }
  return true;
};

const main = async () => {
  const args = readArgs(OPTIONS);
  const only = idSet(args.only);
  const env = readEnv();

  const films = (await fetchAllFilms(env, { fields: ['id', 'title', 'acf', 'content', 'featured_media'] })).filter(
    (film) => !only || only.has(String(film.id))
  );

  console.log(`${args.apply ? 'APPLY' : 'DRY RUN'} — ${films.length} film(s) in the catalogue\n`);

  let filled = 0;
  let skipped = 0;
  let failed = 0;

  for (const film of films) {
    const label = `${film.id} ${plainText(film.title?.rendered).slice(0, 45)}`;
    const current = (film.acf?.poster_image_url ?? '').trim();
    const link = (film.acf?.poster_download_url ?? '').trim();
    const body = bodyPoster(film.content?.rendered);
    const bodyUrl = body && ownHostUrl(body, env.base);

    const featured = await featuredPoster(env, film.featured_media);

    // A filled image field is left alone unless it holds the plain featured cover: a
    // плакат — the editor's, one this script uploaded, or the one in the body — is
    // already the best source there is, and re-running source 1 over it would upload
    // the same artwork a second time. Compared ignoring the `-WxH` variant suffix,
    // since the field and the body routinely point at two sizes of one upload.
    const chosen = FOLDER_POSTERS[film.id];
    const needsImage = !current || sameUpload(current, featured);
    // A table film also gets «Скачать плакат», which its `poster_download_url` never
    // held: a deep link at the path the listing resolved, so the button matches the
    // films whose link the editor filled by hand.
    const needsLink = Boolean(chosen) && !link;
    if (!needsImage && !needsLink) {
      skipped += 1;
      continue;
    }

    if (chosen || (needsImage && link)) {
      const file = chosen ? await folderFile(chosen[0], chosen[1]) : await yandexFile(link);
      if (file.error) {
        console.log(`· ${label} — плакат ${chosen ? 'folder' : 'link'}: ${file.error}`);
      } else {
        const fields = {};
        if (needsImage) {
          fields.poster_image_url = null; // filled from the upload below
        }
        if (needsLink) {
          fields.poster_download_url = `${chosen[0]}?path=${encodeURIComponent(file.path)}`;
        }
        const what = needsImage ? `плакат ${file.name} (${Math.round(file.size / 1024)} КБ)` : 'плакат link only';
        console.log(`${args.apply ? '→' : '·'} ${label} — ${what}${needsImage ? ` → ${targetFilename(film.id, file.type)}` : ''}`);
        if (!args.apply) {
          filled += 1;
          continue;
        }
        if (needsImage) {
          const url = await uploadPoster(env, film.id, file);
          if (!url) {
            failed += 1;
            continue;
          }
          fields.poster_image_url = url;
        }
        if (await writePoster(env, film.id, fields)) {
          filled += 1;
        } else {
          failed += 1;
        }
        continue;
      }
    }

    // Reached only when the table/link source did not resolve; the image field is
    // still a плакат, so nothing below may touch it.
    if (!needsImage) {
      skipped += 1;
      continue;
    }

    // A плакат on the legacy domain: leave the field empty rather than write that
    // host into it — `extractFilmPoster` already draws this one from the body.
    if (body && !bodyUrl) {
      console.log(`· ${label} — плакат on ${new URL(body).host}, left to the body parser`);
      skipped += 1;
      continue;
    }

    const fallback = bodyUrl ?? featured;
    if (!fallback || sameUpload(current, fallback)) {
      if (!current) {
        console.log(`· ${label} — no плакат, no cover, nothing to fill`);
      }
      skipped += 1;
      continue;
    }

    console.log(`${args.apply ? '→' : '·'} ${label} — cover ${fallback}`);
    if (!args.apply) {
      filled += 1;
      continue;
    }
    if (await writePoster(env, film.id, { poster_image_url: fallback })) {
      filled += 1;
    } else {
      failed += 1;
    }
  }

  console.log(
    `\n${filled} poster(s)${args.apply ? ' set' : ' would be set'}, ${skipped} left alone${failed ? `, ${failed} failure(s)` : ''}.` +
      (args.apply ? '' : '\nRe-run with --apply to write.')
  );
  process.exitCode = failed > 0 ? 1 : 0;
};

await main();
