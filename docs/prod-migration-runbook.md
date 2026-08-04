# Production migration runbook

Everything needed to move the Next.js redesign from **od-dev** to **od-stage** and then **production** (`obshee-delo.ru`), in execution order, with the verification gate for each step.

> **Read this first.** Every step below has been executed **only against od-dev**. od-stage and prod have never been written to (standing scope limit: od-dev only — see [`servers-agent/CLAUDE.md`](../../servers-agent/CLAUDE.md) safety rules). Prod facts in §0 come from a **read-only probe** recorded in [`legacy-page-fallback.md` §2](./legacy-page-fallback.md). Treat them as *expected*, and re-verify in §1 before acting. Run the whole runbook on **od-stage first** — it exists precisely so prod isn't the rehearsal.

Related: [`implementation-plan.md`](./implementation-plan.md) (task state) · [`wp-backend.md`](./wp-backend.md) (hosting, access, plugins) · [`legacy-page-fallback.md`](./legacy-page-fallback.md) (un-redesigned pages).

---

## 0. Hard blockers — nothing works until these are resolved

| # | Blocker | Why it stops the migration | Owner |
|---|---|---|---|
| **B1** | **REST is disabled on prod and stage.** `/wp-json/…` redirects to the homepage — a `clearfy-pro` feature. | The entire app is REST-only (`httpClient.ts` → `WP_BASE/wp-json`). Zero pages render. **This is the single largest blocker.** | WP admin |
| **B2** | **Content is CMSMasters shortcodes on prod, Gutenberg on od-dev.** Confirmed for `wp/v2/pages`; **unverified for posts**. | If film/news bodies are `[cmsms_*]`, then `parsePost`, `GutenbergProvider`, `extractFilmPoster` and `absolutizeWpMedia` all degrade to raw shortcode text. See §1.4 — this is the highest-risk unknown. | verify in §1 |
| **B3** | **ACF is not installed on prod/stage.** | No `group_film_meta` ⇒ no `acf` object in REST ⇒ every film affordance disappears. | §2.2 |
| **B4** | **Post ids are per-environment.** | The worksheet we filled holds od-dev ids; importing it into prod would write to unrelated posts. Mitigated by `pnpm film:remap` (§3.2). | §3 |
| **B5** | **Category ids may differ.** `581/580/86/559` are hardcoded in two files. | A wrong id silently empties the catalogue and the related-films strip. | §1.3 + §4.3 |
| **B6** | **Media offload origin unconfirmed for prod.** | `WP_MEDIA_CDN` defaults to the od-dev bucket; a different prod bucket breaks every image. | §1.5 + §4.1 |
| ~~B7~~ | ~~Hosting/deploy target undecided~~ — **decided: Beget VPS + Coolify, images built in GitHub Actions → GHCR.** | Remaining work is the CI push step (§4.7), not a decision. | §4 |
| **B8** | **Only ~4 routes are redesigned** (`/`, `/news`, `/news/[id]`, `/video`, `/video/[id]`). | Launching without the A6 legacy fallback means 170 pages 404. **Launch gate, not a migration step** — see §6. | A6 |

---

## 1. Recon — read-only, do this before touching anything

Always use the alias and the clearfy skip flag; without the flag WP-CLI output is corrupted by a redirect warning.

```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro core version'
```

**1.1 REST reachability.** From your machine, not the server:
```bash
curl -sI https://<stage-host>/wp-json/wp/v2/posts | head -3   # expect 200, not 301/302 to /
```

**1.2 Plugins + whether ACF is already there.**
```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro plugin list --status=active --fields=name,version --format=csv'
```

**1.3 Taxonomy ids — do not assume they match od-dev.**
```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro term list category --fields=term_id,slug,name,parent,count --format=csv | grep -E "video|movies|mult|roliki|famous|actual"'
```
Expected on od-dev: parent «Видео» `85`; children Фильмы `581`, Мультфильмы `580`, Ролики `86`, Известные люди `559`; sibling «Видео события» `52`. **Record the real numbers** — §4.3 depends on them.

