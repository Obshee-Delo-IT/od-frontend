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
| **B5** | **Category ids may differ.** `581/580/86/559` are hardcoded — since 2026-08-13 in **one** file, `src/shared/config/filmCategories.ts`. | A wrong id silently empties the catalogue and the related-films strip — it answers 200, so only a count check catches it. | §1.3 + §4.3 |
| **B6** | **Media offload origin unconfirmed for prod.** | `WP_MEDIA_CDN` defaults to the od-dev bucket; a different prod bucket breaks every image. | §1.5 + §4.1 |
| ~~B7~~ | ~~Hosting/deploy target undecided~~ — **decided: Beget VPS + Coolify, images built in GitHub Actions → GHCR.** | Remaining work is the CI push step (§4.7), not a decision. | §4 |
| **B8** | **Only 4 content routes are redesigned** — `/` (home), `/news` (index), `/video` (catalogue) and the post detail at `/<id>`. | Launching without the A6 legacy fallback means ~170 pages 404. **Launch gate, not a migration step** — see §6. Those ~170 pages are ~15 % of entry traffic. | A6 |
| ~~B9~~ | ~~The redesigned routes don't match live URLs.~~ — **FIXED 2026-08-13 (A8).** `/<id>` is now served directly by `app/[...slug]/page.tsx`; `src/proxy.ts` (driven by `resolveLegacyUrl` in `src/shared/config/legacyRedirects.ts`) covers the `/video/*`, `/category/video/*`, `/category/*` and `/page/N/` families in a single hop each; `trailingSlash: true` matches the live URL form. | Was **59 % of all site entries**. Now a **verification** concern rather than a build one — gate 12 in §5 is what proves it, and it is scriptable. | verify in §5 |

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
**The YouTube bridge is what makes this work.** The library was imported 1-to-1 from YouTube, so a Kinescope title *is* the source YouTube title, while the WP title is the plain editorial one («Докажи, что любишь» vs «ЭПИДЕМИЯ о которой ты не знал…»). When a film has `share_youtube`, the script resolves that video's title through YouTube oEmbed (public, no API key) and matches on it; WP-title similarity is only the fallback. Measured on od-dev: the bridge agreed with 16 of 17 already-matched films and resolved 11 of 11 that title matching had missed **or matched wrongly** — so populating `share_youtube` (§3 from Telegram) is a prerequisite worth doing first, not an optional extra. If YouTube is unreachable from where you run this, the bridge silently degrades to title matching, which is materially worse — check the report's «via the YouTube bridge» count is non-zero.

The stored value is the **short id from `play_link`** (`https://kinescope.io/<short>`), because that is what `FilmPlayer` embeds. The API's `id` field is a different UUID and must **not** be used. Matching is deliberately conservative and refuses to guess: trailers/teasers and numbered course lessons are excluded, and where a download label carries a duration it is checked against the Kinescope duration — a mismatch is reported rather than written. Re-run `film:import` afterwards to push the new ids. On od-dev this took `kinescope_id` from **1 → 70 of 99**.

**3.7 If the filled sheet is lost.** Re-derive it: export the target sheet, then re-run the Telegram harvest against `ChatExport_2026-08-03/result.json` (channel **«ФИЛЬМЫ | ОБЩЕЕ ДЕЛО»**, 38 film posts → title, Dzen trailer, VK/Rutube/YouTube, 2–5 Яндекс.Диск downloads with durations). Match by title **and** cross-check the Яндекс.Диск file ids shared with the post body — that's what disambiguates same-series films. Posters come from the **WP body** («Скачать плакат» anchor → `poster_download_url`, плакат-named `<img>` → `poster_image_url`), never from Telegram's 16:9 art.

**3.8 Outstanding editorial work — not blocking deploy.** Tracked as **B-VIDEO2** in [`implementation-plan.md`](./implementation-plan.md); the summary below is the same list.
- **`kinescope_id`: 70 of 99 after §3.6.** The 29 without one fall back to poster → `watch_url` → bare poster. Nearly all are «Известные люди» short interviews with no distinctive title and no `share_youtube`; each YouTube link added converts directly into a resolved id, so that is the lever. Two structural aids the report prints:
  - **Description hints.** The library is a 1-to-1 YouTube import, so descriptions are the YouTube descriptions, and a retitled upload usually names the real film in its opening line — this is how 67400 «Курение. Взгляд изнутри» was found under the title «Вред вейпа, айкоса, кальяна, курения – ДОКУМЕНТАЛЬНЫЙ ФИЛЬМ». Suggestions only, never written: the same film names recur in every video's cross-promo footer.
  - **Orphan list.** Film-length (≥8 мин) Kinescope videos claimed by no row, so the tail can be paired by elimination instead of searching 261 titles. That is what resolved the previously-ambiguous 19871 — its rival id was already claimed by 63287.
  - **Duplicate uploads are normal in this library** — several films exist twice, e.g. «Утерянная добродетель» as both a 32-мин and a 59-мин cut, and «Деньги с дымком» under both a plain and a marketing title. An orphan that looks like an already-matched film is usually a second upload, not a missed match.
  - **28749 «The Mystery of the Deadly Smoke»** is the English cut; three Russian «Тайна едкого дыма» versions exist, no English one. (An English «Istoriy s ushami» does exist, so English uploads are sporadic rather than absent.)
  - **37626 / 14590 / 32168** duplicate other WP posts (26122 / 38406 / 38424) — merging the posts is the better fix than assigning the same video twice.
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

