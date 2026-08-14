# Production migration runbook

Everything needed to move the Next.js redesign from **od-dev** to **od-stage** and then **production** (`obshee-delo.ru`), in execution order, with the verification gate for each step.

> **Read this first.** Every step below has been executed **only against od-dev**. od-stage and prod have never been written to (standing scope limit: od-dev only — see [`servers-agent/CLAUDE.md`](../../servers-agent/CLAUDE.md) safety rules). Prod facts in §0 come from a **read-only probe** recorded in [`legacy-page-fallback.md` §2](./legacy-page-fallback.md). Treat them as *expected*, and re-verify in §1 before acting. Run the whole runbook on **od-stage first** — it exists precisely so prod isn't the rehearsal.

Related: [`implementation-plan.md`](./implementation-plan.md) (task state) · [`wp-backend.md`](./wp-backend.md) (hosting, access, plugins) · [`legacy-page-fallback.md`](./legacy-page-fallback.md) (un-redesigned pages).

---

## 0. Hard blockers — nothing works until these are resolved

| # | Blocker | Why it stops the migration | Owner |
|---|---|---|---|
| **B1** | **REST is disabled on prod and stage.** On prod it is exactly one stored option — **`clearfy_option.disable_json_rest_api = 'on'`** (read 2026-08-13; `/wp-json/wp/v2/pages` answers **404**). | The entire app is REST-only (`httpClient.ts` → `WP_BASE/wp-json`). Zero pages render. **This is the single largest blocker** — but see §2.1: it no longer needs anyone's admin login. | ~~WP admin~~ **us, over SSH** |
| **B2** | **Content is CMSMasters shortcodes on prod, Gutenberg on od-dev.** Confirmed for `wp/v2/pages`; **unverified for posts**. | If film/news bodies are `[cmsms_*]`, then `parsePost`, `GutenbergProvider`, `extractFilmPoster` and `absolutizeWpMedia` all degrade to raw shortcode text. See §1.4 — this is the highest-risk unknown. | verify in §1 |
| **B3** | **ACF is not installed on prod/stage.** | No `group_film_meta` ⇒ no `acf` object in REST ⇒ every film affordance disappears. | §2.2 |
| **B4** | **Post ids are per-environment.** | The worksheet we filled holds od-dev ids; importing it into prod would write to unrelated posts. Mitigated by `pnpm film:remap` (§3.2). | §3 |
| **B5** | **Category ids may differ.** `581/580/86/559` are hardcoded — since 2026-08-13 in **one** file, `src/shared/config/filmCategories.ts`. | A wrong id silently empties the catalogue and the related-films strip — it answers 200, so only a count check catches it. | §1.3 + §4.3 |
| **B6** | **Media offload origin unconfirmed for prod.** | `WP_MEDIA_CDN` defaults to the od-dev bucket; a different prod bucket breaks every image. | §1.5 + §4.1 |
| ~~B7~~ | ~~Hosting/deploy target undecided~~ — **decided: Beget VPS + Coolify, images built in GitHub Actions → GHCR.** | Remaining work is the CI push step (§4.7), not a decision. | §4 |
| **B8** | **Only 6 content routes are redesigned** — `/`, `/news/`, `/materials/articles/`, `/video/` + `/video/<segment>/`, and the post detail at `/<id>`. | Launching without the A6 legacy fallback means ~170 pages 404. **Launch gate, not a migration step** — see §6. Those pages are **13.5 % of entry traffic but 20.0 % of pageviews** — the second number is what visitors will actually see. | A6 |
| ~~B9~~ | ~~The redesigned routes don't match live URLs.~~ — **FIXED 2026-08-13 (A8).** `/<id>` is served directly by `app/[...slug]/page.tsx` and the four film categories by `app/video/[segment]/page.tsx`; `src/proxy.ts` (driven by `resolveLegacyUrl` in `src/shared/config/legacyRedirects.ts`) redirects the rest — the **whole** `/category/*` family, `/video/short/` and every `/page/N/` shape — in **a single 301 each**; `trailingSlash: true` matches the live URL form. F4's sitemap/robots/canonicals shipped alongside, so nothing we advertise redirects. | Was **59 % of all site entries**. Now a **verification** concern rather than a build one — gate 12 in §5 is what proves it, and it is scriptable. | verify in §5 |

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
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro term list category --fields=term_id,slug,name,parent,count --format=csv | grep -E "video|movies|mult|roliki|famous|actual|novosti|articles"'
```
Expected on od-dev: parent «Видео» `85`; children Фильмы `581`, Мультфильмы `580`, Ролики `86`, Известные люди `559`; sibling «Видео события» `52`. **Also the two news ids** — Новости `47`, Статьи `578` (count 19) — which drive the `/news/` chips and `/materials/articles/`. **Record the real numbers and their counts** — §4.3 needs the ids, and §5 gates 1–2 and 7 compare against the counts.

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

**2.1 Enable REST (B1).** A `clearfy-pro` setting, not code — its "disable REST API" toggle in the WP admin (Clearfy → API). **It does not require the admin UI**, which matters because prod admin was the item this blocker was waiting on: the toggle is the single key `disable_json_rest_api` inside the `clearfy_option` array, and WP-CLI over `ssh timeweb` can flip it (`'on'` → unset/`''`). The F6 pass used exactly that mechanism to switch on a different clearfy option, so the path is proven. Re-run §1.1 to confirm.

⚠️ **This one is a decision, not a chore** — it opens prod's REST surface to the public internet, so it wants a deliberate go-ahead rather than being flipped in passing. If REST must stay closed to the public, allowlist by path rather than disabling wholesale; the app needs `wp/v2/posts`, `wp/v2/media`, `wp/v2/menus`, `wp/v2/menu-items`.

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

**2.5 Install the revalidation mu-plugin (B4).** Without it an editor publishes and then waits out the hour; with it the page is gone from the cache before they can reload. Source and full reference: [`wp/mu-plugins/od-revalidate.php`](../wp/mu-plugins/od-revalidate.php) and [`wp-backend.md` §6.5](./wp-backend.md). It was installed and tested on od-dev on 2026-08-13; **prod differs in four ways that matter.**

- **Prod is WordPress 5.5.5** (pinned by an active `wp-downgrade`) and its site PHP is **7.x** — `.htaccess` carries an `<IfModule mod_php7.c>` block, while the *CLI* php is 8.2. The plugin is written for that floor on purpose: it hooks `transition_post_status` because **`wp_after_insert_post` does not exist before WP 5.6** and would silently never fire here, and it uses no typed properties, no `str_starts_with` and no `void` returns, because 7.4+ syntax is a **parse error that takes the whole site down** the moment a mu-plugin loads. Don't modernise it, and re-read this line before editing it.
- **The path is `~/public_html/`** — not `~/obshee-delo.ru/` — and every WP-CLI call there needs `--skip-plugins --skip-themes` (§2 of `wp-backend.md`). Verified: a bare `--skip-plugins` skips *regular* plugins only, so the mu-plugin still loads and the checks below work.
- **`wp-content/mu-plugins/` does not exist on prod yet**; it has to be created, as it did on od-dev.
- **No php-fpm.** Prod is Apache mod_php, so `fastcgi_finish_request()` is unavailable and the 5-minute breaker is the only thing standing between a dead frontend and a 5 s penalty on every save. On od-dev that measured 6630 ms for the first save, then 795–1765 ms. Prod carries 25 active plugins and is slower to begin with — budget accordingly, and if editors ever report slow saves, `grep -F "[od-revalidate]" wp-content/debug.log` is the first place to look.

Egress is fine: `wp_remote_get('https://example.com/')` from prod answered **200 in 0.25 s** (checked 2026-08-13), and no `WP_HTTP_BLOCK_EXTERNAL` is defined.

```bash
# 1. Upload, into a directory that does not exist yet
ssh timeweb 'mkdir -p ~/public_html/wp-content/mu-plugins/od-revalidate'
scp wp/mu-plugins/od-revalidate.php timeweb:public_html/wp-content/mu-plugins/od-revalidate.php
ssh timeweb 'chmod 600 ~/public_html/wp-content/mu-plugins/od-revalidate.php && php -l ~/public_html/wp-content/mu-plugins/od-revalidate.php'