**1.4 Film body format — the B2 check.** This decides how much of the film page survives:
```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro post list --post_type=post --format=csv --fields=ID --posts_per_page=5 \
  --tax_query='"'"'[{"taxonomy":"post_format","field":"slug","terms":"post-format-video"}]'"'"' '
# then, for one of those ids:
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro post get <ID> --field=post_content | grep -c "cmsms_\|wp:"'
```
- **Gutenberg (`wp:` blocks)** → the film page renders exactly as on od-dev. Proceed.
- **`[cmsms_*]` shortcodes** → the *body* renders as shortcode soup, but **the hero, download pills, share tiles, trailer and poster card all come from ACF**, which §3 populates. The realistic mitigation is to let the body degrade (or hide it) rather than to build a shortcode parser. **Raise this with Alexey before proceeding — it changes what the page looks like, not whether it works.**

**1.5 Media origin.**
```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro option get upload_url_path'
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro plugin list --format=csv | grep -i "offload\|s3\|yandex\|cloud"'
```

**1.6 Film inventory baseline** — so §5 has something to compare against:
```bash
curl -s "https://<stage-host>/wp-json/wp/v2/posts?format=video&per_page=1" -o /dev/null -D - | grep -i x-wp-total
```
od-dev: 203 `format=video` posts, 99 in the four film sub-categories.

---

## 2. WordPress preparation

**2.1 Enable REST (B1).** A `clearfy-pro` setting, not code — turn off its "disable REST API" toggle in the WP admin (Clearfy → API). Re-run §1.1 to confirm. If REST must stay closed to the public, allowlist by path rather than disabling wholesale; the app needs `wp/v2/posts`, `wp/v2/media`, `wp/v2/menus`, `wp/v2/menu-items`.

> Basic auth also requires the **application password** to exist on the target env — generate one per environment ([WP guide](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)) and never reuse od-dev's.

**2.2 Install ACF free (B3).**
```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro plugin install advanced-custom-fields --activate'
```

**2.3 Create the field group, then migrate legacy download meta.** Both scripts live in the ops repo at `servers-agent/tasks/2026-06-04-od-dev-film-acf-recon/` and are idempotent. **Order matters, and only these two:**
```bash
cd ~/Projects/servers-agent/tasks/2026-06-04-od-dev-film-acf-recon
ssh timeweb 'cd ~/od-stage/public_html && wp eval-file - --url=https://<stage-host>' < setup-film-acf.php
ssh timeweb 'cd ~/od-stage/public_html && wp eval-file - --url=https://<stage-host>' < migrate-download-slots.php
```
- `setup-film-acf.php` — 18 flat url/text fields, `show_in_rest`, location `post_format == video`. Safe to re-run: same field keys ⇒ existing postmeta survives.
- `migrate-download-slots.php` — folds any legacy `download_full_*`/`download_short_*` meta into `download_{1..5}_{url,label}` with composed labels.
- ⚠️ **Do NOT run `apply-film-downloads.php`** — retired 2026-07-03; it writes the old field keys.

**2.4 Gate.** REST must return all 18 keys:
```bash
curl -s -u "$WP_USER:$WP_PASSWORD" "https://<stage-host>/wp-json/wp/v2/posts?format=video&per_page=1&_fields=acf" | head -c 600
```

---

## 3. Film data — applying the filled worksheet

The source of truth is `.scratch/film-worksheet-filled.csv` (107 rows: 99 od-dev catalogue films + 8 that exist only on prod). It is gitignored — regenerate or copy it forward; §3.7 covers rebuilding it from scratch.

**3.1 Export the target environment's own sheet.** Point `.env` at the target first (`WP_BASE`, `WP_USER`, `WP_PASSWORD`):
```bash
pnpm film:export -- --out .scratch/film-worksheet-stage.csv
```

**3.2 Remap our filled values onto the target's post ids (B4).**
```bash
pnpm film:remap -- --from .scratch/film-worksheet-filled.csv \
                   --onto .scratch/film-worksheet-stage.csv \
                   --out  .scratch/film-worksheet-stage-filled.csv
```
Joins by normalised title, rewrites ids, fills only cells the target leaves empty, and **lists everything it refused to guess**. Read that output — it is the manual work-list for 3.3.