**4.3 Apply the real category ids (B5)** if §1.3 differed from od-dev. **One file since 2026-08-13** — `src/shared/config/filmCategories.ts`, which holds `FILM_CATEGORY_IDS` (slug → id: `movies` 581, `mult` 580, `roliki` 86, `famous` 559) and is read by the `/video` index filter, the related-films scope on a film page, the catch-all's SSG seed, and the A8 redirect table. Change the four numbers there and every consumer follows.

Two things that are *not* in that file and still need a look:
- **`src/app/news/page.tsx`** — `CATEGORY_IDS` holds the news chips (`47` Новости / `578` Статьи), equally environment-specific.
- **`src/shared/config/legacyRedirects.ts`** — `/category/novosti` and `/category/articles` hardcode those same two news ids in their destinations.

A wrong id here **fails quietly rather than loudly**: the catalogue answers 200 with an empty or unfiltered result rather than 404ing, so §5 gates 1–2 (card counts matching WP) are what actually catch it.

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
- **Health check → `/health/`** (added 2026-08-04). ⚠️ **With the trailing slash** — A8 turned on `trailingSlash: true`, so a probe of `/health` gets a 308 to `/health/`; whether that counts as healthy depends on the probe's redirect handling, so configure the slashed form and don't rely on it. It never touches WP on purpose: a WP hiccup must not make Coolify restart a healthy container. Do not point the probe at `/`.
- **Pin the Next minor** — 16.1.0 has a known Docker memory-leak thread (vercel/next.js#88603).
- **WordPress stays on timeweb.** The container reaches it over public HTTPS.

**4.7 Remaining CI work.** `.github/workflows/ci.yml` runs `next typegen` → `lint` → `type-check` → `test` → `build` and **stops there** — the docker build + push-to-GHCR step is still to add, passing the two build-args above.

⚠️ **The Dockerfile can't accept those build-args yet.** It has no `ARG WP_BASE` / `ARG WP_MEDIA_CDN` (nor the matching `ENV` in the `builder` stage), so `docker build --build-arg WP_BASE=…` would be silently ignored, `next.config.ts` would fall back to `https://wp.invalid`, and **every `next/image` request on the deployed site would 400**. Add the two `ARG`/`ENV` lines in the same change as the GHCR push, and verify by grepping the built `.next` output or by loading one remote image on a preview deploy.

`.dockerignore` was fixed on 2026-08-04 (it had been named `.docerkignore`, so Docker ignored it entirely while the Dockerfile does `COPY . .` — a local build would have baked `.env` into a layer). Building in CI avoids that class of leak anyway, which is a further argument for never building on a developer machine.

**4.8 ISR caveat.** The ISR cache lives on the container filesystem, so it is **per-replica**. Scaling past one instance needs a shared `cacheHandler`. `revalidate = 3600` everywhere and there is **no on-demand revalidation** (B4 in the plan is open), so WP edits take up to an hour to appear — tell the editors, or ship the revalidate webhook first.

---

## 5. Verification gates

Run against the deployed target, not localhost.

Post detail lives at the bare **`/<id>`** since A8 — `/video/<id>` and `/news/<id>` 308 there, so gates 3–5 can be run against either shape (checking both proves the redirect too).

1. `/video/` — 200, ten cards, pagination present. Card count should equal §1.6's four-category total (od-dev: 99), **not** the full `format=video` count.
2. Each category tab returns results and its count matches WP.
3. `/<id>` for a film with downloads — pills render with durations; share tiles show the VK/Rutube/YouTube brand marks; breadcrumbs «Видео → title».
4. `/<id>` for a film with `kinescope_id` — the Kinescope iframe plays. 70 of 99 qualify on od-dev after §3.6.
5. `/<id>` for a film with a poster — the sidebar плакат card renders with «Скачать плакат».
6. Card thumbnails resolve (covers from §3.5) — no broken images, no `wp.invalid`.
7. `/` and `/news/` still render, and `/<id>` for a **news** post renders the article (not the film layout) — the news path shares `resolveMediaUrl` and `parsePost` with video.
8. A film with **no** ACF data degrades gracefully: no empty pill strip, no phantom poster card.
9. `pnpm film:import --in <sheet>` reports `0 field(s)` — data landed and persisted.
10. 375px and 1440px on `/video/` and one film page.
11. `/health/` returns a plain `ok` (Coolify's probe target — **note the trailing slash**, see §4.6).
12. **No 404 on the live site's real URLs (A8) — the gate that proves the biggest change. Automated: `pnpm url:check`.**
    ```bash
    pnpm url:check                                       # against localhost:3000
    pnpm url:check -- --base https://<stage-host>        # against a deploy
    pnpm url:check -- --top 500 --fail-under 95
    ```
    It replays the real entry URLs from the Yandex Metrica **«Страницы входа»** export (Отчёты → Стандартные отчёты → Содержание → Страницы входа → export; `--csv` to point at a specific file, otherwise the newest export under `~/Documents/od/ya.metrika/`), **ranked by the entry visits each URL actually earns**, and reports results weighted by traffic rather than by URL count. Flags: `--base`, `--csv`, `--top` (default 200), `--concurrency` (default 8), `--fail-under` (exit 1 below that coverage %). The headline number is **«Entry-traffic coverage»**, and failures are automatically grouped by section — no flag needed.

    **Reading the output — two classes of 404 are expected and fine:** pages not yet redesigned (every `/about/*`, `/materials/*`, … until A6 lands), and posts missing from the environment under test (od-dev is a stale copy, so recent ids 404 locally and resolve on prod). **What must never appear is a *shape* failure** — `/<id>/` or `/video/<slug>/` failing across the board, which is the difference between "this section isn't built" and "A8 is broken". Sanity-check that the run covered: one `/category/video/mult/` (256 entries on its own), one `/page/N/`, and one each of `/news/<id>` and `/video/<id>` (proving the fold into `/<id>`). `/category/video/famous/` **is** covered — `resolveLegacyUrl` handles `/category/video/<segment>` generically, and those segments are already our own slugs.

    **Every redirected shape must be a single hop.** The rules live in `src/proxy.ts` (Next 16's renamed middleware), *not* in `next.config.ts` `redirects()` — a config table can't emit a slash-terminated destination under `trailingSlash: true`, so each URL would take two hops. If you ever see a chain of two here, someone has moved a rule back into the config, where it also silently shadows the proxy.

    **Baseline to beat — localhost against od-dev, 2026-08-13: `83.7 %` coverage** (124/200 URLs, 17 492/20 907 visits), zero shape failures. The 16.3 % that failed was 3 190 visits of not-yet-redesigned sections (Materials biggest at 1 280) plus 225 visits of five post ids absent from od-dev (`73381`, `73084`, `72705`, `74794`, `74557` — all `rest_post_invalid_id`). **Against prod those five should resolve, so a prod run before A6 should land near 85 %, and near 100 % after it.** A number materially below that means something is wrong with the URL layer, not with the content.

---

## 6. Launch gate — beyond this runbook

Migrating the data and pointing the app at prod is **not** launch. Still required:

- **A6 legacy-page fallback.** ~170 of 174 pages have no redesigned route; without the catch-all iframe proxy they 404. Needs the frozen copy stood up with a chromeless template + REST, `WP_LEGACY_BASE`, the proxy route and the catch-all. See [`legacy-page-fallback.md` §5](./legacy-page-fallback.md). Those 170 pages are only **~15 % of entry traffic** — see the traffic tiering in [`implementation-plan.md`](./implementation-plan.md#launch-priority--measured-from-real-traffic-yandex-metrica-2026-05-14--2026-08-13) for which of them deserve a native route before prod (Materials index + 4 sub-pages, `/contacts/`, `/profile/[slug]`) and which stay on the fallback.
- ~~**A8 URL compatibility.**~~ **Done 2026-08-13** (`1bd016d`, `f0ac6a9`, `cbfc8d5`) — `/<id>` is served natively, the redirect table covers the `/video/*`, `/category/video/*` and `/page/N/` families, and gate 12 measured **83.7 %** entry-traffic coverage locally with no shape failures. One loose end: re-run gate 12 against a real deploy (od-dev lacks recent posts, so five `/<id>` rows can only settle on prod). Note that **F4's sitemap and canonical tags must emit `/<id>`** or the duplicate-URL problem comes straight back.
- **A4 Yandex Metrica + consent banner**, **F6 152-FZ privacy page** (port the live text, strip the stale Google Analytics reference, keep the СМИ registration line + 12+ badge), **F4 SEO baseline** (`robots.txt`, `sitemap.xml`, OG on the index pages). **A2 is decided** — Beget VPS + Coolify — but the deploy half of **A3** (docker build + push to GHCR, incl. the Dockerfile build-args in §4.7) is still open.
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
