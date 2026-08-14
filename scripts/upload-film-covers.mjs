/**
 * Upload the «ФИЛЬМЫ | ОБЩЕЕ ДЕЛО» Telegram cover art to WP and set it as each
 * film's featured image.
 *
 *   pnpm film:covers -- --export "<path to ChatExport_…>"            # dry run
 *   pnpm film:covers -- --export "<path>" --apply
 *   pnpm film:covers -- --export "<path>" --apply --only 71933
 *
 * Why featured image and not `poster_image_url`: the channel's art is 16:9 key
 * art (1280×720), which is what the catalogue card, the player poster and the
 * OG image want. `poster_image_url` feeds the sidebar «плакат» card, which is
 * portrait A2 artwork lifted from the post body — a different asset.
 *
 * The film ← message pairing comes from the worksheet: `hint_featured_image`
 * holds the message's photo path, written there by the Telegram fill pass. Only
 * films that currently have NO featured image are touched, and an upload is
 * skipped when a media item with the same target filename already exists, so
 * re-running is safe.
 */

import fs from 'node:fs';
import path from 'node:path';
import { idSet, readArgs } from './lib/args.mjs';
import { parseCsvRecords } from './lib/csv.mjs';
import { plainText, readEnv, wpFetch } from './lib/wp.mjs';

const OPTIONS = {
  in: { type: 'string', default: '.scratch/film-worksheet-filled.csv' },
  export: { type: 'string' },
  delimiter: { type: 'string', default: ',' },
  apply: { type: 'boolean', default: false },
  only: { type: 'string' },
};

/** A readable, collision-proof media filename: `film-cover-<postId>.jpg`. */
const targetFilename = (postId) => `film-cover-${postId}.jpg`;

const main = async () => {
  const args = readArgs(OPTIONS);
  if (!args.export) {
    throw new Error('--export <path to ChatExport_… directory> is required');
  }
  const only = idSet(args.only);
  const env = readEnv();

  const rows = parseCsvRecords(fs.readFileSync(args.in, 'utf8'), { delimiter: args.delimiter })
    .filter((row) => /^\d+$/.test(row.id?.trim() ?? ''))
    .filter((row) => (row.hint_featured_image ?? '').trim().endsWith('.jpg'))
    .filter((row) => !only || only.has(row.id.trim()));

  console.log(`${args.apply ? 'APPLY' : 'DRY RUN'} — ${rows.length} film(s) with cover art\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const id = row.id.trim();
    const source = path.join(args.export, row.hint_featured_image.trim());
    const label = `${id} ${plainText(row.title).slice(0, 45)}`;

    if (!fs.existsSync(source)) {
      console.log(`✗ ${label} — cover file missing: ${source}`);
      failed += 1;
      continue;
    }

    const postRes = await wpFetch(env, `/wp/v2/posts/${id}?_fields=id,featured_media`);
    if (!postRes.ok) {
      console.log(`✗ ${label} — could not read post (${postRes.status})`);
      failed += 1;
      continue;
    }
    const { featured_media: current } = await postRes.json();
    if (current) {
      console.log(`· ${label} — already has featured image ${current}, left alone`);
      skipped += 1;
      continue;
    }

    const filename = targetFilename(id);
    console.log(`${args.apply ? '→' : '·'} ${label} — ${row.hint_featured_image.trim()} → ${filename}`);
    if (!args.apply) {
      uploaded += 1;
      continue;
    }

    // Reuse an earlier upload of the same file rather than creating duplicates.
    const existingRes = await wpFetch(env, `/wp/v2/media?search=${encodeURIComponent(filename)}&per_page=1&_fields=id,slug`);
    const existing = existingRes.ok ? await existingRes.json() : [];
    let mediaId = existing.find((item) => item.slug === filename.replace(/\.jpg$/, ''))?.id;

    if (!mediaId) {
      const upload = await wpFetch(env, '/wp/v2/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
        body: fs.readFileSync(source),
      });
      if (!upload.ok) {
        console.log(`  ✗ upload failed (${upload.status}): ${(await upload.text()).slice(0, 160)}`);
        failed += 1;
        continue;
      }
      mediaId = (await upload.json()).id;
      console.log(`  uploaded as media ${mediaId}`);
    } else {
      console.log(`  reusing existing media ${mediaId}`);
    }

    const attach = await wpFetch(env, `/wp/v2/posts/${id}`, {
      method: 'POST',
      body: JSON.stringify({ featured_media: mediaId }),
    });
    if (!attach.ok) {
      console.log(`  ✗ could not set featured image (${attach.status})`);
      failed += 1;
      continue;
    }
    if ((await attach.json()).featured_media !== mediaId) {
      console.log('  ✗ featured image did not persist');
      failed += 1;
      continue;
    }
    uploaded += 1;
  }

  console.log(
    `\n${uploaded} cover(s)${args.apply ? ' set' : ' would be set'}, ${skipped} left alone${failed ? `, ${failed} failure(s)` : ''}.` +
      (args.apply ? '' : '\nRe-run with --apply to upload.')
  );
  process.exitCode = failed > 0 ? 1 : 0;
};

await main();