# 2. Config, secret over stdin so it never reaches a command line or a shell
#    history. Install it INERT first — URL commented out, secret in place — so
#    the file is in prod before cutover without doing anything.
S=$(openssl rand -hex 32)   # prod's own secret; never stage's, never od-dev's
printf '<?php\ndefined( '"'"'ABSPATH'"'"' ) || exit;\n// defined( '"'"'OD_REVALIDATE_URL'"'"' ) || define( '"'"'OD_REVALIDATE_URL'"'"', '"'"'https://obshee-delo.ru/api/revalidate/'"'"' );\ndefined( '"'"'OD_REVALIDATE_SECRET'"'"' ) || define( '"'"'OD_REVALIDATE_SECRET'"'"', '"'"'%s'"'"' );\n' "$S" \
  | ssh timeweb 'T=~/public_html/wp-content/mu-plugins/od-revalidate/config.php; cat > $T && chmod 600 $T && php -l $T'
# …and put the same $S into the deployment's REVALIDATE_SECRET (§4.1).

# 3. Loaded, and inert as intended?
ssh timeweb 'cd ~/public_html && wp --skip-plugins --skip-themes eval "
  var_dump( class_exists( \"OD_Revalidate\" ), OD_Revalidate::configured() );"'   # true, false
```

**At cutover**, once the frontend is deployed and holds the matching secret, uncomment `OD_REVALIDATE_URL` and verify in this order — **do not test by publishing something on the live site**:

```bash
# a. the two secrets are the same one — compare digests, never values
ssh timeweb 'cd ~/public_html && wp --skip-plugins --skip-themes eval "echo hash( \"sha256\", OD_REVALIDATE_SECRET );"'
node --env-file=.env -e "console.log(require('node:crypto').createHash('sha256').update(process.env.REVALIDATE_SECRET).digest('hex'))"

# b. a purge by hand: expects bool(true), and the frontend answers 200
ssh timeweb 'cd ~/public_html && wp --skip-plugins --skip-themes eval "
  var_dump( OD_Revalidate::send( array( \"tags\" => array( \"wp:menus\" ) ) ) );"'

# c. only then, a real edit — retitle a post to the same title and watch
#    x-nextjs-cache on its page go HIT → MISS
```

**Rollback is deletion.** `rm ~/public_html/wp-content/mu-plugins/od-revalidate.php` and the `od-revalidate/` directory beside it; nothing else in WordPress references either, and the only DB row it can leave is one transient (`wp --skip-plugins --skip-themes transient delete od_revalidate_unreachable`). Deleting the config alone is enough to make it inert.

⚠️ **Two known gaps, both about legacy pages, both live only once A6 ships.** The plugin reports post type `post` only, so **editing a legacy page purges nothing** — the fallback route would serve its cached render for up to an hour. And prod caches its own HTML with **WP Rocket** (§2 of `wp-backend.md`), which the fallback fetches: purging Next before WP Rocket just re-caches the stale copy. When A6 lands, the order is WP Rocket first, then the frontend, and the plugin needs to start sending `paths` for pages — the endpoint already accepts them.
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

**4.1 Environment variables** (per deployment tier — read at module load, so a restart is required after any change; `REVALIDATE_SECRET` is the one exception):

| var | value | note |
|---|---|---|
| `WP_BASE` | target origin, **no** `/wp-json`, no trailing slash | also drives `images.remotePatterns` |
| `WP_USER` / `WP_PASSWORD` | application password for that env | never reuse across envs |
| `WP_MEDIA_CDN` | prod bucket, or `""` to disable the rewrite | defaults to the od-dev Yandex bucket — **override for prod** (B6) |
| `SITE_URL` | the public origin of *this* deployment, no trailing slash | **new with F4.** Feeds `metadataBase`, every `rel=canonical`, `sitemap.xml` and `robots.txt`. Defaults to `https://obshee-delo.ru`, so an unset var on stage makes stage advertise **prod's** URLs — it fails silently and only shows up in a crawler. Set it explicitly on every non-prod tier. |
| `REVALIDATE_SECRET` | a random per-tier secret | **new with B4.** Gates `POST /api/revalidate/`. Unset ⇒ the endpoint 503s and purges nothing, which is the safe default; a tier holding *another* tier's secret is a hole, so generate a fresh one each time. Read per request, so no restart needed. |
| `WP_LEGACY_BASE` | origin of the old site the fallback proxies, no trailing slash | **new with A6.** Live prod (`https://obshee-delo.ru`) until the frozen copy exists; only the origin is kept, any path or query is discarded. Unset ⇒ the fallback is off and ~170 pages 404 exactly as before A6 — safe, and the rollback. **The container needs outbound HTTPS to this origin**; without egress every legacy page 404s and the log fills with `[legacy] upstream error`. **After cutover it must not be this deployment's own origin** — the app then proxies itself, embedding its own shell one frame deeper each time. It warns at boot (`[legacy] WP_LEGACY_BASE is the site's own origin …`) but does not stop, because the two match harmlessly on a developer's machine. |
| `KINESCOPE_TOKEN` | Kinescope API token | **scripts only, never needed at runtime or in the image** — used by `film:kinescope` (§3.6) |

**4.2 Regenerate the API types** once the target serves REST — `redocly.yml` still points at `od-dev.tmweb.ru/wp-json-openapi`:
```bash
pnpm generate:types && npx prettier --write src/types/generated/wp-json-openapi.ts && pnpm type-check
```
> The output path was fixed on 2026-08-13 (it had a stray space and wrote to a directory named `generated `). Prettier is not optional here: the CLI emits double quotes and 4-space indent, so without it the diff is 35 000 lines of formatting instead of the handful that changed.

**4.3 Apply the real category ids (B5)** if §1.3 differed from od-dev. **One file since 2026-08-13** — `src/shared/config/filmCategories.ts`, which holds `FILM_CATEGORIES` (URL segment → id: `filmy` 581, `multy` 580, `roliki` 86, `famous-people` 559) and is read by `/video/` and `/video/<segment>/`, the related-films scope on a film page, the catch-all's SSG seed, `sitemap.xml` and the A8 redirect table. Change the four numbers there and every consumer follows. **Do not rename the keys** — they are the live site's URL segments, and `/video/multy/` and `/video/filmy/` are the #2 and #3 entry pages on the site.

Two things that are *not* in that file and still need a look:
- **`src/shared/config/newsCategories.ts`** — the news equivalent, `NEWS_CATEGORIES` (`nashi-dela` 47 / `articles` 578), equally environment-specific. Read by the `/news/` chips **and** by `/materials/articles/`, so 578 being wrong empties that page as well as the chip. `legacyRedirects.ts` points `/category/novosti/` at the chip **key** and `/category/articles/` at `ARTICLES_HREF`, never at an id, so it follows this file automatically.
- **`scripts/lib/wp.mjs`** — its own `FILM_CATEGORY_IDS` copy, because the scripts are zero-dep Node and can't import TypeScript. ⚠️ **This one is used in §3, before you get here** — a wrong id makes `film:export` write an empty worksheet, which looks like "no films need data" rather than an error. Fix it during §1.3, not §4.3.

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

**4.8 ISR caveat.** The ISR cache lives on the container filesystem, so it is **per-replica**. Scaling past one instance needs a shared `cacheHandler` — and note the same applies to purges: `POST /api/revalidate/` clears the replica that receives it, so on more than one instance every replica has to be hit, or the shared handler must land first.

`revalidate = 3600` everywhere. **On-demand revalidation is built on both sides and waits on one line of config** (B4): the app exposes `POST /api/revalidate/`, every WP fetch is tagged, and the mu-plugin is installed on od-dev — but with `OD_REVALIDATE_URL` commented out, because there was no deployment to purge. Per tier: set `REVALIDATE_SECRET` on the frontend, then point WP's `OD_REVALIDATE_URL` at `https://<that tier>/api/revalidate/` (trailing slash — the bare form is a 308 and WP does not re-POST). Verify the two secrets match by digest, never by printing them; the whole procedure is [`wp-backend.md` §6.5](./wp-backend.md). Skip it and WP edits take up to an hour to appear — tell the editors, or close the loop first. **Give each tier its own secret**; prod's on stage is access to prod's cache.

⚠️ **One WP install can only notify one frontend.** `OD_REVALIDATE_URL` is a single constant, so pointing od-dev at a stage deployment means a local dev server never gets purged — and pointing prod's WP at stage would silently leave prod stale. It is per-install config, not per-tier-pair.

---

## 5. Verification gates

Run against the deployed target, not localhost.

Post detail lives at the bare **`/<id>`** since A8 — that is the *only* address it has, so gates 3–5 must use it. `/video/<id>` and `/news/<id>` were this project's own pre-launch shape and now **404 by design**; if either answers 200, someone has re-added a route that gives one film two URLs.

1. `/video/` — 200, ten cards, pagination present. Card count should equal §1.6's four-category total (od-dev: 99), **not** the full `format=video` count.
2. Each category is its own page — `/video/filmy/`, `/video/multy/`, `/video/roliki/`, `/video/famous-people/` — 200 with no redirect hop, and each count matches WP (od-dev: 23 / 8 / 15 / 55). An unknown segment such as `/video/nonsense/` must **404**, not serve «Все».
3. `/<id>` for a film with downloads — pills render with durations; share tiles show the VK/Rutube/YouTube brand marks; breadcrumbs «Видео → title».
4. `/<id>` for a film with `kinescope_id` — the Kinescope iframe plays. 70 of 99 qualify on od-dev after §3.6.
5. `/<id>` for a film with a poster — the sidebar плакат card renders with «Скачать плакат».
6. Card thumbnails resolve (covers from §3.5) — no broken images, no `wp.invalid`.
7. `/` and `/news/` still render, and `/<id>` for a **news** post renders the article (not the film layout) — the news path shares `resolveMediaUrl` and `parsePost` with video.
    - `/materials/articles/` — 200, and the card count equals the «Статьи» category count from §1.3 (od-dev: **19**). A count of 0 or of *every* post means `NEWS_CATEGORIES.articles` has the wrong id for this environment (§4.3) — both answer 200, so only the count catches it.
    - Its `<link rel="canonical">` is `<SITE_URL>/materials/articles/`, and `/news/?category=articles` carries **the same** canonical while `/news/?category=articles&page=2` carries its own. That pair is the whole point of the alias; if the first two diverge the collection has two addresses again.
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

    **Reading the output — two classes of 404 are expected and fine:** pages not yet redesigned (every `/about/*`, `/materials/*`, … until A6 lands), and posts missing from the environment under test (od-dev is a stale copy, so recent ids 404 locally and resolve on prod). **What must never appear is a *shape* failure** — `/<id>/` or `/video/<segment>/` failing across the board, which is the difference between "this section isn't built" and "A8 is broken". Sanity-check that the run covered: one `/video/<segment>/` served directly, one `/category/video/mult/` (256 entries on its own), one `/page/N/`, and one `/category/<anything-else>/`. **Nothing under `/category/` may 404** — the proxy redirects that family exhaustively, including the ~88 `/category/oblast/<region>/` archives and the Cyrillic slugs, so a 404 there means the catch-all rule was lost.

    **Run this after every deploy, not just before launch.** Since A6 it is the fallback's only production
    signal: there is no alerting stack here, so a silent regression on ~170 pages would otherwise be noticed
    first by a visitor. The number to watch is **98.8 %** (measured 2026-08-14 with the fallback on); a drop
    back toward 83.7 % means the fallback is not serving. The container logs are the second signal, and are
    greppable by design — `[legacy] WP_LEGACY_BASE missing` once at boot explains a fleet-wide 404, a rising
    rate of `[legacy] upstream <status> for <path>` is the legacy origin failing, `[legacy] rejected path` is
    someone probing, `[legacy] boundary miss` is a legacy page whose markup changed shape.

    **Every redirected shape must be a single 301 hop, and every served shape zero.** The rules live in `src/proxy.ts` (Next 16's renamed middleware), *not* in `next.config.ts` `redirects()` — a config table can't emit a slash-terminated destination under `trailingSlash: true`, so each URL would take two hops. If you ever see a chain of two here, someone has moved a rule back into the config, where it also silently shadows the proxy. **A redirect answering 200 is not proof it worked:** twice during A8 a rule pointed at a filter value the destination didn't recognise, which renders an *unfiltered* list at status 200. Check the content, not the status.

    **Also verify what the site advertises** (F4, shipped with A8): `/sitemap.xml` is a well-formed XML with ~8 000 `<loc>` entries, every one slash-terminated and none of them a URL that redirects; `/robots.txt` names that sitemap at the **production** host — which comes from `SITE_URL` (§4.1), so a missing env var here publishes 8 000 canonical URLs pointing at the wrong domain.

    **Baseline to beat — localhost against od-dev, 2026-08-13: `84.2 %` coverage** (125/200 URLs, 17 606/20 907 visits), zero shape failures. It was 83.7 % before the `/materials/articles/` alias route added its 114 visits. The 15.8 % that failed is 3 076 visits of not-yet-redesigned sections (Materials still biggest at 1 166) plus 225 visits of five post ids absent from od-dev (`73381`, `73084`, `72705`, `74794`, `74557` — all `rest_post_invalid_id`). **Against prod those five should resolve, so a prod run before A6 should land near 85 %, and near 100 % after it.** A number materially below that means something is wrong with the URL layer, not with the content.

---

## 6. Launch gate — beyond this runbook

Migrating the data and pointing the app at prod is **not** launch. Still required:

- ~~**A6 legacy-page fallback.**~~ **Done 2026-08-14.** The ~170 pages are served at their live URLs through `app/legacy/[...slug]/route.ts` inside the layout's shell; gate 12 went from 83.7 % to **98.8 %** entry-traffic coverage, and a sweep over all 172 pages in the legacy sitemap found no page losing a script, keeping its chrome or leaking a link (`pnpm legacy:sweep`). It did **not** need the frozen copy: `WP_LEGACY_BASE` points at live prod and the proxy strips the chrome itself. **Three operational leaves:** set `WP_LEGACY_BASE` per tier (§4.1) and confirm the container's outbound HTTPS to it; point it at the frozen copy once that exists, because after cutover this app *is* `obshee-delo.ru` and the fallback would proxy itself; and the tiering in [`implementation-plan.md`](./implementation-plan.md#launch-priority) still stands for which pages deserve a native route rather than an iframe (Materials index + `plakati`/`zakladki`/`metodichki`, `/contacts/`, `/profile/[slug]`) — those 170 pages are 13.5 % of entry traffic but **20.0 % of pageviews**.
- ~~**A8 URL compatibility.**~~ **Done 2026-08-13** (`1bd016d`, `f0ac6a9`, `cbfc8d5`, `908b292`, `ea290ac`) — `/<id>` and `/video/<segment>/` are served natively, the proxy redirects the whole `/category/*` family plus the `/video/short/` and `/page/N/` shapes at one 301 each, and gate 12 measured **84.2 %** entry-traffic coverage locally with no shape failures. **Two loose ends, both operational:** re-run gate 12 against a real deploy (od-dev lacks recent posts, so five `/<id>` rows can only settle on prod), and set `SITE_URL` per tier (§4.1).
- ~~**F4 SEO baseline**~~ — **the URL-facing half is done** (`ea290ac`): `sitemap.xml` (8 248 URLs), `robots.txt`, `metadataBase` and self-referential canonicals on every route, per-page OG on the indexes. **Still open before launch: JSON-LD** (`NewsArticle` / `VideoObject` / `Organization`) and an OG image fallback.
- **A4 Yandex Metrica + consent banner** — the counter is **34478865** (read off prod's live tag). ~~**F6** 152-FZ privacy page~~ ✅ **done on prod 2026-08-13**, not ported into the repo: `/conf_politics/` is Tier 4, so the A6 fallback serves prod's own page and prod is where the text was corrected (notes §5). The СМИ registration line and 12+ badge come from od-dev widget `block-27` and are already rendered by C9's footer — but **two hrefs in that widget break on this origin**, see F6 in the plan. **A2 is decided** — Beget VPS + Coolify — but the deploy half of **A3** (docker build + push to GHCR, incl. the Dockerfile build-args in §4.7) is still open.
- ~~**B4 on-demand revalidation.**~~ **Done 2026-08-13** — both halves ship and were tested against od-dev (egress works; the mu-plugin is installed there). What is left is not a build task but two lines of per-tier config at deploy time, in §4.8: `REVALIDATE_SECRET` on the frontend and `OD_REVALIDATE_URL` on the WP install that feeds it. Skip that and editors wait an hour.
- **B8 WordPress plugin cleanup** is **not** required for the frontend, with one exception: removing `clearfy-pro` is what permanently fixes both the REST block (B1) and the WP-CLI redirect gotcha. Everything else in B8 is hygiene.

---

## 7. Rollback

Nothing here is destructive, but in order of blast radius:

- **Frontend** — redeploy the previous image, or repoint `WP_BASE` back at od-dev. No WP state involved.
- **ACF values** — the importer only ever *fills* empty fields, so a bad import adds rather than destroys. To revert a specific film, put `-` in the offending cells and re-import (that's the explicit clear token). Keep the pre-import `film:export` sheet — it **is** your backup of prior values.
- **Cover uploads** — `film:covers` only touches posts with no featured image. To undo, unset `featured_media` and delete the `film-cover-<id>.jpg` attachments.
- **ACF field group** — deactivating the ACF plugin hides the fields from REST but leaves postmeta intact; re-activating restores everything.
- **Before starting on prod**, take a DB snapshot through the Timeweb panel — the migration writes postmeta across ~30 posts and uploads ~23 attachments.
