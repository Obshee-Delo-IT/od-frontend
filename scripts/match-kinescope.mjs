/**
 * Fill `kinescope_id` in a film worksheet from the Kinescope library.
 *
 *   pnpm film:kinescope                       # dry run against the filled sheet
 *   pnpm film:kinescope -- --out .scratch/film-worksheet-kine.csv
 *
 * Needs `KINESCOPE_TOKEN` in `.env` (an API token from the Kinescope dashboard).
 *
 * The stored id is the short one from `play_link` — `https://kinescope.io/<short>`
 * — because that is what `FilmPlayer` puts into `https://kinescope.io/embed/<id>`.
 * The API's `id` field is a different (UUID) identifier and must NOT be used.
 *
 * **The YouTube bridge is the reliable signal.** The library was imported 1-to-1
 * from YouTube, so a Kinescope title IS the source YouTube title — while the WP
 * title is usually the plain editorial one («Докажи, что любишь» vs «ЭПИДЕМИЯ о
 * которой ты не знал…»). So when a film has `share_youtube`, we resolve that
 * video's title via YouTube oEmbed and match on it. Measured on od-dev: it
 * agreed with 16 of 17 already-matched films and resolved 10 of 10 that title
 * similarity had failed or mismatched. Fuzzy title matching runs only as the
 * fallback for films with no YouTube link.
 *
 * Matching is deliberately conservative — a wrong id plays the wrong film on a
 * public page:
 *  - Titles are compared casefolded, ё=е, punctuation stripped. Exact match
 *    first, then containment either way, and only when unambiguous.
 *  - Trailers/teasers and numbered course lessons are excluded outright.
 *  - Where the worksheet's download labels give a duration, it is checked
 *    against the Kinescope duration. A mismatch DEMOTES the match to the
 *    report instead of writing it — that is what separates a film from its
 *    trailer or a short cut.
 *  - Anything ambiguous or unverifiable is listed for a human, never guessed.
 */

import fs from 'node:fs';
import { readArgs } from './lib/args.mjs';
import { parseCsv, stringifyCsv } from './lib/csv.mjs';
import { DOWNLOAD_SLOTS } from './lib/wp.mjs';

const OPTIONS = {
  in: { type: 'string', default: '.scratch/film-worksheet-filled.csv' },
  out: { type: 'string' },
  delimiter: { type: 'string', default: ',' },
  tolerance: { type: 'string', default: '3' },
};

const normalise = (title) =>
  (title ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Not a film: trailers, teasers and the numbered lesson clips of the courses. */
const isNotAFilm = (title) => /трейлер|тизер|анонс|фрагмент/i.test(title) || /^\s*\d{1,3}\s*$/.test(title);

const fetchLibrary = async (token) => {
  const videos = [];
  for (let page = 1; ; page += 1) {
    const res = await fetch(`https://api.kinescope.io/v1/videos?page=${page}&per_page=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Kinescope API returned ${res.status}: ${(await res.text()).slice(0, 160)}`);
    }
    const body = await res.json();
    videos.push(...body.data);
    if (videos.length >= body.meta.pagination.total || body.data.length === 0) {
      return videos;
    }
  }
};

/**
 * Title of a YouTube video, via the public oEmbed endpoint (no API key needed).
 * Returns null when the link is unusable — a private/removed video, or YouTube
 * being unreachable, which is a live possibility from inside Russia.
 */
const youtubeTitle = async (url) => {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) {
      return null;
    }
    return (await res.json()).title ?? null;
  } catch {
    return null;
  }
};

/** Minutes claimed by the worksheet's download labels, e.g. «Полн. версия • 35 мин». */
const labelMinutes = (row, col) => {
  const minutes = [];
  for (let slot = 1; slot <= DOWNLOAD_SLOTS; slot += 1) {
    const match = (row[col(`download_${slot}_label`)] ?? '').match(/(\d+)\s*мин/);
    if (match) {
      minutes.push(Number(match[1]));
    }
  }
  return minutes;
};