**3.3 Resolve by hand what remap wouldn't guess.**
- **The 8 prod-only films** (they have no od-dev post): «Правда и ложь про сухой закон 1985 года», «День рождения», «Как найти призвание», «Алкоголь. Взгляд изнутри», «Большая опасность маленьких размеров», «Папуасы», «Три секрета, как раскрыть призвание», «Сахар атакует». On prod they should match by title automatically; if they don't, paste the post id into the `id` column.
- **Two duplicate-title pairs** — `38424`/`32168` «Влияние кино на общество … Николай Бурляев» and `38420`/`31445` «История трезвеннических движений в России!» (each an «Известные люди» post duplicated as «Видео события»). Remap skips them by design. Neither carries Telegram data today, so they're safe to leave empty — or dedupe them editorially.

**3.4 Dry run, read it, then apply.**
```bash
pnpm film:import -- --in .scratch/film-worksheet-stage-filled.csv                    # dry run
pnpm film:import -- --in .scratch/film-worksheet-stage-filled.csv --only <one-id> --apply
pnpm film:import -- --in .scratch/film-worksheet-stage-filled.csv --apply
```
Guarantees: only changed fields are sent, an **empty cell never clears** an existing value (a literal `-` clears), rows without an id are listed and skipped, and reads/writes retry 3× so one flaky response can't abort the batch. Re-run the dry run afterwards — a clean `0 field(s)` is the confirmation.

**3.5 Upload the cover art.**
```bash
pnpm film:covers -- --export "/path/to/ChatExport_2026-08-03"            # dry run
pnpm film:covers -- --export "/path/to/ChatExport_2026-08-03" --apply
```
Uploads the Telegram key art as `film-cover-<postId>.jpg` and sets it as the featured image. Only touches films with **no** featured image and reuses an existing upload of the same filename, so re-running is a no-op. On od-dev this took featured-image coverage from 6 → 29 of 99.

