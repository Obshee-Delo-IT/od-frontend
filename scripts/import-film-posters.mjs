/**
 * Fill `poster_image_url` from the плакат the film already links to on Яндекс.Диск.
 *
 *   pnpm film:posters                    # dry run
 *   pnpm film:posters -- --apply
 *   pnpm film:posters -- --apply --only 71770
 *
 * Why this exists: `poster_download_url` («Скачать плакат») is filled for more
 * films than `poster_image_url` is — the Telegram channel gave the link but not
 * the artwork — and `FilmPosterCard` needs the *image* to draw anything. Every
 * one of those links is a public Яндекс.Диск file, and its metadata is readable
 * without a token, so the artwork is already on the site in every sense except
 * being in the media library. This puts it there.
 *
 * A film whose `poster_image_url` is already set is never touched, and neither
 * is a link that turns out not to be an image (a PDF plate would be a перепечатка
 * master, not something a card can show). Idempotent: an upload is reused when
 * the media library already holds the same target filename, so a second run
 * writes nothing and says so.
 *
 * It reads the catalogue over REST rather than the worksheet, because unlike the
 * rest of the `film:*` tooling nothing here is editorial — the pairing is the
 * film's own link, not a judgement someone made in a spreadsheet.
 */

import { idSet, readArgs } from './lib/args.mjs';
import { fetchAllFilms, plainText, readEnv, wpFetch } from './lib/wp.mjs';

const OPTIONS = {
  apply: { type: 'boolean', default: false },
  only: { type: 'string' },
};

/** Yandex's public-resource API — no token, no account, just the share URL. */
const YANDEX_API = 'https://cloud-api.yandex.net/v1/disk/public/resources';

/** A readable, collision-proof media filename: `film-poster-<postId>.jpg`. */
const targetFilename = (postId) => `film-poster-${postId}.jpg`;

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
  if (!(meta.mime_type ?? '').startsWith('image/')) {
    return { error: `not an image (${meta.mime_type ?? meta.type ?? 'unknown'})` };
  }

  const hrefRes = await fetch(`${YANDEX_API}/download?public_key=${key}`);
  if (!hrefRes.ok) {
    return { error: `download link refused (${hrefRes.status})` };
  }
  return { name: meta.name, size: meta.size, type: meta.mime_type, href: (await hrefRes.json()).href };
};

const main = async () => {
  const args = readArgs(OPTIONS);
  const only = idSet(args.only);
  const env = readEnv();

  const films = (await fetchAllFilms(env, { fields: ['id', 'title', 'acf'] }))
    .filter((film) => (film.acf?.poster_download_url ?? '').trim())
    .filter((film) => !(film.acf?.poster_image_url ?? '').trim())
    .filter((film) => !only || only.has(String(film.id)));

  console.log(`${args.apply ? 'APPLY' : 'DRY RUN'} — ${films.length} film(s) with a плакат link and no плакат image\n`);

  let filled = 0;
  let skipped = 0;
  let failed = 0;

  for (const film of films) {
    const label = `${film.id} ${plainText(film.title?.rendered).slice(0, 45)}`;
    const file = await yandexFile(film.acf.poster_download_url.trim());

    if (file.error) {
      console.log(`· ${label} — ${file.error}, left alone`);
      skipped += 1;
      continue;
    }

    const filename = targetFilename(film.id);
    console.log(`${args.apply ? '→' : '·'} ${label} — ${file.name} (${Math.round(file.size / 1024)} КБ) → ${filename}`);
    if (!args.apply) {
      filled += 1;
      continue;
    }

    // Reuse an earlier upload of the same file rather than creating duplicates.
    const existingRes = await wpFetch(env, `/wp/v2/media?search=${encodeURIComponent(filename)}&per_page=1&_fields=id,slug,source_url`);
    const existing = existingRes.ok ? await existingRes.json() : [];
    let media = existing.find((item) => item.slug === filename.replace(/\.jpg$/, ''));

    if (!media) {
      const download = await fetch(file.href);
      if (!download.ok) {
        console.log(`  ✗ download failed (${download.status})`);
        failed += 1;
        continue;
      }
      const upload = await wpFetch(env, '/wp/v2/media', {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg', 'Content-Disposition': `attachment; filename="${filename}"` },
        body: Buffer.from(await download.arrayBuffer()),
      });
      if (!upload.ok) {
        console.log(`  ✗ upload failed (${upload.status}): ${(await upload.text()).slice(0, 160)}`);
        failed += 1;
        continue;
      }
      media = await upload.json();
      console.log(`  uploaded as media ${media.id}`);
    } else {
      console.log(`  reusing existing media ${media.id}`);
    }

    const write = await wpFetch(env, `/wp/v2/posts/${film.id}`, {
      method: 'POST',
      body: JSON.stringify({ acf: { poster_image_url: media.source_url } }),
    });
    if (!write.ok) {
      console.log(`  ✗ could not write poster_image_url (${write.status}): ${(await write.text()).slice(0, 160)}`);
      failed += 1;
      continue;
    }
    if (((await write.json()).acf?.poster_image_url ?? '') !== media.source_url) {
      console.log('  ✗ poster_image_url did not persist');
      failed += 1;
      continue;
    }
    console.log(`  poster_image_url ← ${media.source_url}`);
    filled += 1;
  }

  console.log(
    `\n${filled} плакат(ов)${args.apply ? ' set' : ' would be set'}, ${skipped} left alone${failed ? `, ${failed} failure(s)` : ''}.` +
      (args.apply ? '' : '\nRe-run with --apply to upload.')
  );
  process.exitCode = failed > 0 ? 1 : 0;
};

await main();