const main = async () => {
  const args = readArgs(OPTIONS);
  const tolerance = Number(args.tolerance);
  const token = process.env.KINESCOPE_TOKEN;
  if (!token) {
    throw new Error('KINESCOPE_TOKEN is not set — add it to .env and run via `node --env-file=.env …`.');
  }

  const rows = parseCsv(fs.readFileSync(args.in, 'utf8'), { delimiter: args.delimiter });
  const header = rows[0];
  const body = rows.slice(1);
  const col = (name) => header.indexOf(name);

  const library = await fetchLibrary(token);
  const describe = (video) => ({
    short: video.play_link.split('/').pop(),
    title: video.title ?? '',
    key: normalise(video.title),
    status: video.status,
  });
  const notReady = library.filter((video) => video.status !== 'done' && video.play_link).map(describe);

  // The library is a 1-to-1 import of the YouTube channel, so descriptions are
  // the YouTube descriptions — and a marketing-retitled upload usually names the
  // real film in its opening line («Курение. Взгляд изнутри» – это новый
  // документальный фильм…). Too noisy to trust (the same names recur in every
  // video's cross-promo footer), so it only ever produces suggestions.
  const described = library
    .filter((video) => video.status === 'done' && video.play_link && video.description)
    .map((video) => ({ ...describe(video), minutes: Math.round((video.duration ?? 0) / 60), body: normalise(video.description) }));

  const usable = library
    .filter((video) => video.status === 'done' && video.play_link)
    .map((video) => ({
      short: video.play_link.split('/').pop(),
      title: video.title ?? '',
      key: normalise(video.title),
      minutes: Math.round((video.duration ?? 0) / 60),
      excluded: isNotAFilm(video.title ?? ''),
    }));

  console.log(
    `Kinescope: ${library.length} videos (${library.length - usable.length} not ready), ` +
      `${usable.filter((v) => v.excluded).length} excluded as trailers/lessons\n`
  );

  const candidates = usable.filter((video) => !video.excluded && video.key);
  // The YouTube bridge matches against every ready video, trailers included:
  // the WP post's own share_youtube is authoritative about which video it is.
  const byKey = new Map(usable.map((video) => [video.key, video]));
  const filled = [];
  const viaYoutube = [];
  const durationMismatch = [];
  const ambiguous = [];
  const unmatched = [];
  const unverified = [];
  const brokenInKinescope = [];

  for (const row of body) {
    const id = row[col('id')];
    const title = row[col('title')] ?? '';
    const key = normalise(title);
    if (!key) {
      continue;
    }
    if ((row[col('kinescope_id')] ?? '').trim() !== '') {
      continue; // already set — never overwrite
    }

    // 1. YouTube bridge — the source title, which is what Kinescope holds.
    const shareYoutube = (row[col('share_youtube')] ?? '').trim();
    if (shareYoutube) {
      const ytTitle = await youtubeTitle(shareYoutube);
      const ytKey = normalise(ytTitle);
      const hit =
        byKey.get(ytKey) ??
        (ytKey ? usable.find((video) => video.key.includes(ytKey) || ytKey.includes(video.key)) : undefined);
      if (hit) {
        row[col('kinescope_id')] = hit.short;
        viaYoutube.push(`${id || '(no id)'} ${title.slice(0, 42).padEnd(44)} ${hit.short}  (${hit.minutes} мин) ← «${ytTitle.slice(0, 44)}»`);
        continue;
      }
      // The source video may be in Kinescope but unplayable — say so rather
      // than reporting «no candidate», which sends someone hunting for nothing.
      const broken = ytKey && notReady.find((video) => video.key === ytKey);
      if (broken) {
        brokenInKinescope.push(`${id || '(no id)'} ${title} → ${broken.short} «${broken.title.slice(0, 50)}» (status: ${broken.status}) — re-upload in Kinescope`);
        continue;
      }
    }

    // 2. Fall back to comparing the WP title directly.
    let matches = candidates.filter((video) => video.key === key);
    if (matches.length === 0) {
      matches = candidates.filter((video) => video.key.includes(key) || key.includes(video.key));
    }

    if (matches.length === 0) {
      const mentions = key.split(' ').length >= 2 ? described.filter((video) => video.body.includes(key)) : [];
      unmatched.push(
        `${id || '(no id)'} ${title}` +
          (mentions.length
            ? mentions
                .map((v) => `\n         ? ${v.short} (${v.minutes} мин) «${v.title.slice(0, 52)}» — names this film in its description`)
                .join('')
            : '')
      );
      continue;
    }

    const expected = labelMinutes(row, col);
    if (expected.length > 0) {
      const fits = matches.filter((video) => expected.some((m) => Math.abs(video.minutes - m) <= tolerance));
      if (fits.length === 0) {
        durationMismatch.push(
          `${id || '(no id)'} ${title} — expected ${expected.join('/')} мин, Kinescope has ` +
            matches.map((v) => `${v.minutes} мин («${v.title.slice(0, 40)}»)`).join(', ')
        );
        continue;
      }
      matches = fits;
    }

    if (matches.length > 1) {
      ambiguous.push(`${id || '(no id)'} ${title} → ${matches.map((v) => `${v.short} «${v.title.slice(0, 40)}»`).join(' | ')}`);
      continue;
    }

    const [match] = matches;
    row[col('kinescope_id')] = match.short;
    const note = expected.length > 0 ? `${match.minutes} мин ✓` : `${match.minutes} мин, duration unverified`;
    filled.push(`${id || '(no id)'} ${title.slice(0, 44).padEnd(46)} ${match.short}  (${note})`);
    if (expected.length === 0) {
      unverified.push(`${id || '(no id)'} ${title}`);
    }
  }

  const out = args.out ?? args.in;
  fs.writeFileSync(out, stringifyCsv([header, ...body], { delimiter: args.delimiter }));

  const report = (label, list) => {
    if (list.length > 0) {
      console.log(`\n${list.length} ${label}:`);
      list.forEach((line) => console.log(`    ${line}`));
    }
  };

  report('kinescope_id filled via the YouTube bridge (exact source title)', viaYoutube);
  report('kinescope_id filled by WP-title similarity', filled);
  report('source video found but NOT playable in Kinescope', brokenInKinescope);
  report('duration mismatch — NOT written, check by hand', durationMismatch);
  report('ambiguous — NOT written, more than one candidate', ambiguous);
  report('filled but duration could not be verified (no мин in any download label)', unverified);
  report('film(s) with no confident candidate (`?` lines are description hints, never written)', unmatched);

  // What is left over on the Kinescope side, so the remaining pairing can be
  // done by elimination rather than by searching 261 titles by hand.
  const claimed = new Set(body.map((row) => (row[col('kinescope_id')] ?? '').trim()).filter(Boolean));
  const orphanFilms = usable
    .filter((video) => !claimed.has(video.short) && !video.excluded && video.minutes >= 8)
    .sort((a, b) => b.minutes - a.minutes);
  console.log(`\n${orphanFilms.length} film-length video(s) (≥8 мин) in Kinescope claimed by no worksheet row:`);
  orphanFilms.forEach((video) => console.log(`    ${video.short} ${String(video.minutes).padStart(3)} мин «${video.title.slice(0, 62)}»`));
  console.log(`\nWrote ${body.length} rows → ${out}`);
};

await main();