**3.6 Fill `kinescope_id` from the Kinescope library.** Needs `KINESCOPE_TOKEN` in `.env` (API token from the Kinescope dashboard — the org's library already holds **261 videos**, so most films can be matched automatically rather than hand-entered).
```bash
pnpm film:kinescope -- --in .scratch/film-worksheet-stage-filled.csv     # fills in place, prints the report
```
The stored value is the **short id from `play_link`** (`https://kinescope.io/<short>`), because that is what `FilmPlayer` embeds. The API's `id` field is a different UUID and must **not** be used. Matching is deliberately conservative and refuses to guess: trailers/teasers and numbered course lessons are excluded, and where a download label carries a duration it is checked against the Kinescope duration — a mismatch is reported rather than written. Re-run `film:import` afterwards to push the new ids. On od-dev this took `kinescope_id` from **1 → 53 of 99**.

**3.7 If the filled sheet is lost.** Re-derive it: export the target sheet, then re-run the Telegram harvest against `ChatExport_2026-08-03/result.json` (channel **«ФИЛЬМЫ | ОБЩЕЕ ДЕЛО»**, 38 film posts → title, Dzen trailer, VK/Rutube/YouTube, 2–5 Яндекс.Диск downloads with durations). Match by title **and** cross-check the Яндекс.Диск file ids shared with the post body — that's what disambiguates same-series films. Posters come from the **WP body** («Скачать плакат» anchor → `poster_download_url`, плакат-named `<img>` → `poster_image_url`), never from Telegram's 16:9 art.

**3.8 Outstanding editorial work — not blocking deploy.**
- **`kinescope_id`: 53 of 99 after §3.6.** The 46 without one fall back to poster → `watch_url` → bare poster. Of those, six were found but deliberately **not** written and need a human:
  - **31892 «Утерянная добродетель»** — duration mismatch: the download label says 31 мин, the only Kinescope candidate is 59 мин.
  - **34169, 22289, 19871, 19864, 19839** — two or three plausible candidates each. **19839 «Пять секретов настоящего мужчины»** is the one to watch: its best-looking candidate `sJHb3TLo9hUfSSvoiP3eK2` is the **bilingual/English** cut already assigned to 22414 «5 secrets of a real man!»; the Russian film is most likely `sfR4N4YjouGTafv7A7djkp` («…Фильм-прорыв с участием Гандапаса», same 32 мин). Confirm before writing either.
  - 40 of the 53 were matched on title alone — the film had no duration in any download label to corroborate against. Low risk (titles are distinctive) but unverified.
- **`watch_url`: 0 of 99.**
- The 8 films missing from od-dev should be confirmed present on prod.
- **67400 «Курение. Взгляд изнутри» has a mislabelled download** — `disk.yandex.ru/i/-5L5AfVOrXQFlw` is stored as «Сокр. версия» but is the 35-минутная полная версия.
- **39664 «Как научиться любить?» has no `share_youtube`** — the channel gives it the same link as 71933, which belongs to 71933.

---

## 4. Frontend configuration and deploy

**4.1 Environment variables** (per deployment tier — read at module load, so a restart is required after any change):

| var | value | note |
|---|---|---|
| `WP_BASE` | target origin, **no** `/wp-json`, no trailing slash | also drives `images.remotePatterns` |
| `WP_USER` / `WP_PASSWORD` | application password for that env | never reuse across envs |
| `WP_MEDIA_CDN` | prod bucket, or `""` to disable the rewrite | defaults to the od-dev Yandex bucket — **override for prod** (B6) |
| `KINESCOPE_TOKEN` | Kinescope API token | **scripts only, never needed at runtime or in the image** — used by `film:kinescope` (§3.6) |

**4.2 Regenerate the API types** once the target serves REST — `redocly.yml` still points at `od-dev.tmweb.ru/wp-json-openapi`:
```bash
pnpm generate:types && pnpm type-check
```
> Note: `redocly.yml`'s `output` currently contains a stray space (`./src/types/generated /wp-json-openapi.ts`). Fix it before relying on this step.

**4.3 Apply the real category ids (B5)** if §1.3 differed from od-dev. Two places, and they must agree:
- `src/app/video/page.tsx` — `CATEGORY_IDS` (drives the switcher and the «Все» union)
- `src/app/video/[id]/page.tsx` — `VIDEO_CATEGORY_IDS` (related strip + SSG seed)

**4.4 Image hosts.** `WP_BASE` and `WP_MEDIA_CDN` are allowlisted automatically. The Punycode legacy domain `xn----9sbkcac6brh7h.xn--p1ai` is hardcoded and still in use (70199's poster image) — keep it until those assets are re-hosted.

**4.5 Build.** `output: 'standalone'`. `staticGenerationRetryCount: 3` + `staticGenerationMaxConcurrency: 4` exist because od-dev 503s under the default parallel prerender; keep them unless prod is provably faster.
```bash
pnpm lint && pnpm type-check && pnpm test && pnpm build
```

**4.6 Deploy target — Beget VPS running Coolify (A2, decided).** Rationale and sizing live in [`servers-agent/docs/vps-coolify-plan.md`](../../servers-agent/docs/vps-coolify-plan.md) §od-frontend.

- **The VPS never builds.** Next 16 + React Compiler needs ~1.5–3 GB and would OOM next to Coolify/Outline. Images are built in **GitHub Actions → GHCR**; Coolify only pulls.
- **Pass `WP_BASE` and `WP_MEDIA_CDN` as build-args** — `images.remotePatterns` is evaluated at build time, so a wrong value here makes `next/image` return 400 for every production image. `WP_USER`/`WP_PASSWORD` are **not** needed at build; CI builds against a stub client with no WP secrets, so no content is baked in.
- **Runtime env in Coolify:** the §4.1 table, plus `WP_LEGACY_BASE` once A6 lands.
- **Container:** port 3000, `HOSTNAME=0.0.0.0`, non-root `nextjs` user. **512 MB – 1 GB**, hard `mem_limit`, `--max-old-space-size` 256–384 (idle is 80–150 MB but `sharp` peaks 300–500 MB; 256 MB risks OOM, and V8 will otherwise grow to fill the host).
- **Persistent volume on `/app/.next/cache`** — without it every redeploy cold-starts into a request burst against the slow WP plus full image re-encoding.
- **Health check → `/health`** (added 2026-08-04). It never touches WP on purpose: a WP hiccup must not make Coolify restart a healthy container. Do not point the probe at `/`.
- **Pin the Next minor** — 16.1.0 has a known Docker memory-leak thread (vercel/next.js#88603).
- **WordPress stays on timeweb.** The container reaches it over public HTTPS.

**4.7 Remaining CI work.** `.github/workflows/ci.yml` still ends at `pnpm build` — **add the docker build + push-to-GHCR step**, passing the two build-args above. `.dockerignore` was fixed on 2026-08-04 (it had been named `.docerkignore`, so Docker ignored it entirely while the Dockerfile does `COPY . .` — a local build would have baked `.env` into a layer). Building in CI avoids that class of leak anyway, which is a further argument for never building on a developer machine.

**4.8 ISR caveat.** The ISR cache lives on the container filesystem, so it is **per-replica**. Scaling past one instance needs a shared `cacheHandler`. `revalidate = 3600` everywhere and there is **no on-demand revalidation** (B4 in the plan is open), so WP edits take up to an hour to appear — tell the editors, or ship the revalidate webhook first.

---

## 5. Verification gates

Run against the deployed target, not localhost.

1. `/video` — 200, ten cards, pagination present. Card count should equal §1.6's four-category total (od-dev: 99), **not** the full `format=video` count.
2. Each category tab returns results and its count matches WP.
3. `/video/<id>` for a film with downloads — pills render with durations; share tiles show the VK/Rutube/YouTube brand marks; breadcrumbs «Видео → title».
4. `/video/<id>` for a film with `kinescope_id` — the Kinescope iframe plays. 53 of 99 qualify on od-dev after §3.6.
5. `/video/<id>` for a film with a poster — the sidebar плакат card renders with «Скачать плакат».
6. Card thumbnails resolve (covers from §3.5) — no broken images, no `wp.invalid`.
7. `/`, `/news`, `/news/<id>` still render — the news route shares `resolveMediaUrl` and `parsePost` with video.
8. A film with **no** ACF data degrades gracefully: no empty pill strip, no phantom poster card.
9. `pnpm film:import --in <sheet>` reports `0 field(s)` — data landed and persisted.
10. 375px and 1440px on `/video` and one film page.
11. `/health` returns a plain `ok` (Coolify's probe target).

---

## 6. Launch gate — beyond this runbook

Migrating the data and pointing the app at prod is **not** launch. Still required:

- **A6 legacy-page fallback.** ~170 of 174 pages have no redesigned route; without the catch-all iframe proxy they 404. Needs the frozen copy stood up with a chromeless template + REST, `WP_LEGACY_BASE`, the proxy route and the catch-all. See [`legacy-page-fallback.md` §5](./legacy-page-fallback.md).
- **A2 hosting decision**, **A4 Yandex Metrica + consent banner**, **F6 152-FZ privacy page**, **F4 SEO baseline** (`robots.txt`, `sitemap.xml`, OG beyond news).
- **B4 on-demand revalidation** — otherwise editors wait an hour (§4.6).
- **B8 WordPress plugin cleanup** is **not** required for the frontend, with one exception: removing `clearfy-pro` is what permanently fixes both the REST block (B1) and the WP-CLI redirect gotcha. Everything else in B8 is hygiene.

---

## 7. Rollback

Nothing here is destructive, but in order of blast radius:

- **Frontend** — redeploy the previous image, or repoint `WP_BASE` back at od-dev. No WP state involved.
- **ACF values** — the importer only ever *fills* empty fields, so a bad import adds rather than destroys. To revert a specific film, put `-` in the offending cells and re-import (that's the explicit clear token). Keep the pre-import `film:export` sheet — it **is** your backup of prior values.
- **Cover uploads** — `film:covers` only touches posts with no featured image. To undo, unset `featured_media` and delete the `film-cover-<id>.jpg` attachments.
- **ACF field group** — deactivating the ACF plugin hides the fields from REST but leaves postmeta intact; re-activating restores everything.
- **Before starting on prod**, take a DB snapshot through the Timeweb panel — the migration writes postmeta across ~30 posts and uploads ~23 attachments.
