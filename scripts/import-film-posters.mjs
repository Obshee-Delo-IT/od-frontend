/**
 * Fill `poster_image_url` — the artwork of the film page's poster card — from the
 * best source the site already holds, in priority order:
 *
 *   1. the плакат the film links to on Яндекс.Диск (`poster_download_url`), which
 *      is not in the media library yet and gets uploaded;
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
/** Same test `extractFilmPoster` uses on the frontend, so both pick the same figure. */
const POSTER_NAME = /плакат|постер|plakat|poster/i;
/** Ratio-preserving WP variants, largest first — `thumbnail` is a square crop, so never it. */
const RATIO_SIZES = ['large', 'medium_large', 'medium'];

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

/** Write the field and read it back — ACF silently ignores an unknown key. */
const writePoster = async (env, postId, url) => {
  const write = await wpFetch(env, `/wp/v2/posts/${postId}`, {
    method: 'POST',
    body: JSON.stringify({ acf: { poster_image_url: url } }),
  });
  if (!write.ok) {
    console.log(`  ✗ could not write poster_image_url (${write.status}): ${(await write.text()).slice(0, 160)}`);
    return false;
  }
  if (((await readJson(write))?.acf?.poster_image_url ?? '') !== url) {
    console.log('  ✗ poster_image_url did not persist');
    return false;
  }
  console.log(`  poster_image_url ← ${url}`);
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

    // A плакат on the legacy domain: leave the field empty rather than write that
    // host into it — `extractFilmPoster` already draws this one from the body.
    if (body && !bodyUrl) {
      console.log(`· ${label} — плакат on ${new URL(body).host}, left to the body parser`);
      skipped += 1;
      continue;
    }

    const fallback = bodyUrl ?? (await featuredPoster(env, film.featured_media));

    // Anything other than a cover this script wrote is the editor's плакат — leave it.
    if (current && current !== fallback) {
      skipped += 1;
      continue;
    }

    if (link) {
      const file = await yandexFile(link);
      if (file.error) {
        console.log(`· ${label} — плакат link: ${file.error}`);
      } else {
        console.log(
          `${args.apply ? '→' : '·'} ${label} — плакат ${file.name} (${Math.round(file.size / 1024)} КБ) → ${targetFilename(film.id)}`
        );
        if (!args.apply) {
          filled += 1;
          continue;
        }
        const url = await uploadPoster(env, film.id, file);
        if (!url) {
          failed += 1;
          continue;
        }
        if (await writePoster(env, film.id, url)) {
          filled += 1;
        } else {
          failed += 1;
        }
        continue;
      }
    }

    if (!fallback || current === fallback) {
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
    if (await writePoster(env, film.id, fallback)) {
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
