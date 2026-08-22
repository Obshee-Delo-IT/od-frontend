# Test scenarios

**What to test, from eleven angles, and which of them already runs.** This is the catalogue: one numbered
section per lens, one entry per scenario, each with the failure mode it exists to catch and either the test
that already covers it or the word **gap**. It is a checklist for a release and a work list for the test suite
— not a procedure. The migration-day procedure is [`prod-migration-runbook.md`](./prod-migration-runbook.md)
(§0.7 traps, §5 verification gates, §6 launch gate), and the A6 change's own 114-scenario plan stays where it
is, in [`openspec/changes/fallback/verification-plan.md`](../openspec/changes/fallback/verification-plan.md);
this file does not restate either.

**The organising idea is the lens.** A single reading of this codebase finds the obvious defects and stops.
Eleven independent readings — routing, data, cache, SEO, accessibility, cascade, security, performance, the
WordPress side, delivery, and the visitor's own journey — find the ones that live between two subsystems,
because each subsystem's owner assumed the other had it. Several scenarios below exist only because that seam
is where this project's real bugs came from: a redirect that answers 200 with unfiltered content, a menu that
renders empty at 200, an H1 that is 48px in `next dev` and 24px in `next start`.

**Grounding.** Every scenario names a real path, command, URL, Russian string or measured number. Where a
scenario says **gap**, no test covers it today — that is the claim, and every `covered_by` was opened and
checked rather than assumed, which demoted four of them to **gap**: a suite that asserts the mocked or
pure-function half of a defect is not coverage of the defect. Two caveats on citations: a `path:NN` line
number drifts with the next commit, so the path is the durable half, and the counts quoted in a scenario
(`83` catalogue films, `8 426` sitemap URLs, `168` pages) are dated the day it was written — re-derive them
from the script that owns them (`pnpm pages:inventory`, `pnpm url:check`) before failing a test on one.

## How to read an entry

- **Priority.** `P0` gates a release or breaks measured traffic — `/video/` and `/video/<segment>/` are the #2
  and #3 entry pages, and 59 % of search entries land on a legacy URL shape. `P1` is a defect a visitor
  notices. `P2` is worth having.
- **Kind.** `unit` (Vitest) · `e2e` (Playwright) · `php` (`wp/tests/*.test.php`) · `script` (a `pnpm` tool) ·
  `build` (needs `pnpm build && pnpm start`) · `infra` (container, CI, tier) · `manual`.
- **Covered by** is an existing test file, or **gap**. A covered scenario stays in the catalogue as the anchor
  for that behaviour — it is where you look when the behaviour changes on purpose.

## What already runs

| harness                                      | scale                                                                                                            | runs where                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Vitest (`pnpm test`)                         | 82 files, ~558 cases                                                                                             | every commit, and in CI on every PR and on `main`                        |
| PHP suites (`php wp/tests/<name>.test.php`)  | 5 suites (`od-pages`, `od-wp`, `od-revalidate`, `od-regions`, `cmsms-upgrade`), ~890 `od_test()` calls           | by hand, when `wp/` changes — **not** in CI                              |
| Playwright (`pnpm test:e2e`)                 | 2 specs, ~30 tests, `desktop-1440` + `mobile-390`                                                                | by hand against a running server — **deliberately not** in CI            |
| `pnpm url:check`                             | the live site's real entry URLs from Yandex Metrica, traffic-weighted                                            | by hand after touching routing or `src/proxy.ts`                         |
| `pnpm legacy:sweep` · `pnpm pages:inventory` | all legacy pages · all 168 published WP pages                                                                    | by hand; the second one dates [`page-inventory.md`](./page-inventory.md) |
| CI (`.github/workflows/ci.yml`)              | `next typegen` → `lint` → `type-check` → `test` → `build`, **without WP secrets**; then an `image` job on `main` | GitHub Actions                                                           |

Three consequences worth saying out loud, because most of the P0 gaps below sit in them: **CI cannot see WP
data** (it builds against a stub, and the first container run against the prod clone found three defects CI had
passed), **CI cannot see a browser** (the Playwright specs are out of it on purpose), and **`next dev` cannot
see the cascade or the ISR contract** (`pnpm build && pnpm start` is the only gate that does).

## Gates — when a group of these runs

| gate                              | trigger                                                                          | what to run                                                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1 · block**                    | every block of work, before the commit                                           | `pnpm lint` · `pnpm type-check` · `pnpm test`; plus the five PHP suites if `wp/` changed                                                                                                        |
| **G2 · CI**                       | every PR and every push to `main`                                                | the CI job as configured — no WP secrets, so treat a green run as necessary and never sufficient                                                                                                |
| **G3 · routing**                  | after touching `src/proxy.ts`, `legacyRedirects.ts`, any route, or a category id | `pnpm url:check`, then every `P0` in §1                                                                                                                                                         |
| **G4 · production build**         | before believing anything about cache, cascade or the legacy route               | `pnpm build && pnpm start`, then every `build`-kind scenario in §3, §6 and §8                                                                                                                   |
| **G5 · stage**                    | after the `image` job deploys `https://new.obshee-delo.ru`                       | `/health/`, `pnpm url:check` against the container, §4's per-tier checks (`SITE_URL`, `noindex`), and §11's journeys                                                                            |
| **G6 · pre-cutover**              | before the domain swap                                                           | §9 in full, `pnpm legacy:sweep`, `pnpm pages:inventory`, and the runbook's own §5 gates                                                                                                         |
| **G7 · first hour after cutover** | the DNS move is live                                                             | §10's post-cutover scenarios: `pnpm url:check` against prod, a real editor edit through `POST /api/revalidate/`, the frozen copy answering, the social-card cache purge, Metrica receiving hits |

## Coverage

| §      | lens                                                | scenarios |     P0 |     P1 |     P2 | covered |     gap | the P0 set                                                                     |
| ------ | --------------------------------------------------- | --------: | -----: | -----: | -----: | ------: | ------: | ------------------------------------------------------------------------------ |
| **1**  | Routing & URL compatibility                         |        16 |      8 |      6 |      2 |       9 |       7 | ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, ROUTE-06, ROUTE-07, ROUTE-08 |
| **2**  | WordPress data layer & content pipeline             |        12 |      5 |      5 |      2 |       1 |      11 | DATA-01, DATA-02, DATA-04, DATA-05, GAP-02                                     |
| **3**  | Caching, ISR, revalidation & dev-vs-prod divergence |        16 |      4 |      9 |      3 |       1 |      15 | CACHE-01, CACHE-02, CACHE-03, CACHE-04                                         |
| **4**  | SEO, metadata & crawlability                        |        16 |      4 |      9 |      3 |       5 |      11 | SEO-01, SEO-02, SEO-04, SEO-05                                                 |
| **5**  | Accessibility & assistive-technology behaviour      |        16 |      4 |      9 |      3 |       7 |       9 | A11Y-01, A11Y-02, A11Y-03, A11Y-04                                             |
| **6**  | Responsive layout & CSS-cascade fidelity            |        16 |      4 |      9 |      3 |       0 |      16 | CSS-01, CSS-02, CSS-03, CSS-04                                                 |
| **7**  | Security, privacy & 152-FZ consent                  |        17 |      5 |     10 |      2 |       3 |      14 | SEC-01, SEC-02, SEC-03, SEC-04, GAP-01                                         |
| **8**  | Performance & media delivery                        |        17 |      3 |     10 |      4 |       2 |      15 | PERF-01, PERF-02, PERF-03                                                      |
| **9**  | WordPress-side PHP, content scripts & mu-plugins    |        18 |      9 |      8 |      1 |       3 |      15 | WP-01, WP-02, WP-03, WP-04, WP-05, WP-06, WP-07, WP-08, WP-09                  |
| **10** | Build, container, CI/CD, cutover & rollback         |        19 |      7 |      8 |      4 |       1 |      18 | OPS-01, OPS-02, OPS-03, OPS-04, OPS-06, OPS-07, GAP-09                         |
| **11** | End-user journeys & editorial-content regression    |        14 |      4 |      8 |      2 |      10 |       4 | JRN-01, JRN-03, JRN-04, JRN-05                                                 |
|        | **total**                                           |   **177** | **57** | **91** | **29** |  **42** | **135** |                                                                                |

**How to read that table.** 135 of the 177 are gaps, and the shape of them says more than the count. By kind
the catalogue is 80 `manual`, 27 `unit`, 20 `e2e`, 15 `infra`, 13 `script`, 13 `build` and 9 `php` — so what
the existing suites cover is very nearly the whole set of things a pure function can assert, and almost
everything uncovered needs something a unit test cannot have: a browser (§5, §6), a production build (§3, §8),
a container or a second tier (§10), or a WordPress install with real content (§2, §9). That is a fair
description of this project rather than an indictment of its suite — 82 Vitest files and five PHP suites are a
lot of coverage of the half that is testable in process.

**The cheapest ways to move the number**, in order: put the five PHP suites and the two Playwright specs into
CI (they exist and pass today — see §10), add an axe pass to the two Playwright projects (several of §5 at
once), and run §6 as a single `pnpm build && pnpm start` screenshot comparison rather than sixteen separate
tests. §9's nine P0s are the other concentration worth attention, because a mu-plugin that fatals takes the
whole WordPress site with it and nothing in CI looks at PHP at all.

## 1. Routing & URL compatibility

_For every URL shape the live site or a crawler can produce: does this app answer at the right address, with the right status, in exactly the right number of hops — and does it refuse the addresses it promised not to serve?_

#### ROUTE-01 · P0 · manual — 404 `/news/<id>/` and `/video/<id>/` — the pre-launch post URLs that must not exist

- **Given** A production build with `WP_LEGACY_BASE` set (od-stage `https://new.obshee-delo.ru`, or local `pnpm build && SITE_URL=http://localhost:3000 pnpm start`). Post 60862 is a news post; 67400 is a film.
- **When** GET `/news/60862/`, `/news/99999999/`, `/video/67400/` and the real address `/60862/`, without following redirects.
- **Then** `/video/67400/` → 404 (the `[segment]` route wins and `resolveFilmCategory('67400')` is null). `/news/60862/` and `/news/99999999/` must also → 404. Measured 2026-08-22 against `pnpm dev` on :3001 both answer **200**, body carrying `<iframe … src="/legacy/news/60862/">`, `<title>Наши дела — Общее дело</title>` and `rel="canonical" href="https://obshee-delo.ru/news/60862/"` — a self-canonicalising 200 for every integer under `/news/`. `/60862/` → 200 with 0 redirects.
- **Verify:** `for p in /news/60862/ /news/99999999/ /video/67400/ /60862/; do curl -s -o /dev/null -w "$p %{http_code}\n" https://new.obshee-delo.ru$p; done`
- **Why:** `docs/prod-migration-runbook.md` §5 preamble: «/video/<id> and /news/<id> … now 404 by design; if either answers 200, someone has re-added a route that gives one film two URLs». Nobody re-added a route — `src/app/[...slug]/page.tsx:206-247` hands any non-numeric, non-embed-listed slug to the A6 fallback, which only `notFound()`s on a definitive upstream 404/410 (:236). WordPress resolves `/news/<junk>/` onto its own «Наши дела» archive, so the loader gets a 200. · **Covered by:** **gap**

#### ROUTE-02 · P0 · manual — Serve all four `/video/<segment>/` pages at zero hops and 404 an unknown segment

- **Given** od-stage (`https://new.obshee-delo.ru`). Metrica 91 days: `/video/multy/` 1 174 entry visits, `/video/filmy/` 1 106, `/video/roliki/` 228, `/video/famous-people/` 21 — the #2 and #3 entry pages of the whole site.
- **When** GET each of the four segments, then `/video/nonsense/`, `/video/constructor/`, `/video/movies/` and `/video/short/`.
- **Then** The four → 200 with `%{num_redirects}` = 0 and a card grid (filmy renders 10 cards on page 1 of 3, multy 8). `/video/nonsense/`, `/video/constructor/` and `/video/movies/` → 404, never a 200 copy of «Все». `/video/short/` → exactly one 301 to `/video/`.
- **Verify:** `for p in filmy multy roliki famous-people nonsense constructor movies short; do curl -s -o /dev/null -w "$p %{http_code} %{num_redirects}h\n" -L https://new.obshee-delo.ru/video/$p/; done`
- **Why:** `src/app/video/[segment]/page.tsx:34-40` turns an unresolved segment into `notFound()` precisely so `/video/<anything>/` cannot spawn soft-404 duplicates; `src/shared/config/filmCategories.ts:44-45` uses `Object.hasOwn` for the `/video/constructor/` case; `movies` is the WP spelling that must stay a `/category/` alias only. Runbook §5 gate 2: «An unknown segment such as /video/nonsense/ must **404**, not serve «Все»». · **Covered by:** `src/shared/config/filmCategories.test.ts`

#### ROUTE-03 · P0 · manual — Take exactly one 301 hop on every redirected legacy shape, never 308, never a chain

- **Given** A deployed tier with `src/proxy.ts` active and no `redirects()` table in `next.config.ts`. `trailingSlash: true`.
- **When** GET each of `/video/short/`, `/video/filmy/page/2/`, `/news/page/3/`, `/page/2/`, `/category/video/mult/`, `/category/video/movies/page/3/`, `/category/video/`, `/category/novosti/`, `/category/articles/`, `/category/oblast/piter/page/19/` — first without `-L` to read the status, then with `-L` to count hops.
- **Then** First response is **301** (not 308, not 302) for all ten; `%{num_redirects}` with `-L` is exactly **1** and the final status is 200. Measured 2026-08-22: `/video/short/`→`/video/`, `/category/video/mult/`→`/video/multy/`, `/video/filmy/page/2/`→`/video/filmy/?page=2`, `/news/page/3/`→`/news/?page=3`, `/category/articles/`→`/materials/articles/` — all 1 hop. A 308 anywhere, or 2 hops, means a rule was moved into `next.config.ts` `redirects()`, which strips the destination's trailing slash and then normalises it back on.
- **Verify:** `for p in /video/short/ /video/filmy/page/2/ /news/page/3/ /page/2/ /category/video/mult/ /category/video/movies/page/3/ /category/video/ /category/novosti/ /category/articles/ /category/oblast/piter/page/19/; do printf '%s ' $p; curl -s -o /dev/null -w '%{http_code} ' https://new.obshee-delo.ru$p; curl -s -o /dev/null -L -w '%{num_redirects}h %{url_effective}\n' https://new.obshee-delo.ru$p; done`
- **Why:** `src/proxy.ts:41-47` chooses 301 over 308 because Yandex documents 301/302 only and never confirmed it consolidates signals across a 308; `src/shared/config/legacyRedirects.ts:51-59` returns the already-normalised slash-terminated path so Next has nothing left to redirect. Runbook §5 gate 12: «Every redirected shape must be a single 301 hop, and every served shape zero… If you ever see a chain of two here, someone has moved a rule back into the config, where it also silently shadows the proxy». · **Covered by:** `src/shared/config/legacyRedirects.test.ts`

#### ROUTE-04 · P0 · manual — Catch a redirect that lands on an unrecognised filter value by the page count, not the status

- **Given** `/news/` and `/video/[segment]` resolve their filter by **key**, never by WP id (`NEWS_CATEGORIES` nashi-dela 47 / articles 578). `PER_PAGE` on `/news/` is 15.
- **When** GET `/news/?category=nashi-dela`, `/news/?category=47`, `/news/?category=articles`, `/news/?category=constructor` and read the **highest `?page=` number in the rendered pagination**, plus each page's `rel=canonical`.
- **Then** Measured 2026-08-22: nashi-dela → last page **526** and canonical `…/news/?category=nashi-dela`; `?category=47` → **550** (the unfiltered feed) and canonical `…/news/` — i.e. it honestly declares it applied no filter; `?category=articles` → **2** and canonical `…/materials/articles/`; `?category=constructor` → 550, canonical `…/news/`. Any destination produced by `resolveLegacyUrl` that renders 550 while naming a category is the bug. Card counts on page 1 are 15 for all of them and cannot distinguish them — the page count can.
- **Verify:** `for q in 'category=nashi-dela' 'category=47' 'category=articles' 'category=constructor'; do printf '%s last=' $q; curl -s "https://new.obshee-delo.ru/news/?$q" | grep -oE 'page=[0-9]+' | sed 's/page=//' | sort -n | tail -1; done; pnpm test src/shared/config/legacyRedirects.test.ts`
- **Why:** `src/shared/config/newsCategories.ts:5-8` — «Pointing a link or a redirect at `?category=578` answers **200 with an unfiltered list**… That bug shipped twice during A8». Runbook §0.7 frontend table: «a category page answers 200 with everything, or with nothing … **Status cannot catch this**». `legacyRedirects.test.ts:51` already asserts no destination carries a numeric id; nothing compares a rendered result count against WP. · **Covered by:** **gap**

#### ROUTE-05 · P0 · manual — Serve post detail at the bare `/<id>/` for both post kinds with no redirect

- **Given** od-stage. Bare `/<id>/` entry paths carry **11 656 of 25 938 entry visits** in the 91-day Metrica export (44.9 %) — the single biggest URL shape on the site.
- **When** GET `/71933/` (a film with a Kinescope id), `/19123/` (another film), a recent news id such as `/60862/`, and a nonexistent `/99999999/`.
- **Then** Each real id → 200 with `%{num_redirects}` = 0. A film id renders the FilmPage (breadcrumbs «Видео → title», a `kinescope.io/embed` iframe — `/71933/` embeds `q2ufLsHSSxyYp6teUUke92`); a news id renders the article layout, not the film layout. `/99999999/` → 404 (the `_fields` probe finds no post). No `/<id>/` ever redirects to `/news/<id>/` or `/video/<id>/`.
- **Verify:** `for p in /71933/ /19123/ /60862/ /99999999/; do curl -s -o /dev/null -w "$p %{http_code} %{num_redirects}h\n" -L https://new.obshee-delo.ru$p; done; curl -s https://new.obshee-delo.ru/71933/ | grep -c kinescope.io/embed`
- **Why:** `src/app/[...slug]/page.tsx:42` + `:91-101` — `legacyPostId` only accepts a single all-digit segment, and `resolvePostKind` uses a raw `wpFetch` because a 404 there is an expected answer, not an error. The module header (:19-26) records the 46 % measurement. Runbook §5 preamble makes gates 3-5 use the bare `/<id>` «that is the _only_ address it has». · **Covered by:** **gap**

#### ROUTE-06 · P0 · manual — Answer every /category/\* URL, including the bare root and Cyrillic slugs

- **Given** WordPress's own `/category/` URL space, ~90 mostly regional archives the redesign has no equivalent for. `/category/video/mult/` alone is 256 entry visits in 91 days; `/category/video/movies/` is 21.
- **When** GET `/category/`, `/category` (slashless), `/category/oblast/`, `/category/oblast/piter/`, `/category/metodic/`, the Cyrillic `/category/вс-рф/` (sent percent-encoded as `/category/%D0%B2%D1%81-%D1%80%D1%84/`), `/category/oblast/piter/page/19/` and `/category/video/page/3/`.
- **Then** Nothing under `/category/` answers 404. Measured 2026-08-22: `/category/` → 301 `/news/` (the proxy matcher `/category/:path*` does fire with zero trailing segments), `/category` (slashless) → 308 `/category/` then 301 `/news/`, `/category/oblast/piter/` → 301 `/news/`, the percent-encoded Cyrillic slug → 301 `/news/`, `/category/oblast/piter/page/19/` → 301 `/news/` with the page number deliberately dropped, `/category/video/page/3/` → 301 `/video/?page=3`.
- **Verify:** `for p in /category/ /category /category/oblast/ /category/oblast/piter/ /category/metodic/ /category/%D0%B2%D1%81-%D1%80%D1%84/ /category/oblast/piter/page/19/ /category/video/page/3/; do printf '%s ' $p; curl -s -o /dev/null -L -w '%{http_code} %{num_redirects}h %{url_effective}\n' https://new.obshee-delo.ru$p; done`
- **Why:** `src/shared/config/legacyRedirects.ts:97-108` closes the family on purpose — «nothing under it is built, and nothing under it 404s» — and drops `/page/N/` because page 20 of «Питер» and page 20 of the whole feed are unrelated sets. Runbook §5 gate 12: «**Nothing under /category/ may 404** … a 404 there means the catch-all rule was lost». The bare `/category/` is the untested boundary: it depends on `src/proxy.ts:51`'s `:path*` matching zero segments, which no unit test can observe. · **Covered by:** `src/shared/config/legacyRedirects.test.ts`

#### ROUTE-07 · P0 · manual — Serve the legacy page that was asked for, not whatever the upstream redirects to

- **Given** The A6 fallback follows same-origin redirects, once (`src/shared/legacy/loadLegacyDocument.ts:32`, `MAX_REDIRECTS = 1`). `WP_LEGACY_BASE` currently points at live prod; after cutover it points at `frozen.obshee-delo.ru`.
- **When** GET three fallback paths whose content differs — `/actual/`, `/get-involved/join/`, `/materials/pppuiv-constructor/` — and read each rendered `<title>`. Then GET an invented deep path, `/a/b/c/d/e/f/`.
- **Then** The three titles must differ from each other and from the frozen copy's home title. Measured 2026-08-22 the invented `/a/b/c/d/e/f/` answers **200** with `<iframe src="/legacy/a/b/c/d/e/f/">` and `<title>Известные люди — Общее дело</title>` — an unrelated page's content at a URL that does not exist. After cutover, if all three fallback titles come back identical, the frozen copy carries a blanket `frozen/* → frozen/` 301 and ~170 URLs are serving the home page at 200.
- **Verify:** `for p in /actual/ /get-involved/join/ /materials/pppuiv-constructor/ /a/b/c/d/e/f/; do printf '%s ' $p; curl -s https://new.obshee-delo.ru$p | grep -oE '<title>[^<]*</title>'; done`
- **Why:** `docs/prod-migration-runbook.md` §0.7: «**every legacy page renders the frozen copy's home page**, at 200 — a blanket frozen/* → frozen/ 301: the loader follows same-origin redirects» → close it with `Require ip`, never a redirect (§5.6). `src/app/legacy/[...slug]/route.test.ts` asserts same-origin redirects *are\* followed (the correct behaviour); nothing asserts the document that comes back is the page asked for. · **Covered by:** **gap**

#### ROUTE-08 · P0 · manual — Resolve percent-encoded Cyrillic paths on every routing surface

- **Given** Next hands route params **percent-encoded**. The Metrica export holds **37 Cyrillic entry paths** out of 3 417; the highest-ranked is `/profile/дегтярёв-алексей-анатольевич/` at rank **125** (13 visits) and the next at rank 279 — so the default `--top 200` covers exactly one of them.
- **When** GET `/добровольчество/` (a legacy-embed page), `/profile/дегтярёв-алексей-анатольевич/` (a profile CPT route), `/about/департаменты/` (a passthrough WP page) and `/category/%D0%B2%D1%81-%D1%80%D1%84/`, in both their literal and percent-encoded forms.
- **Then** All four resolve: the embed page 200 with an iframe, the profile 200 with the PersonCard, the WP page 200 with its own `<h1>`, the category slug 301 → `/news/`. Measured 2026-08-22 `/добровольчество/` and its `%D0%B4…` form both answer 200. A 404 on any of them means the character allowlist saw the escaped bytes — the failure that once 404'd every Cyrillic URL on the site.
- **Verify:** `for p in '/добровольчество/' '/profile/дегтярёв-алексей-анатольевич/' '/about/департаменты/'; do printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://new.obshee-delo.ru$p"; done; pnpm url:check -- --base https://new.obshee-delo.ru --top 200 | grep -i 'coverage'`
- **Why:** `src/shared/legacy/legacyPath.ts:11-21` — «This file originally asserted the opposite… measured, /profile/дегтярёв-алексей-анатольевич/ reached the loader as %D0%B4%D0%B5%D0%B3… and was rejected, so every Cyrillic legacy URL 404'd»; `decodeSegments` (:59-77) decodes exactly once — one `decodeURIComponent` per segment, `null` on a malformed escape — so `%2e%2e` and `%2f` stay refused by `ALLOWED_SEGMENT = /^[\p{L}\p{N}\-_.~]+$/u`. The register records the class as open: it survived 515 unit tests, 48 browser tests and a 172-page sweep because every fixture is ASCII, and only `pnpm url:check` found it. `/профиль/` slugs are most of the `/profile/*` family's 566 entry visits. · **Covered by:** `src/shared/legacy/legacyPath.test.ts`

#### ROUTE-09 · P1 · script — Fail the url:check gate on purpose — it exits 0 and follows redirects by default

- **Given** `pnpm url:check` is the A8 regression gate. Its `OPTIONS` default `fail-under` to `'0'` and its per-URL fetch uses `redirect: 'follow'`. The newest export is `~/Documents/od/ya.metrika/Страницы входа-2026-05-14-2026-08-13.csv`: 3 417 distinct paths, top 200 = 20 907 of 25 938 visits.
- **When** Run it three ways: bare, with `--fail-under 95`, and with a deliberately broken redirect table (e.g. temporarily point `/video/short/` at `/video`, slashless) to see whether the gate notices the extra hop.
- **Then** Bare run: prints «Entry-traffic coverage: NN.N %» and exits **0** even at 0 % — `echo $?` proves it. With `--fail-under 95` it exits 1 below the threshold. The broken two-hop table still reports 200 and still passes, because the fetch follows redirects — so hop counting must come from ROUTE-03, not from here. The export contains **no** `/page/N/` and **no** `/news/page/N/` rows at all (only `/actual/page/{2,3,4,10}/` and `/category/oblast/piter/page/19/`), so those two shapes are never replayed by this gate.
- **Verify:** `pnpm url:check -- --base https://new.obshee-delo.ru --top 500 --fail-under 95; echo "exit=$?"`
- **Why:** `scripts/check-legacy-urls.mjs:102-111` («`redirect: 'follow'` on purpose — a 308 into a working page is a pass») and `:176-179` (`if (failUnder > 0 && …)`), plus `:86-88` which drops every row carrying a query string. Runbook §5 gate 12 sets the numbers to beat: 98.8 % measured 2026-08-14, 99.7 % on new.obshee-delo.ru, against an 83.7 % pre-fallback baseline; «a drop back toward 83.7 % means the fallback is not serving». · **Covered by:** **gap**

#### ROUTE-10 · P1 · unit — Terminate every internal href with a slash so no site link costs a 308

- **Given** `trailingSlash: true`, so the slashless twin of every path is a 308. `canonicalUrl()` already guarantees the slash for metadata (`src/shared/config/site.ts:76-81`); the rendered hrefs have no such guard.
- **When** Grep the tree for slash-less internal hrefs, then click each in a browser and watch the network panel.
- **Then** Three call sites currently emit one: `src/modules/Home/sections/Hero.tsx:64` `href="/get-involved"` (the home «Прими участие» CTA, and `/get-involved/` is an A6 iframe page with 84 entry visits), `src/modules/Home/sections/NewsGrid.tsx:73` `href="/news"` («Все новости»), and `src/app/news/page.tsx:34-43` `buildHref`, which returns `/news?category=…` for every chip and every pagination link. Measured 2026-08-22: `/news` → 308 `/news/`, `/news?page=2` → 308 `/news/?page=2`, `/get-involved` → 308 `/get-involved/`. Pass = every internal href ends in `/` before its `?`, matching `catalogueHref` and `paginatedPath`.
- **Verify:** `grep -rn --include='*.tsx' -E 'href=("|.\x27)/[a-z0-9/-]*[a-z0-9](\x27|")' src | grep -v '\.test\.'; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/news`
- **Why:** `src/shared/config/filmCategories.ts:52-53` and `src/shared/lib/wpContent/resolveQueryPagination.ts:14-17` both slash-terminate for exactly this reason («`trailingSlash: true` makes the slashless twin a 301, so linking or canonicalising to one would point at a redirect»), and the home film row's «Все видео (83)» CTA goes through `catalogueHref` for the same stated reason (`src/modules/Home/sections/FilmsCarousel.tsx:56-57`, «`/video` is a 301 hop under `trailingSlash: true`»); `newsCategories.test.ts:32` asserts it for `ARTICLES_HREF`. The three sites above were never covered, and `pnpm url:check` cannot see them — it drops every query-carrying row and follows redirects anyway. · **Covered by:** **gap**

#### ROUTE-11 · P1 · manual — Normalise the trailing slash in both directions — /health, /sitemap.xml, bare ids

- **Given** `trailingSlash: true` adds a 308 for the slashless form of a path and the inverse 308 for a dotted last segment. Coolify's probe and the `robots.txt` sitemap line both depend on getting this right.
- **When** GET `/health` and `/health/`, `/sitemap.xml` and `/sitemap.xml/`, `/robots.txt`, `/198` and `/198/`, `/favicon.png/`.
- **Then** Measured 2026-08-22: `/health` → 308 `/health/`, `/health/` → 200 body `ok`; `/sitemap.xml` → 200 XML, `/sitemap.xml/` → 308 `/sitemap.xml`; `/robots.txt` → 200; `/198` → 308 `/198/`; `/favicon.png/` → 308 `/favicon.png`. The Coolify health check must be configured on **/health/**; `robots.txt`'s `Sitemap:` line must name the slash-less `/sitemap.xml`.
- **Verify:** `for p in /health /health/ /sitemap.xml /sitemap.xml/ /robots.txt /198 /favicon.png/; do printf '%-16s ' $p; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://new.obshee-delo.ru$p; done`
- **Why:** `src/app/health/route.ts:10-12` — «**Probe /health/ with the trailing slash** … a probe that doesn't follow redirects would never see the 200»; `src/shared/config/site.ts:83-92` (`fileUrl`, «the one place `canonicalUrl` must not be used: it would produce …/sitemap.xml/, and `trailingSlash` installs the inverse redirect»). Runbook §0.7: «/health is a 308 → probe /health/ (§4.6)». `health/route.test.ts` calls the handler directly, so Next's own normalisation — where the 308 comes from — is never exercised. · **Covered by:** **gap**

#### ROUTE-12 · P1 · manual — Let a native route shadow a WP page and retire its legacy fallback with no config edit

- **Given** Nine published WP pages sit behind native routes (`page-inventory.md` §2): `/`, `/news/`, `/materials/articles/`, `/video/` and the four segments, plus `/video/short/` by 301. App Router precedence gives a real route priority over `[...slug]`, and `src/shared/config/legacyEmbedPages.ts` lists neither `/news/` nor `/video/famous-people/` for that reason.
- **When** GET `/`, `/news/`, `/video/`, `/video/famous-people/`, `/materials/articles/` and confirm none renders a `LegacyEmbed` iframe or a `WpPage` body. Then check the two directions of the exception list: `/actual/` (listed → iframe even though WP has a page) and `/materials/` (unlisted → native `WpPage`).
- **Then** None of the nine contains `src="/legacy/`; `/materials/articles/` renders 19 post links (the «Статьи» category count) rather than the WP page's 14 curated ones; `/actual/` renders `<iframe … src="/legacy/actual/">`; `/materials/` renders the WP body with no iframe. Adding a route for a listed path must retire its fallback with the list untouched.
- **Verify:** `for p in / /news/ /video/ /video/famous-people/ /materials/articles/ /materials/ /actual/; do printf '%-24s ' $p; curl -s https://new.obshee-delo.ru$p | grep -c 'src="/legacy/'; done`
- **Why:** `src/app/[...slug]/page.tsx:33-37` and `src/shared/legacy/isEmbeddable.ts:6-10` both state it: «Adding a native route retires that path's fallback with no edit here… This is about not embedding a request for /favicon.png». `src/shared/config/legacyEmbedPages.ts:50-51` records the three of 23 cmsms pages that «can't reach this route at all — `/`, `/news/` and `/video/famous-people/` are native routes» (`LEGACY_EMBED_PAGES` itself is :78-85, six entries). `page-inventory.md` §1a: 142 of 148 prod pages render natively, 6 on the iframe. · **Covered by:** `src/app/[...slug]/legacyBranch.test.tsx`

#### ROUTE-13 · P1 · unit — Keep «короткометражки» out of FILM_CATEGORIES so /video/short/ stays a redirect

- **Given** `/video/short/` carries 33 entry visits in 91 days. There is no WP category behind it — the live page is a hand-curated list — so `resolveLegacyUrl` sends it to `/video/`.
- **When** Run the config suites, then GET `/video/short/`. Mutation check: add `short: <any id>` to `FILM_CATEGORIES` and re-run.
- **Then** `resolveFilmCategory('short')` is null and `/video/short/` answers exactly one 301 to `/video/`. With `short` added, the `[segment]` route claims the URL, the 301 becomes a 200, and the page shows whichever films that id holds — the test suite must fail rather than let that ship. Renaming any of the four keys (`filmy`, `multy`, `roliki`, `famous-people`) must also fail: they are live URLs carrying 1 106 + 1 174 + 228 + 21 entry visits.
- **Verify:** `pnpm test src/shared/config/filmCategories.test.ts src/shared/config/legacyRedirects.test.ts && curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://new.obshee-delo.ru/video/short/`
- **Why:** `src/shared/config/filmCategories.ts:14-17` — «Adding it here would turn that redirect into a 200 showing the wrong films, since `/video/[segment]` serves exactly these keys»; :4-7 «the URL segment _is_ the identity», and CLAUDE.md states the consequence: «The keys are live URLs — renaming one 404s real traffic». Note `scripts/lib/wp.mjs` keeps its own copy of the ids (CLAUDE.md, runbook §0.7 «pnpm film:export writes an empty worksheet»), which no test links to this one. · **Covered by:** `src/shared/config/filmCategories.test.ts`

#### ROUTE-14 · P1 · manual — Refuse traversal, reserved prefixes and over-deep paths at the legacy proxy

- **Given** `MAX_DEPTH` is 6 (`src/shared/legacy/isEmbeddable.ts:23`) and `RESERVED_FIRST_SEGMENTS` is `{legacy, _next, api}` (:16). The path allowlist is Unicode letters/digits plus `-` `_` `.` `~`, applied after exactly one decode.
- **When** GET `/legacy/`, `/legacy/team/`, `/legacy/%2e%2e%2f%2e%2e%2fetc/`, `/legacy/%252e%252e/`, `/legacy/team%2fx/`, `/api/nope/`, `/_next/nope/`, `/a/b/c/d/e/f/` (depth 6) and `/a/b/c/d/e/f/g/` (depth 7).
- **Then** Measured 2026-08-22: `/legacy/team/` → 200 with `x-robots-tag: noindex` and `content-security-policy: frame-ancestors 'self'`; `/legacy/` → 404; all three encoded-traversal forms → 404; `/legacy/team%2fx/` → 404; `/api/nope/` and `/_next/nope/` → 404 with no upstream fetch; depth 6 → served, depth 7 → 404. No response body ever contains `/etc/` content and no `[legacy] rejected path` line is missing from the container log for the refused ones.
- **Verify:** `for p in /legacy/ /legacy/team/ /legacy/%2e%2e%2f%2e%2e%2fetc/ /legacy/%252e%252e/ /legacy/team%2fx/ /api/nope/ /_next/nope/ /a/b/c/d/e/f/ /a/b/c/d/e/f/g/; do printf '%-38s ' $p; curl -s -o /dev/null -w '%{http_code}\n' https://new.obshee-delo.ru$p; done; curl -sI https://new.obshee-delo.ru/legacy/team/ | grep -iE 'x-robots-tag|content-security'`
- **Why:** `src/shared/legacy/legacyPath.ts:5-9` (the allowlist «written as an allowlist … rejected by not being on the list rather than by a rule naming it», `ALLOWED_SEGMENT` at :25) and :17-21 («What is never done is decoding in a loop until it stops changing»); `src/app/legacy/[...slug]/route.ts:50-55` applies the _same_ `isEmbeddable` as the page «so the two surfaces cannot disagree about which paths exist». The depth-6/7 pair is the bound and one over from the verification plan's Case Design. · **Covered by:** `src/shared/legacy/isEmbeddable.test.ts`

#### ROUTE-15 · P2 · manual — Answer /actual/page/2/ — a legacy-embed page's own path pagination currently 404s

- **Given** `/actual/` is one of the six paths on `LEGACY_EMBED_PAGES`. The Metrica export holds `/actual/page/2/` (2 visits), `/actual/page/10/`, `/actual/page/3/` and `/actual/page/4/` (1 each) — five entry visits in 91 days on a shape the live site paginates.
- **When** GET `/actual/`, `/actual/page/2/`, `/actual/page/10/`, `/get-involved/page/2/`, and for contrast `/about/smi/page/2/` and `/contacts/samarskaya/page/2/`.
- **Then** Measured 2026-08-22: `/actual/` → 200 (embed), `/actual/page/2/` → **404**, `/actual/page/10/` → 404, `/get-involved/page/2/` → 404, while `/about/smi/page/2/` → 200 and `/contacts/samarskaya/page/2/` → 200. Decide and record the intended answer — either the embed serves the paginated legacy URL, or the shape 301s to `/actual/` — but a 404 on a URL the live site serves is the one outcome that costs traffic.
- **Verify:** `for p in /actual/ /actual/page/2/ /actual/page/10/ /get-involved/page/2/ /about/smi/page/2/; do printf '%-26s ' $p; curl -s -o /dev/null -w '%{http_code}\n' https://new.obshee-delo.ru$p; done`
- **Why:** `src/app/[...slug]/page.tsx:214-228` — `splitPageNumber` strips `page/N`, `nativeWpPath` returns null for a path on `legacyEmbedPages.ts`, and the `if (pageNumber > 1) notFound()` on :226 then fires because «A /page/N/ WordPress could not serve is not a legacy address either». That reasoning holds for `/news/` and `/category/*`, which the proxy owns, but not for an embed page whose own upstream still paginates. · **Covered by:** `src/app/[...slug]/legacyBranch.test.tsx`

#### ROUTE-16 · P2 · manual — Rewrite /legacy-font/\* to the legacy theme, and 404 anything that is not a woff

- **Given** Fonts are fetched under CORS and the legacy origin sends no `Access-Control-Allow-Origin`, so `src/proxy.ts:31-34` rewrites (never redirects) `/legacy-font/*` onto `WP_LEGACY_BASE`'s `welfare` theme. Unsetting `WP_LEGACY_BASE` must make it 404, since that is the documented rollback.
- **When** GET `/legacy-font/css/fonts/fontello.woff`, `/legacy-font/fonts/MyriadPro-Cond.woff`, `/legacy-font/x.css`, `/legacy-font/a/../../b.woff`, then restart with `WP_LEGACY_BASE` unset and repeat the first one.
- **Then** Measured 2026-08-22: `fontello.woff` → 200, content-type `application/font-woff`, **265 744 bytes**; `MyriadPro-Cond.woff` → 200, **51 308 bytes**; `/legacy-font/x.css` → 404; the `..`-carrying path → 404. Neither font response is a 3xx (a redirect would send the browser back to the blocked cross-origin fetch). With `WP_LEGACY_BASE` unset, `fontello.woff` → 404 and no request leaves the container.
- **Verify:** `for p in /legacy-font/css/fonts/fontello.woff /legacy-font/fonts/MyriadPro-Cond.woff /legacy-font/x.css '/legacy-font/a/../../b.woff'; do printf '%-46s ' "$p"; curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' "https://new.obshee-delo.ru$p"; done`
- **Why:** `src/shared/legacy/legacyFonts.ts:4-11` records the measurement behind it («three requests, three `net::ERR_FAILED`») and :64-76 is the positive shape («No %, so nothing arrives encoded… no `..`, so the composed path cannot climb out of the theme directory»). `src/proxy.ts:24-30`: it lives in the proxy rather than `next.config.ts` `rewrites()` because that table is baked at build time and «`WP_LEGACY_BASE` being unset — the documented rollback — has to disable this with it». · **Covered by:** `src/shared/legacy/legacyFonts.test.ts`

## 2. WordPress data layer & content pipeline

_Does what WordPress actually returns — including the shapes it returns for missing, unpublished, non-ASCII or environment-specific data — survive the fetcher-and-transform pipeline into correct rendered HTML?_

#### DATA-01 · P0 · unit — Serve 404 for a draft post at /73790/ instead of rendering it publicly

- **Given** od-stage (prod clone, `https://new.obshee-delo.ru` against `WP_BASE=https://od.webtm.ru`). Measured 2026-08-22: `/wp/v2/posts` reports 8 284 published and 8 404 with `status=any` — 120 drafts, 25 of them `format=video`. The frontend authenticates as `WP_USER` with an application password.
- **When** Request the bare `/<id>/` of a draft post: `/73790/` (draft news) and `/67436/` (draft film, titled «Untitled»).
- **Then** Both answer 404. Today both answer 200 and render the article: `/73790/` ships `<title>Общества «Знание», в рамках акции «Служу Отечеству»</title>` and `/67436/` ships `<title>Untitled — ОБЩЕЕ ДЕЛО</title>`. The same ids requested anonymously from WP return 401 `rest_forbidden`, so the frontend is the only thing publishing them.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}\n' https://new.obshee-delo.ru/73790/` — expect 404, today 200. Draft inventory: `curl -sI -u "$WP_USER:$WP_PASSWORD" 'https://od.webtm.ru/wp-json/wp/v2/posts?status=draft&per_page=1' | grep -i x-wp-total`
- **Why:** WP's single-item GET returns a non-published post to any user with `edit_post`, and nothing in the numeric branch looks at status: `resolvePostKind` asks only `_fields=id,format` (`src/app/[...slug]/page.tsx:92`), `fetchVideo` checks only `post.format !== 'video'` (`src/shared/api/fetchVideo.ts:27`), `cachedFetchNews` passes the id straight through (`src/shared/api/fetchNews.ts`). Collections default to `publish`, so drafts are absent from the sitemap and every listing — which is why nobody noticed. `docs/prod-migration-runbook.md` §3.3 already records that production keeps 19 catalogue films as drafts. · **Covered by:** **gap**

#### DATA-02 · P0 · unit — Fall back to an empty nav, not to every menu, when main-navigation is missing

- **Given** A WordPress install where no `nav_menu` carries the slug `main-navigation` — production's state before §0.6 item 6 (menu 39 is _named_ `footer-navigation`; on od-stage its slug has already been fixed and it holds 35 items, 7 of them top-level).
- **When** `HeaderServer` runs: `fetchMenus({slug:'main-navigation'})` returns `[]`, so `menuId` is `undefined` and `fetchMenuItems` is called with `menus: [undefined]`.
- **Then** The header renders 0 top-level nav items, or the fetcher refuses the call. Today openapi-fetch drops a query parameter whose array holds only `undefined` — verified by capturing the `Request`, the URL comes out as `/wp-json/wp/v2/menu-items` with no filter at all — so WordPress answers with 94 menu items drawn from every menu on the install, several titled «Untitled», and `toNavItems` turns every `parent:0` among them into a top-level entry.
- **Verify:** `curl -s -u "$WP_USER:$WP_PASSWORD" 'https://od.webtm.ru/wp-json/wp/v2/menu-items?_fields=id,title,menus' | grep -o '"id"' | wc -l` → 94, against the same URL plus `&menus=39` → 35. Read `src/modules/Header/HeaderServer.tsx:9-12`.
- **Why:** `HeaderServer.tsx:12` writes `menus: [menuId!]` — the non-null assertion is the whole bug, and it fails open rather than empty. `docs/prod-migration-runbook.md` §0.7 predicts «the header renders empty»; the measured failure mode is worse than that, and no test can see it because `toNavItems.test.ts` only maps data that already arrived. · **Covered by:** **gap**

#### DATA-04 · P0 · manual — Match /video/ and each category count against WordPress's own X-WP-Total

- **Given** od-stage, measured 2026-08-22 via `X-WP-Total`: `format=video` scoped to categories 581,580,86,559 = 83; `filmy` 581 = 25; `multy` 580 = 10; `roliki` 86 = 13; `famous-people` 559 = 36; `HOME_FILM_CATEGORY_IDS` (581,580) = 35; unscoped `format=video` = 187; news 47 = 7 937, 578 = 19.
- **When** Load `/video/`, `/video/filmy/`, `/video/multy/`, `/video/roliki/`, `/video/famous-people/`, `/materials/articles/` and the home page.
- **Then** `/video/multy/` shows 10 cards and no pagination; `/video/filmy/` shows 10 with pagination totalling 25; `/materials/articles/` shows exactly 19 cards; the home «Наши фильмы и мультфильмы» row is scoped to 581,580 (35) but its CTA counts the whole catalogue and reads «Все видео (83)» — not (187), not (35), and not a bare «Все видео». Every count equals the corresponding `X-WP-Total`. A count of 0, or of every post, means the ids in `filmCategories.ts` / `newsCategories.ts` describe a different install.
- **Verify:** `curl -s https://new.obshee-delo.ru/video/multy/ | grep -o 'href="/[0-9]\{4,6\}/"' | sort -u | wc -l` → 10; `curl -sI -u "$WP_USER:$WP_PASSWORD" 'https://od.webtm.ru/wp-json/wp/v2/posts?format=video&categories=580&per_page=1' | grep -i x-wp-total` → 10; the CTA's number against the catalogue probe: `curl -s https://new.obshee-delo.ru/ | grep -o 'Все видео ([0-9]*)'` versus `…?format=video&categories=581,580,86,559&per_page=1` → 83.
- **Why:** The ids are environment-specific and live in three places — `src/shared/config/filmCategories.ts:20-23`, `src/shared/config/newsCategories.ts:14-16` and `scripts/lib/wp.mjs`'s own copy (zero-dep Node cannot import TS). A wrong id answers 200 with everything or nothing, so only the count catches it (`docs/prod-migration-runbook.md` §5 gates 1–2 and 7, §4.3). `fetchFilms.test.ts` pins the query shape after commit 759b710; nothing compares a rendered count against WP. · **Covered by:** **gap**

#### DATA-05 · P0 · unit — Survive a WordPress 401 without 500ing every route on the site

- **Given** A WP host that answers 401 to the frontend's Basic auth — HTTP Basic added on `wp.obshee-delo.ru` (Apache validates the same `Authorization` header the application password travels in), or an application password rotated without a redeploy. `WP_USER`/`WP_PASSWORD` are read once at module load (`src/shared/api/httpClient.ts:4-20`), so nothing re-reads them.
- **When** Any page renders. The root layout's `HeaderServer` (`fetchMenus`, `fetchMenuItems`) and `Footer` (`fetchFooter`) go through the typed client; the listings and the catch-all go through raw `wpFetch`.
- **Then** Every route still answers 200 with an empty shell plus one greppable log line naming the 401. Today the two halves diverge: the typed client's error-throwing middleware throws — verified, `Error(': 401 ')` — which takes the root layout down and makes every route a 500, while `wpFetch`-based fetchers silently return `{items:[],total:0}`. Neither logs anything.
- **Verify:** Point a local `.env` at the real `WP_BASE` with a deliberately wrong `WP_PASSWORD`, then `pnpm build && pnpm start` and `curl -sI localhost:3000/`. Read `src/shared/api/httpClient.ts:30-36` (the throwing middleware) against `src/shared/api/httpClient.ts:45-58` (`wpFetch`, which returns the `Response`).
- **Why:** `docs/prod-migration-runbook.md` §5.6 carries two rows for this — «the frontend goes blind on every WP request, 401» and «editors cannot save in the block editor» — and makes never-Basic-on-that-host a cutover rule. `httpClient.test.ts` only asserts the header is injected on a 200, and vitest always runs against the stub client (it prints the «WP_BASE … missing» warning), so the auth path is never exercised by the suite at all. · **Covered by:** **gap**

#### DATA-07 · P1 · unit — Decode WP title entities in every fetcher, fetchSearch included

- **Given** 1 114 of 8 241 published titles carry guillemet entities; `title.rendered` is HTML and every display site (cards, `<h1>`, breadcrumbs, `<title>`, `alt`, `aria-label`) prints it as text.
- **When** Enumerate every mapper that reads a WP title and assert `stripHtml` ran; and feed `stripHtml` two adjacent block-level tags with no whitespace between them: `'<p>a</p><p>b</p>'`.
- **Then** `stripHtml('<p>a</p><p>b</p>') === 'a b'` — a tag becomes a space, never nothing. And every title mapper decodes: `fetchFilms.ts:70`, `fetchLatestNews.ts:36`, `fetchNewsList.ts:59`, `fetchVideoList.ts:129`, `fetchWpPage.ts:93` and `:186`, `fetchProfile.ts:80`, `toNavItems.ts:36` all do; `src/shared/api/fetchSearch.ts:110` does not — it maps `title: result.title ?? ''` raw, so «&#171;Спасибо за жизнь&#187;» would print literally across the whole B7 results surface.
- **Verify:** `pnpm test src/shared/api/newsPreview.test.ts`, then `grep -rn "title:" src/shared/api/fetch*.ts | grep -v stripHtml` — `fetchSearch.ts:110` is the only hit.
- **Why:** Commit 07a13ec fixed this «at the fetcher boundary» precisely so a new mapper cannot reintroduce it, and the risk register records that no invariant test asserts every fetcher decodes. `newsPreview.test.ts:6` asserts `'<p>Hello   <strong>world</strong></p>'` → `'Hello world'`, which passes whether a tag becomes a space or nothing — so the glue case the doc comment (`newsPreview.ts:10-13`) exists for is untested. · **Covered by:** **gap**

#### DATA-08 · P1 · manual — Degrade film 38424 gracefully with all 18 ACF fields empty

- **Given** od-stage film 38424 «Влияние кино на общество. Николай Бурляев»: the `group_film_meta` group exposes all 18 keys and every one is empty, `featured_media` is 0, and the body holds no `<img>`. Four more films are in the same state: 37626, 33638, 32168, 31445.
- **When** Load `/38424/` and find the same film's card on `/video/famous-people/`. Separately, map a post whose only populated download slot is `download_3_url`, with slots 1 and 2 empty.
- **Then** `/38424/` renders the `<h1>`, breadcrumbs «Видео → …» and the body only: no Kinescope iframe, no «Смотреть онлайн» tiles, no «Скачать фильм бесплатно» label, no empty pill strip, no poster card with «Скачать плакат», and zero `fetchPriority="high"` images (measured: 0). Its card shows the no-artwork placeholder, not a broken image. The download-slot case yields exactly one pill, labelled from `download_3_label` or «Скачать фильм».
- **Verify:** `curl -s https://new.obshee-delo.ru/38424/ | grep -c 'kinescope\|Скачать плакат\|Скачать фильм бесплатно'` → 0. ACF state: `curl -s -u "$WP_USER:$WP_PASSWORD" 'https://od.webtm.ru/wp-json/wp/v2/posts/38424?_fields=acf'`
- **Why:** `docs/prod-migration-runbook.md` §5 gate 8 («no empty pill strip, no phantom poster card») is hand-run. The null guards exist — `FilmActions.tsx:28-29` returns null, `FilmPlayer.tsx:65-67` returns null, `FilmPage.tsx:124` gates the poster card — but nothing exercises them together, and the neighbouring §0.7 row («ACF fields are missing from `/wp/v2/posts?format=video`») is the harder case where `post.acf` is absent entirely rather than empty (`fetchVideoList.ts:125`, `post.acf ?? {}`). · **Covered by:** **gap**

#### DATA-09 · P1 · manual — Preload a film's artwork once, not twice, when it comes from the body

- **Given** od-stage: the 83 catalogue films partition as 45 with a featured image, 2 whose artwork falls back to a body image (15068, 14590), 31 to the Kinescope `poster.jpg` (which HEADs 302 to its CDN), and 5 with none at all.
- **When** Load `/15068/` (film, artwork from the body) and `/73790/` (news article), and count `rel="preload"` … `as="image"` links and `fetchPriority="high"` images in each.
- **Then** One preload and one high-priority image per document. `/73790/` is correct — one `<img fetchPriority="high">` plus its matching preload. `/15068/` ships two preloads for the same photo at two different URLs: the raw CDN full-size (from `resolveContentAssets`' eager first image) and a `/_next/image` variant (from `FilmPlayer`'s `<Image priority>`, `FilmPlayer.tsx:44`), so the LCP image downloads twice. Also assert a footer widget image never carries `fetchPriority`.
- **Verify:** `curl -s https://new.obshee-delo.ru/15068/ | grep -o 'rel="preload"[^>]*as="image"' | wc -l` → expect 1, today 2. Read `src/modules/Video/FilmPage/FilmPage.tsx:99-107` against `src/shared/lib/wpContent/resolveContentAssets.ts:111-121`.
- **Why:** `extractFilmPoster` lifts the _poster_ figure out of the body, but a film's `thumbnailUrl` comes from `extractFirstImage` over that same body (`fetchVideoList.ts:132-134`), so the image handed to `FilmPlayer` is still in the body when `resolveContentHtml(html, true)` marks the first image eager. `resolveContentAssets.test.ts` covers the transform in isolation; nothing counts how many high-priority images one page ends up with — the same mechanism commit f6ef5e7 measured for cross-page prefetch. · **Covered by:** **gap**

#### DATA-10 · P1 · manual — Carry X-WP-Total through to pagination and the «Все видео (83)» count

- **Given** Every paginated fetcher reads `X-WP-Total` / `X-WP-TotalPages`: `fetchNewsList.ts:52-53`, `fetchVideoList.ts:182-183`, `fetchSearch.ts:103-104`, and `fetchFilms.ts:62`, which reads `catalogueTotal` from a count-only probe with `?? 0` and has no `items.length` fallback. Measured on od.webtm.ru, both headers are present.
- **When** Load the home page (`FILMS_ON_HOME = 12` at `src/app/page.tsx:46`, catalogue total 83) and `/video/filmy/` (25 films, `per_page` 10), then request page 4 of `/video/filmy/`, past the end.
- **Then** The home CTA reads «Все видео (83)» (`FilmsCarousel.tsx:62`) and `/video/filmy/` renders a pagination strip of 3 pages. A stripped `X-WP-Total` collapses both silently — `catalogueTotal` becomes 0, `0 > 12` is false, so the CTA degrades to a bare «Все видео» while every card still renders, and pagination disappears at `totalPages` 0. Page 4 renders the empty state rather than throwing: WP answers 400 and the fetcher returns `{items:[],totalPages:0,total:0}`.
- **Verify:** `curl -s https://new.obshee-delo.ru/ | grep -o 'Все видео ([0-9]*)'` — an empty result is either a build predating dc7fc9f or a lost header; distinguish with `curl -sI -u "$WP_USER:$WP_PASSWORD" 'https://od.webtm.ru/wp-json/wp/v2/posts?format=video&categories=581,580,86,559&per_page=1' | grep -i x-wp-total` → 83.
- **Why:** `X-WP-Total` is not a CORS-safelisted header and is exactly the kind of thing a cache or WAF in front of WordPress drops; the failure is a missing count and a missing pagination strip, both at 200. `src/modules/Home/sections/FilmsCarousel.tsx:62` is the only place on the site that prints a WP total to the visitor, which makes it the cheapest probe. `fetchVideoList.test.ts` covers the header read and the 400-page case; nothing checks the headers survive on a deployed tier. · **Covered by:** **gap**

#### DATA-11 · P1 · manual — Keep literal [cmsms_…] out of rendered bodies after the plugin is deleted

- **Given** Production still holds CMSMasters shortcodes and `cmsms-content-composer` is deleted during cutover (`docs/prod-migration-runbook.md` §2.6 step 3). A shortcode whose plugin is gone renders as its own source text inside `content.rendered`, which the frontend prints verbatim. Baseline on od-stage 2026-08-22: 0 of 148 published pages and 0 of the four known posts (41045, 56178, 62556, 64555) render a literal `[cmsms_`.
- **When** After the plugin directory is deleted and the migration has run, re-render the 11 pages and 4 posts `legacyEmbedPages.ts` names, plus a sweep of published pages' `content.rendered`.
- **Then** Zero occurrences of the substring `'[cmsms_'` in any rendered page or post body. A page printing «[cmsms_sidebar]» as visible text is the failure, and it answers 200 with no warning on either side.
- **Verify:** `for id in 41045 56178 62556 64555; do curl -s https://new.obshee-delo.ru/$id/ | grep -c '\[cmsms_'; done` → all 0; plus the DB-side count in `docs/prod-migration-runbook.md` §5 gate 14.
- **Why:** `src/shared/config/legacyEmbedPages.ts` records the whole trap in its header comment: the low shortcode count was taken from `content.rendered`, where an active plugin has already expanded them, the four post ids each expand to «under 450 bytes», and «the frozen copy keeps the plugin, this install eventually will not, and a shortcode with no plugin renders as its own source text». Gate 14 counts rows in `wp_posts`; nothing checks the rendered page, and no transform in `src/shared/lib/wpContent` detects a leftover shortcode. · **Covered by:** **gap**

#### DATA-13 · P2 · unit — Render no empty hero slot for a post with no carousel or gallery

- **Given** `parsePost` lifts the first `.wp-block-cb-carousel-v2` or `.wp-block-gallery` into a `header` slot (on for posts and films, off for pages via `liftHeader:false`). Most posts carry neither, so `parsePost` returns `header === ''`.
- **When** Render `NewsArticle` for a post whose body has no carousel and no gallery — e.g. `/38424/` — and a page whose gallery sits inside a column (`WpPage`).
- **Then** No empty `.gutenberg` element with a 20–32px bottom margin between the breadcrumbs and the date when `header` is `''`. And on a page the gallery stays in the body with its sibling text intact — `WpPage` never lifts, because the lift removes the matched block's whole parent (both od-dev pages carrying a gallery would lose a sibling).
- **Verify:** `pnpm test src/shared/lib/wpContent/parsePost.test.tsx`; read the unconditional wrapper at `src/modules/News/NewsArticle/NewsArticle.tsx:110-120`.
- **Why:** `NewsArticle.tsx:117-119` always renders `<ImagePreviewClient><GutenbergProvider>{parsed.header}</GutenbergProvider></ImagePreviewClient>` inside a margin-bearing `Box`, with no test for the empty case; `parsePost.test.tsx` covers the lift and the `liftHeader:false` opt-out (`docs/wp-page-passthrough.md` §2, `docs/wp-page-redesign.md`) but not what an empty header slot renders as. · **Covered by:** **gap**

#### DATA-14 · P2 · unit — Sentence-case only a heading with no lowercase letter anywhere in it

- **Given** `resolveHeadingCase` replaced `.wp-block-group h2 { text-transform: lowercase }`, which was right for the 50 all-caps post headings and wrong for the 26 page headings carrying a proper noun past the first word (measured od-dev 2026-08-20).
- **When** Run the transform over: «ЗДОРОВАЯ РОССИЯ» (all caps), «Здоровая Россия — ОБЩЕЕ ДЕЛО!» (one lowercase letter present), «&laquo;ОБЩЕЕ ДЕЛО&raquo;» (lowercase only inside entities), a heading opening with an `<a>`, and «2021» (no letters).
- **Then** Only the first and third are rewritten. «Здоровая Россия — ОБЩЕЕ ДЕЛО!» and «Абонентам Мегафон» come back byte-identical; the entity case becomes «&laquo;Общее дело&raquo;» with the entities intact and the `l` of `laquo` untouched; the anchor-opening heading capitalises its first letter of text, not the tag's `a`; the digits-only heading is untouched.
- **Verify:** `pnpm test src/shared/lib/wpContent/resolveHeadingCase.test.ts`
- **Why:** This is the pipeline's only content-mutating transform — a regression silently rewrites headings on 26 pages, and CSS could not make the distinction at all (`src/shared/lib/wpContent/resolveHeadingCase.ts:39-64` for the measurement, `:72` for the condition). Keeping it in the catalogue anchors the rule «has no lowercase letter is the whole condition», which is what a future contributor is most likely to widen. · **Covered by:** `src/shared/lib/wpContent/resolveHeadingCase.test.ts`

#### GAP-02 · P0 · unit — Survive a WordPress 200 that is not JSON — WAF page, maintenance notice, cached HTML

- **Given** Every fetcher does `(await res.json()) as …` with no guard once `res.ok` is true — `fetchFilms.ts:66`, `fetchVideoList.ts:184`, `fetchNewsList.ts:54`, `fetchWpPage.ts`, and the catch-all's `resolvePostKind` at `src/app/[...slug]/page.tsx:96`. The typed client's throwing middleware only inspects `response.ok`. Production sits behind a host that serves an HTML interstitial for a rate-limited or challenged request, and WP Rocket is active on the live install (commit 4eec9f9).
- **When** Stub the fetch to answer 200 with `content-type: text/html` and a `<!DOCTYPE html>` body for (a) a listing fetcher, (b) `resolvePostKind`, (c) `fetchFooter` through the typed client, and (d) the sitemap's post crawl. Then the same with a 200 and an empty body, and with `content-type: application/json` and a truncated body.
- **Then** Each surface degrades the way its 4xx path already does — an empty listing, a `null` post kind, `data ?? []` for the footer, and the sitemap's coverage floor throwing (`src/app/sitemap.ts:164-165`) rather than publishing a short file — and each logs one greppable line naming the content type it got. No route answers 500, and `/` never renders a 200 with a stack trace. Today (c) throws out of the root layout and takes every route down; (a), (b) and (d) reject an unhandled `SyntaxError`.
- **Verify:** `pnpm test src/shared/api` after adding the cases; `grep -rn 'res.json()' src/shared/api src/app | grep -v test` enumerates the call sites that need the guard.
- **Why:** DATA-05 covers the 401 and is the only non-2xx scenario in the set — it explicitly notes the two halves of the client diverge and that vitest always runs against the stub, so the real response path is never exercised. A 200-with-HTML is the failure mode a cache or WAF in front of WordPress actually produces, it is indistinguishable from success at the `res.ok` check every fetcher makes, and it arrives on cutover day rather than in a test. · **Covered by:** **gap**

## 3. Caching, ISR, revalidation & dev-vs-prod divergence

_When WordPress changes, which cache between WP and the visitor still holds the old answer — and which of these behaviours appears only under `pnpm build && pnpm start`, never in `next dev`?_

#### CACHE-01 · P0 · build — Serve every A6 fallback path from a production build on a clean .next

- **Given** a clean checkout on `main` with `.env` present (WP_BASE → od-stage, WP_LEGACY_BASE=https://obshee-delo.ru) and `.next` deleted, so no ISR entry from a previous run can answer. `next dev` returns 200 for all of these even when the production build 500s, so a dev server is not a substitute.
- **When** `rm -rf .next && pnpm build && SITE_URL=http://localhost:3100 pnpm start -p 3100`, then request three of the six `LEGACY_EMBED_PAGES` — `/actual/`, `/get-involved/`, `/materials/pppuiv-constructor/` — plus a path nothing answers for, `/no-such-page-xyz/`.
- **Then** 200, 200, 200 and 404. The `pnpm start` log contains zero `⨯` lines and no `DYNAMIC_SERVER_USAGE`. A 500 on the first three means an uncached fetch was reintroduced into the catch-all's render.
- **Verify:** `rm -rf .next && pnpm build && SITE_URL=http://localhost:3100 pnpm start -p 3100`, then `for p in /actual/ /get-involved/ /materials/pppuiv-constructor/ /no-such-page-xyz/; do curl -s -o /dev/null -w "$p %{http_code}\n" localhost:3100$p; done`
- **Why:** `src/app/[...slug]/page.tsx:39-40` exports a module-level `revalidate = 3600` shared with the numeric branch, so the render must stay statically generatable; `cache: 'no-store'` there aborts with `DYNAMIC_SERVER_USAGE` and production 500s while `next dev` answers 200 (`page.tsx:137-143`). `openspec/changes/fallback/verification-plan.md` gate 10: «Gate 10 is not optional, and it is new… Run it against a clean `.next`, or clear `.next/cache` between runs — ISR keeps the previous answer, including a previous 404.» · **Covered by:** **gap**

#### CACHE-02 · P0 · manual — Purge a post id and watch the rendered page, not just the JSON, go HIT to MISS

- **Given** a production build with the secret set, against od-stage: `pnpm build && REVALIDATE_SECRET=t3st pnpm start -p 3100`. Request `/71933/` (a film), `/74794/` («САХАР АТАКУЕТ», a news post) and `/materials/articles/` once each so all three report `x-nextjs-cache: HIT`.
- **When** POST `{"postId":71933}` to `/api/revalidate/` and re-request all three; then POST `{"tags":["wp:films"]}` and re-request all three.
- **Then** the 200 body lists `{"revalidated":{"tags":["wp:post:71933","wp:posts"],"paths":[]}}`. After it, `/71933/` and `/materials/articles/` both answer `x-nextjs-cache: MISS` (both hang off `wp:posts`). After the `wp:films` purge, `/71933/` is MISS while `/74794/` stays HIT — the tags discriminate. A purge that answers 200 while every page stays HIT means the render's fetches were untagged.
- **Verify:** `curl -sI localhost:3100/71933/ | grep -i x-nextjs-cache; curl -s -X POST -H 'content-type: application/json' -H 'x-revalidate-secret: t3st' -d '{"postId":71933}' localhost:3100/api/revalidate/; curl -sI localhost:3100/71933/ | grep -i x-nextjs-cache`
- **Why:** `src/shared/api/cacheTags.ts:4-10` — «A tag on a `fetch` is what makes the _page_ purgeable, not just the JSON». The measured table in `docs/implementation-notes.md` §B4 is exactly this pair of purges. `src/app/api/revalidate/route.test.ts` mocks `next/cache`, so nothing automated ever observes an ISR entry moving. · **Covered by:** **gap**

#### CACHE-03 · P0 · manual — Reject a POST to /api/revalidate without the trailing slash as a 308 that purges nothing

- **Given** any deployed tier. `trailingSlash: true` makes the slashless form a 308, and WordPress's HTTP client does not re-POST on a redirect — so `OD_REVALIDATE_URL` missing one character silently disables the whole B4 loop with no symptom but an hour of staleness.
- **When** POST the same body to `/api/revalidate` and to `/api/revalidate/` on https://new.obshee-delo.ru, and read `wp-content/debug.log` on the WordPress side after a save.
- **Then** slashless → **308** with `location: /api/revalidate/` and no purge. Slashed → 503 on stage (no secret) or 200 on a tier that sets one. Measured on stage 2026-08-22: 308 and 503. A WP-side log line reading `→ HTTP 308` is this bug, not a wrong secret (that logs `HTTP 401`).
- **Verify:** `curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' -d '{"tags":["wp"]}' https://new.obshee-delo.ru/api/revalidate` → 308; the same URL with the trailing slash → 503
- **Why:** `src/app/api/revalidate/route.ts:26-28` («Same trap as `/health/`»); `wp/mu-plugins/od-revalidate.php:19-21` warns the same thing about `OD_REVALIDATE_URL`; runbook §4.8. `route.test.ts` calls the exported handler directly, so Next's normalisation — where the 308 comes from — is never exercised. · **Covered by:** **gap**

#### CACHE-04 · P0 · infra — Prove a redeploy does not flush the ISR volume, so new code can serve old data

- **Given** `od-frontend-stage` on od-vps with the persistent volume on `/app/.next/cache`, and a page whose ISR entry is younger than its `revalidate = 3600` window.
- **When** change something in WordPress that a warm page shows (take one post out of a film category), push to `main`, let CI build and Coolify deploy the new image, then request that page and a sibling page nothing has requested since the deploy.
- **Then** the warm page still shows the pre-edit content with `x-nextjs-cache: HIT`; the sibling, having no cache entry, renders off the new build correctly. Measured 2026-08-22: `/video/` still listed the removed post while `/video/famous-people/` was right. The remedy is `POST /api/revalidate/`, never a redeploy — record this expectation before cutover day.
- **Verify:** `curl -sI https://new.obshee-delo.ru/video/ | grep -i x-nextjs-cache`, then compare the rendered card count against `curl -sI "https://od.webtm.ru/wp-json/wp/v2/posts?format=video&categories=581,580,86,559&per_page=1" | grep -i x-wp-total`
- **Why:** commit fa3d244 «a redeploy does not flush the ISR volume»; `docs/implementation-notes.md` §A3b («new code, old data»); the Dockerfile's `.next/cache` mkdir+chown block explains why the volume is seeded from the image and outlives the container; runbook §4.8. · **Covered by:** **gap**

#### CACHE-05 · P1 · unit — Enumerate every WP call site and fail any that carries no wpCache init

- **Given** 19 `wpFetch(...)` / `client.GET(...)` call sites outside `httpClient.ts` and the test files (18 before `fetchFilms.ts:57-60` added the catalogue-count probe behind the «Все видео (83)» CTA). Only `src/shared/api/fetchSearch.test.ts:125` asserts a fetcher's tags today, so 12 of the 13 fetchers in `src/shared/api/` have no such assertion.
- **When** a test (or the grep below) walks the call sites and checks each one is passed a `wpCache([...])` init, either as the second argument or spread beside `params`.
- **Then** 17 carry it. The only two that do not are the pair inside `generateStaticParams` (`src/app/[...slug]/page.tsx:103-122`), which is untagged on purpose and must be the named allowlist — a third exception fails the check. A new fetcher added without `wpCache` is caught here rather than becoming silently invisible to `POST /api/revalidate/`.
- **Verify:** `grep -rn "wpFetch(\|\.GET(" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | grep -v httpClient.ts` — every hit either carries `wpCache` on the same statement or is one of the two seed calls in `generateStaticParams`
- **Why:** `src/shared/api/cacheTags.ts:4-10` and CLAUDE.md's data-layer section: «A new fetcher without a tag is invisible to that.» Next stamps a render's fetch tags onto the route's ISR entry, so an untagged fetcher makes its whole page surface unpurgeable while `/api/revalidate/` still answers 200 with a list of tags. · **Covered by:** **gap**

#### CACHE-06 · P1 · unit — Re-run the openapi-fetch next-init passthrough guard after every dependency bump

- **Given** `new Request()` drops unknown init keys, so `{ next: … }` reaches the typed client only because openapi-fetch copies leftover init keys back onto the Request it built, and Next reads `next` off a Request input as well as off `init`. Nothing throws if either stops being true.
- **When** `client.GET('/wp/v2/menus', { ...wpCache([WP_TAGS.menus]), fetch })` with a capturing fetch — run as part of `pnpm test`, and deliberately after any `openapi-fetch` upgrade.
- **Then** the captured Request carries `next: { revalidate: 3600, tags: ['wp', 'wp:menus'] }` and an `Authorization: Basic …` header. If it does not, the five `client.GET` fetchers — fetchMenus, fetchMenuItems, fetchFooter, fetchSimilarNews, fetchNews — run untagged and unrevalidated, so the header, the footer and every article page stop being purgeable with no error anywhere.
- **Verify:** `pnpm test src/shared/api/httpClient.test.ts`
- **Why:** `src/shared/api/httpClient.test.ts:17-29` — «Nothing throws if that stops being true — the fetch just runs untagged and unrevalidated, and `/api/revalidate/` quietly stops purging anything built through the typed client. Hence this test, aimed squarely at the openapi-fetch upgrade that would break it.» · **Covered by:** `src/shared/api/httpClient.test.ts`

#### CACHE-07 · P1 · unit — Pin WP_REVALIDATE_SECONDS to every route's revalidate, including the sitemap's 86400

- **Given** `WP_REVALIDATE_SECONDS = 3600` (`src/shared/api/cacheTags.ts:28`) is the default window `wpCache` writes onto every fetch, and eight route files export their own `revalidate`.
- **When** compare the two sets: `app/page.tsx:17`, `app/news/page.tsx:11`, `app/video/page.tsx:4`, `app/video/[segment]/page.tsx:6`, `app/materials/articles/page.tsx:10`, `app/profile/[slug]/page.tsx:12`, `app/[...slug]/page.tsx:40` against 3600; and `app/sitemap.ts:28` (86400) against the `wpCache([tag], revalidate)` it passes at `sitemap.ts:79`.
- **Then** all seven page routes equal 3600, and the sitemap's route window and fetch window are the same number. A fetch window shorter than the page window refetches WordPress without the page ever rebuilding; a longer one lets a rebuilt page serve data older than itself.
- **Verify:** `grep -rn 'export const revalidate' src/app && grep -n 'WP_REVALIDATE_SECONDS = ' src/shared/api/cacheTags.ts`
- **Why:** `src/shared/api/cacheTags.ts` states this invariant in prose above line 28 («a shorter window here would refetch WP without the page ever rebuilding, and a longer one would let a rebuilt page serve data older than itself») and nothing asserts it — a new route defaulting to no `revalidate` at all is the same class of drift. · **Covered by:** **gap**

#### CACHE-08 · P1 · manual — Read the very first response after a purge and find the new content, not one more stale copy

- **Given** a production build with the secret set against od-stage; `/71933/` warm at `x-nextjs-cache: HIT`; the WordPress title of post 71933 just changed. This is the one-request-over boundary: a named expiry profile would answer this first request from the pre-edit entry.
- **When** POST `{"postId":71933}` once, then request `/71933/` exactly once and read `<title>`.
- **Then** that single response already carries the new title and `x-nextjs-cache: MISS`. Serving the old title once and the new one on the second request means `{ expire: 0 }` was replaced by a named profile (`'max'` and friends only mark the entry stale).
- **Verify:** `curl -s localhost:3100/71933/ | grep -o '<title>[^<]*'; curl -s -X POST -H 'x-revalidate-secret: t3st' -H 'content-type: application/json' -d '{"postId":71933}' localhost:3100/api/revalidate/; curl -s localhost:3100/71933/ | grep -o '<title>[^<]*'`
- **Why:** `src/app/api/revalidate/route.ts:162-168` — «every built-in profile (including 'max') only marks the entry stale, which serves the _old_ page once more while it rebuilds — precisely the "I published, where is it?" this route exists to remove». `route.test.ts` asserts the argument was passed, never the served result. · **Covered by:** **gap**

#### CACHE-09 · P1 · php — Drive the mu-plugin's status rules: draft churn queues nothing, «снять с публикации» queues

- **Given** `wp/tests/od-revalidate.test.php`, which already stubs `ABSPATH`, `WP_Post` and `add_action` and reads the private queue back through reflection. Purging on draft churn only throws away a warm `wp:posts`, which every listing and the home feed hang off.
- **When** call `on_transition` with (draft→draft), (draft→pending), (publish→draft), (draft→publish) and (future→publish); then `on_gone` with a WP 6.x trash passing previous status `'draft'`, and with `null` (WP 5.5.5, and any permanent delete).
- **Then** draft→draft and draft→pending queue nothing. publish→draft, draft→publish and future→publish each queue the post id. The trash carrying `'draft'` queues nothing; the one carrying `null` queues, because no hook can know the previous status and purging is the safe side of the guess. Matches §B4's measurement: a nine-step lifecycle produced 7 purges, a draft-only lifecycle produced 1.
- **Verify:** `php wp/tests/od-revalidate.test.php`
- **Why:** `wp/mu-plugins/od-revalidate.php:118` (`on_transition`) and `:145` (`on_gone`) hold both rules; the suite today only exercises `queue_post`'s post-type table (`wp/tests/od-revalidate.test.php:79-100`) and never either status rule — and the suite's own header says a routing hole here «fails silently». · **Covered by:** **gap**

#### CACHE-10 · P1 · php — Assert flush() sends one POST per WordPress request and chunks at 50 ids

- **Given** the same harness plus a `wp_remote_post` stub that records bodies. A bulk trash fires `trashed_post` once per post and trashing a published post fires two hooks for the same id, so batching is the whole reason the plugin is a class.
- **When** queue 3 post ids (one of them twice) and 2 tags, then call `flush()`. Separately queue 120 ids and flush. Separately make the stub fail the first chunk.
- **Then** 3 ids + 2 tags → exactly **one** POST body `{"postIds":[3 unique ids],"tags":[2 tags]}`. 120 ids → three POSTs of 50 / 50 / 20, matching MAX_ITEMS=50 on both sides. A failing first chunk stops the loop after one request (one timeout, not three) and sets the `od_revalidate_unreachable` transient.
- **Verify:** `php wp/tests/od-revalidate.test.php`
- **Why:** `wp/mu-plugins/od-revalidate.php:234-270` (`array_chunk( …, self::MAX_ITEMS )`, `break` on a failed chunk) and its `MAX_ITEMS = 50` at `:69` must equal `MAX_ITEMS` at `src/app/api/revalidate/route.ts:33` — the route rejects 51 ids with a 400, so a drift here turns a bulk edit into a silent dropped purge. Nothing tests `flush()` today. · **Covered by:** **gap**

#### CACHE-12 · P1 · manual — Show the six legacy-embed pages carry no WP tag, so only `paths` can purge them

- **Given** a production build with the secret set against od-stage. `/about/` is one of the 153 natively-rendered WP pages (its render fetches with `wp:pages`); `/actual/` is one of the six on `LEGACY_EMBED_PAGES`, for which `nativeWpPath` returns null so the render makes **no** WP fetch at all. Warm both to `x-nextjs-cache: HIT`.
- **When** POST `{"tags":["wp:pages"]}` and re-request both; then POST `{"paths":["/actual/"]}` and re-request `/actual/`.
- **Then** after the tag purge `/about/` is MISS and `/actual/` is still **HIT**. After the paths purge `/actual/` is MISS, and the 200 body reports `"paths":["/actual/","/actual"]` — both slash variants, because `revalidatePath` addresses a route by a tag derived from the pathname it rendered at and `trailingSlash: true` hides which that was.
- **Verify:** `curl -sI localhost:3100/about/ localhost:3100/actual/ | grep -i x-nextjs-cache`, the two POSTs, then repeat
- **Why:** `src/app/[...slug]/page.tsx:73-80` (`isLegacyEmbedPage` → null → the WP fetch is skipped entirely) against `:216-220`; `src/shared/config/legacyEmbedPages.ts:78-85` lists the six paths; the `paths` field at `route.ts:43` exists exactly «for pages no WP fetch tags — the A6 fallback, mainly», and nothing on either side of the wire sends it — the mu-plugin only ever sends `postIds` and `tags`. · **Covered by:** **gap**

#### CACHE-14 · P2 · manual — Survive the documented whole-site purge, `{"tags":["wp"]}`, without an empty shell

- **Given** a production build with the secret set against od-stage, warmed by requesting `/`, `/news/`, `/video/`, `/video/filmy/` and `/71933/`. `wpCache` adds `WP_TAGS.all` (`wp`) to every request, so this one body drops the entire render cache in one call — it is the hand-purge in `docs/wp-backend.md` §6.5 step 4.
- **When** POST `{"tags":["wp"]}`, then request those five URLs twice each within a minute.
- **Then** all five answer 200, MISS on the first pass and HIT on the second. The footer still contains 6 `<aside id="block-` and the header still renders «ГЛАВНАЯ», «ФИЛЬМЫ», «КОНТАКТЫ» — no page comes back as an empty shell — and the server log shows no WordPress 503.
- **Verify:** `curl -s -X POST -H 'x-revalidate-secret: t3st' -H 'content-type: application/json' -d '{"tags":["wp"]}' localhost:3100/api/revalidate/` then `curl -s localhost:3100/ | grep -c '<aside id="block-'` → 6
- **Why:** `src/shared/api/cacheTags.ts:31-35` and `:90-92` put `wp` on every request; `experimental.staticGenerationMaxConcurrency: 4` in `next.config.ts:77-80` exists because the WordPress host 503s above roughly that parallelism, so a full purge is the one operation that can hand the slow origin a burst. · **Covered by:** **gap**

#### CACHE-15 · P2 · infra — Record that a purge reaches only the replica that received it before scaling past one

- **Given** `output: 'standalone'` puts the ISR cache on the container filesystem, mounted as a per-container Docker volume at `/app/.next/cache`. `od-frontend-stage` runs exactly one instance today.
- **When** before adding a second instance to either tier, POST a purge at the load-balanced domain and then check `x-nextjs-cache` on each replica individually.
- **Then** only the replica that handled the POST reports MISS; the others keep serving HIT. Therefore scaling past one instance requires a shared `cacheHandler`, or the deploy has to fan the purge out to every replica — decide which and write it down before the second instance exists.
- **Verify:** `ssh od-vps 'docker ps --filter name=od-frontend-stage'` shows one container today; runbook §4.8 is the decision record («POST /api/revalidate/ clears the replica that receives it»).
- **Why:** runbook §4.8 and CLAUDE.md's rendering-model section — «The ISR cache lives on the container filesystem (`output: 'standalone'`), so it's per-replica — a custom `cacheHandler` would be needed before scaling past one instance.» · **Covered by:** **gap**

#### CACHE-16 · P2 · build — Build with WordPress unreachable and still ship, with an empty SSG seed

- **Given** `generateStaticParams` asks for 20 films (`format=video&categories=581,580,86,559&per_page=20&_fields=id`) and 20 latest posts, each wrapped in `.catch(() => [])`, and is untagged on purpose because it returns ids rather than content.
- **When** `pnpm build` normally; then `WP_BASE=https://wp.invalid pnpm build`.
- **Then** normally the build reports ~52 static pages generated (runbook §4.5) with up to 40 `/<id>` entries among them. With WP unreachable the seed is empty, the build still exits 0, and every `/<id>` is served on demand because `dynamicParams = true` at `page.tsx:39` — no 404 and no build failure. A build that _fails_ here means a `.catch` was removed; a build that emits 0 static pages against a healthy WP means the four film category ids no longer match the environment.
- **Verify:** `pnpm build 2>&1 | grep -E 'Generating static pages|/\[\.\.\.slug\]'` and read the route table's `/[...slug]` row
- **Why:** `src/app/[...slug]/page.tsx:103-122` — «Untagged on purpose, unlike every other WP call (B3): this runs once per build to pick the ISR seed… Posts that miss the seed are served on demand via `dynamicParams`»; `docs/implementation-notes.md` §B3 repeats that a cache window there could only serve a rebuild a stale seed. · **Covered by:** **gap**

#### GAP-04 · P1 · manual — Purge a legacy-embed page and find the frame's own document is still the old one

- **Given** two independent caches stack on an A6 page. The outer page at `/actual/` is an ISR entry with `revalidate = 3600` and — because `nativeWpPath` returns null for a listed path — **no WP fetch tag at all**. The inner document is fetched by `app/legacy/[...slug]/route.ts` and memoised in `legacyStore` (capacity 64, TTL 3 600 000 ms, `src/shared/legacy/legacyStore.ts:43-47`), which `revalidateTag`/`revalidatePath` cannot reach: it is a module-level Map, not the Next cache.
- **When** warm `/actual/` and its frame. Change the page on the legacy origin. POST `{"paths":["/actual/"]}` to `/api/revalidate/`, then reload `/actual/` and read both the outer HTML and the `/legacy/actual/` document the frame fetches. Then restart the container and reload.
- **Then** record which of the two changed. The outer page reports `x-nextjs-cache: MISS`; the frame is expected to keep serving the pre-edit document for up to an hour, because the purge never touched `legacyStore`. Either that is accepted and written down — an edit to a frozen-copy page appears within the hour, purge or no purge — or the route grows a way to drop a store entry. A restart clears it, which is the only lever today.
- **Verify:** `curl -sI localhost:3100/legacy/actual/` before and after the purge and diff the bodies; read `src/shared/legacy/legacyStore.ts:43-47` against `src/app/api/revalidate/route.ts:43`
- **Why:** CACHE-12 establishes that the six embed pages carry no WP tag and can only be purged by `paths`, and stops at the outer page. PERF-12 asserts the store's capacity, TTL and eviction order and never asks whether a purge reaches it. So «I purged and the frame still shows the old text» falls exactly between the two lenses, on the surface where content is most likely to be corrected by hand during cutover. · **Covered by:** **gap**

#### GAP-07 · P1 · manual — Read WordPress through its page cache and confirm the REST answers are not stale

- **Given** WP Rocket is active on the live host (commit 4eec9f9: «a term edit needs a purge»), and after cutover the frontend reads `/wp-json` from that install on every ISR rebuild. The pipeline depends on two things a page cache can break: freshness (an edit must be visible to the _next_ rebuild, not to the next Rocket purge) and the `X-WP-Total` / `X-WP-TotalPages` headers, which are not CORS-safelisted and are exactly what a cache or WAF strips.
- **When** on the cutover install: read `X-WP-Total` for the catalogue query, a listing and `/wp/v2/pages`; note any `x-rocket-*`, `cf-cache-status` or `age` header on a `/wp-json` response. Change a post's title and a term assignment, POST `/api/revalidate/`, and read the rendered page. Then purge Rocket and read it again.
- **Then** `/wp-json` responses carry no cache header and no `age`, both `X-WP-*` headers are present on every paginated endpoint, and the rendered page shows the new title after the frontend purge alone — with no Rocket purge in between. If a Rocket purge is required, the B4 loop is incomplete: the mu-plugin has to purge Rocket as well, or `/wp-json` has to be excluded from the page cache, and the runbook has to say which.
- **Verify:** `curl -sI -u "$WP_USER:$WP_PASSWORD" "$WP_BASE/wp-json/wp/v2/posts?format=video&categories=581,580,86,559&per_page=1" | grep -iE 'x-wp-total|x-rocket|age|cf-cache'`
- **Why:** DATA-10 predicts the header-stripping half («exactly the kind of thing a cache or WAF in front of WordPress drops») and can only detect it after the fact, from a missing count on the home page. Every CACHE scenario stops at Next's ISR and every WP scenario stops at the mu-plugin, so the cache _between_ them — the one already switched on in production — is covered by nothing. · **Covered by:** **gap**

## 4. SEO, metadata & crawlability

_Does everything the site advertises about itself — `rel=canonical`, the 8 426 sitemap `<loc>`s, `robots.txt`, `<title>`, `<meta name="description">` and the OG/Twitter card — name a URL that answers 200 on **this** tier, and name it exactly once?_

#### SEO-01 · P0 · infra — Pin every advertised URL to the tier's own origin, not SITE_URL's prod default

- **Given** the od-stage tier at `https://new.obshee-delo.ru`, built by the CI `image` job with `SITE_URL=https://new.obshee-delo.ru` passed as a **build-arg** — it feeds `metadataBase`, evaluated at build time, so one image cannot serve two tiers (runbook §4.7).
- **When** you fetch `/robots.txt`, `/sitemap.xml` and the `rel=canonical` of `/`, `/news/`, `/video/filmy/`, `/materials/articles/` and `/71933/`; then repeat against a build where `SITE_URL` is unset.
- **Then** with it set: the `Sitemap:` line, all 8 426 `<loc>` entries and all five canonicals name `new.obshee-delo.ru` — measured 2026-08-22, **0** entries name any other host. With it unset every one of those flips to `https://obshee-delo.ru` while every page still answers 200 and looks correct; that silent flip is the failure being guarded, and it is only observable through a crawler.
- **Verify:** `curl -s https://new.obshee-delo.ru/sitemap.xml | grep -o '<loc>[^<]*</loc>' | grep -vc 'new.obshee-delo.ru'  # expect 0 ; curl -s https://new.obshee-delo.ru/robots.txt | tail -1`
- **Why:** `src/shared/config/site.ts:13-15` defaults to `https://obshee-delo.ru`, so a misconfigured _prod_ is right and a misconfigured _stage_ is silently wrong; runbook §4.1 (`SITE_URL` row), §4.7 (five build-args), notes §F4 warning. · **Covered by:** **gap**

#### SEO-02 · P0 · script — Advertise no sitemap URL that redirects — /video/short/ does today

- **Given** od-stage's `/sitemap.xml`: 8 426 `<loc>` entries, 1.35 MB, well-formed XML, zero duplicates, all slash-terminated. WP page **35015 «Короткометражные»** is published at `/video/short/`, and `resolveLegacyUrl` 301s that path to `/video/` (`src/shared/config/legacyRedirects.ts:66`).
- **When** you replay every non-post `<loc>` (142 URLs) plus every 200th post `<loc>` (42 URLs) with `curl -o /dev/null -w '%{http_code}'`, not following redirects.
- **Then** 183 of 184 answer 200 and **`https://new.obshee-delo.ru/video/short/` answers 301 → /video/** (measured 2026-08-22). Expected 184/184 at 200 and zero 3xx. `collectPagePaths()` filters only the six legacy-embed paths, and the static-entry dedupe at `src/app/sitemap.ts:262` cannot catch this one because no static `/video/short/` entry exists to dedupe against.
- **Verify:** `curl -s https://new.obshee-delo.ru/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g' | grep -v '/[0-9]*/$' | xargs -P8 -I{} sh -c 'printf "%s {}\n" "$(curl -s -o /dev/null -w %{http_code} {})"' | grep -v '^200 '`
- **Why:** `src/app/sitemap.ts:243-245` claims «`/video/short/` is absent by construction: it names no category and 301s to «Все»», but the leak comes from `collectPagePaths()` (`src/app/sitemap.ts:194-227`); runbook §5 gate 12 requires «~8 000 `<loc>` entries … none of them a URL that redirects». The existing assertion at `src/app/sitemap.test.ts:75-83` (`expect(urls).not.toContain(…/video/short/)`) passes only because the mocked page index omits the page — it has never met a WP index that publishes `/video/short/`. · **Covered by:** **gap**

#### SEO-04 · P0 · unit — Keep /materials/articles/ the single canonical of the «Статьи» pair

- **Given** `ARTICLES_HREF = '/materials/articles/'` (`src/shared/config/newsCategories.ts:42`) and three canonicals produced in two files: `src/app/materials/articles/page.tsx:26` and `src/app/news/page.tsx:74-76`. 114 entry visits / 91 days land on the alias from search.
- **When** you read `rel=canonical` on `/materials/articles/`, `/news/?category=articles` and `/news/?category=articles&page=2`.
- **Then** the first two are byte-identical `<SITE_URL>/materials/articles/`; the third is its own address `<SITE_URL>/news/?category=articles&page=2`, never collapsed onto page 1 and never onto the alias. Measured 2026-08-22 on stage: exactly that. If the first two diverge the collection has two indexable addresses again and the 114 visits split.
- **Verify:** `for p in '/materials/articles/' '/news/?category=articles' '/news/?category=articles&page=2'; do curl -sS "https://new.obshee-delo.ru$p" | grep -o 'rel="canonical" href="[^"]*"'; done`
- **Why:** runbook §5 gate 7 («if the first two diverge the collection has two addresses again»); `src/app/news/page.tsx:61-70` explains why `?page=2` must self-canonicalise. · **Covered by:** **gap**

#### SEO-05 · P0 · infra — Carry X-Robots-Tag: noindex on stage only, and strip it from prod at cutover

- **Given** Traefik on od-vps lists `new.obshee-delo.ru` in `noindex_domains` (notes §A3b), so every stage response carries `x-robots-tag: noindex, nofollow`. Prod will be a **second** Coolify application with its own variables; `wp.obshee-delo.ru` and `frozen.obshee-delo.ru` get the header at cutover (runbook §5.6).
- **When** you `curl -sI` the stage apex and a stage 404; after cutover, the same against `https://obshee-delo.ru/`, `https://wp.obshee-delo.ru/` and `https://frozen.obshee-delo.ru/`; and grep each apex response body for `<meta name="robots"`.
- **Then** stage → `x-robots-tag: noindex, nofollow` on the 200 **and** on the 404 (both measured 2026-08-22). Prod apex → **no** `x-robots-tag` header and no `<meta name="robots">` in the HTML. The two WP hosts → `noindex, nofollow` **and no `Disallow` line in their robots.txt** — a `Disallow` cancels the header, and Yandex takes the permissive value when two directives disagree.
- **Verify:** `curl -sI https://new.obshee-delo.ru/ | grep -i x-robots-tag ; curl -sI https://obshee-delo.ru/ | grep -ic x-robots-tag  # expect 0 after cutover`
- **Why:** notes §A3b (`noindex_domains`); runbook §5.6 («`noindex` is a request, not a fact» — four documented ways it does nothing) and §0.7 rows «the new WordPress host ranks against the apex» / «`X-Robots-Tag: noindex` is set and the host is indexed anyway». · **Covered by:** **gap**

#### SEO-06 · P1 · unit — Assert all nine openGraph declaration sites name an image and their own url

- **Given** nine files declare `openGraph` — `src/app/layout.tsx:48` plus eight route/module sites (`src/app/page.tsx:34`, `src/app/news/page.tsx:86`, `src/app/materials/articles/page.tsx:31`, `src/app/profile/[slug]/page.tsx:39`, `src/modules/Video/VideoCatalogue/VideoCatalogue.tsx:100`, `src/modules/WpPage/WpPage.tsx:56`, `src/modules/Video/FilmPage/FilmPage.tsx:34`, `src/modules/News/NewsArticle/NewsArticle.tsx:49`) — because Next merges metadata **shallowly** and there is deliberately no `app/opengraph-image.png` (`src/shared/config/site.ts:33-40`).
- **When** you enumerate the nine sites and assert each sets `images` and a `url` equal to that route's own canonical; then read the rendered `og:*` on `/`, `/news/`, `/video/`, `/video/filmy/`, `/video/multy/`, `/materials/articles/`, `/71933/` and `/about/`.
- **Then** 9/9 name an image (measured: `grep -L 'images:'` over the nine returns nothing, and `find src -iname 'opengraph-image*'` returns nothing). No two of the six index URLs share an `og:title` or `og:url`. `/71933/` carries its own film cover and `/about/` its own first body image — not `og-default.png`. A route that declares `openGraph` without an image inherits none and unfurls imageless.
- **Verify:** `grep -L 'images:' $(grep -rl 'openGraph:' src --include='*.tsx' | grep -v '\.test\.')  # expect empty` — then curl the eight URLs and diff their `og:title`/`og:url`.
- **Why:** notes §F4b warning («file-based metadata outranks config-based … would stamp the logo over every film poster»); commit `242b42c` («fix(F4): give the video catalogue its own social card») after five URLs unfurled identically as «ОБЩЕЕ ДЕЛО». · **Covered by:** `src/modules/Video/VideoCatalogue/VideoCatalogue.test.ts`

#### SEO-07 · P1 · manual — Keep og:image fetchable by social crawlers after the wp.obshee-delo.ru lockdown

- **Given** every card image goes through `resolveMediaUrl`, which falls back to the **WordPress origin** whenever the CDN HEAD probe is not a direct 200 (`src/modules/News/NewsArticle/NewsArticle.tsx:43`, `src/modules/WpPage/WpPage.tsx:66`, `src/modules/Video/FilmPage/FilmPage.tsx:42` via `src/shared/api/fetchFilms.ts:72`). Measured 2026-08-22: 10 of 12 sampled post ids emit `https://od.webtm.ru/wp-content/uploads/…`. Runbook §5.6 puts `Require ip` (frontend VPS only) on `wp.obshee-delo.ru` «later — not at cutover».
- **When** after the allowlist lands, you paste `https://obshee-delo.ru/71933/` into Telegram, run the VK and Facebook debuggers, and `curl -I` that page's `og:image` URL from a laptop — an address that is not the frontend VPS.
- **Then** the card renders the film cover and the `curl -I` returns `200 image/jpeg`. A 403 from off-VPS means every film, news post and WP page loses its card image site-wide — ~8 200 posts and ~140 pages — while the site's own pages keep rendering perfectly, so nothing on the frontend reports it.
- **Verify:** `curl -s https://obshee-delo.ru/71933/ | grep -o 'og:image" content="[^"]*"' | sed 's/.*content="//;s/"//' | xargs curl -sI | head -1`
- **Why:** `src/shared/api/mediaUrl.ts` resolves to the WP origin on a failed probe, and all three metadata builders publish whatever it returns; runbook §0.7 records the same mechanism one layer down («in-article images from 2024 onward break for visitors … fetched by the **browser**»). · **Covered by:** **gap**

#### SEO-08 · P1 · script — Cap the meta description and strip WordPress's «Читать далее» tail

- **Given** `buildNewsPreview` caps only the **content fallback** at `MAX_PREVIEW = 300` (`src/shared/api/newsPreview.ts:3`, `44-50`); a non-empty `excerpt.rendered` is returned verbatim at `src/shared/api/newsPreview.ts:36-38`, and WordPress's auto-excerpt ends with its own more-link text. Both `src/shared/api/fetchWpPage.ts:188` and `src/modules/News/NewsArticle/NewsArticle.tsx:36` take the excerpt first.
- **When** you measure the rendered `<meta name="description">` of every published page on od-stage, and read `/about/` and `/71933/` by hand.
- **Then** measured 2026-08-22 against `od.webtm.ru/wp-json`: of **148** published pages, **95 descriptions exceed 250 characters** (longest **793**) and **61 contain «Читать далее»**. `/about/` renders 495 chars ending «… Читать далее Об организации»; `/71933/` renders 423 ending «… Читать далее Спасибо за жизнь». Target: no description over ~250 chars and **0** containing «Читать далее».
- **Verify:** `curl -s 'https://od.webtm.ru/wp-json/wp/v2/pages?per_page=100&_fields=link,excerpt' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).map(p=>p.excerpt.rendered.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim());console.log(a.filter(x=>x.length>250).length, a.filter(x=>x.includes("Читать далее")).length)})'`
- **Why:** `src/shared/api/newsPreview.ts:35-51` — the excerpt branch has no length bound at all, and `newsPreview.test.ts`'s «prefers the excerpt when present» pins that behaviour rather than flagging it. · **Covered by:** **gap**

#### SEO-09 · P1 · script — Collapse the three duplicate WP page titles to one address each

- **Given** `wpPageMetadata` builds `<title>` as `<WP title> — ОБЩЕЕ ДЕЛО` (`src/modules/WpPage/WpPage.tsx:50`) and every WP page self-canonicalises, so two pages with the same editor-typed title become two indexable addresses under one title. 148 published pages on the prod clone (`docs/page-inventory.md` §1a).
- **When** you group all published pages by stripped title and, for every collision, fetch both URLs' status, canonical and sitemap membership.
- **Then** measured 2026-08-22 — **three pairs** collide: «Методические пособия» on `/materials/metodichka/` + `/materials/metodichki/`; «Рязанская область» on `/contacts/ryazanskaya/` + `/contacts/rezan-oblast/`; «Смоленская область» on `/contacts/smolenskaya/` + `/contacts/smolenskaya-oblasti/`. All six answer 200, all six self-canonicalise to themselves, all six appear in the sitemap. Expected: one address per collection — the duplicate slug 301s onto the kept one in `src/proxy.ts`, or is drafted in WordPress.
- **Verify:** `curl -s 'https://od.webtm.ru/wp-json/wp/v2/pages?per_page=100&_fields=link,title' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m={};JSON.parse(s).forEach(p=>{const t=p.title.rendered;(m[t]=m[t]||[]).push(new URL(p.link).pathname)});Object.entries(m).filter(([,v])=>v.length>1).forEach(e=>console.log(e))})'  # repeat for page=2`
- **Why:** `src/modules/WpPage/WpPage.tsx:44-50` adds a `— страница N` suffix for exactly this reason on `/about/smi/`; `src/shared/config/pageSections.ts:30-31` deliberately keeps each tabbed page's own WP title, so nothing else disambiguates. · **Covered by:** **gap**

#### SEO-10 · P1 · e2e — Number the catalogue's paginated titles and bound /video/filmy/?page=999

- **Given** `catalogueMetadata` self-canonicalises `?page=N` but never numbers the title (`src/modules/Video/VideoCatalogue/VideoCatalogue.tsx:83-101`), unlike `/news/` (`src/app/news/page.tsx:80`) and `wpPageMetadata` (`src/modules/WpPage/WpPage.tsx:50`). `/video/filmy/` holds 26 films across 3 pages; `/news/` holds 553 pages. `robots.ts` deliberately leaves pagination crawlable, so nothing else bounds the space.
- **When** you GET `/video/filmy/`, `?page=2`, `?page=3`, `?page=999`, then `/news/?page=553` and `?page=554`, reading card count, `<title>` and `rel=canonical` each time.
- **Then** measured 2026-08-22: pages 1-3 render 10/10/6 cards and **all four URLs share `<title>Фильмы — ОБЩЕЕ ДЕЛО</title>`**; `?page=999` answers **200** with **0 cards**, the «не найдено» message and `rel=canonical` `…/video/filmy/?page=999` — an unbounded family of self-canonicalising empty pages under page 1's title. Expected: pages 2-3 read «Фильмы, страница N — ОБЩЕЕ ДЕЛО» and a page past the last either 404s or carries `robots: noindex`.
- **Verify:** `for p in '/video/filmy/' '/video/filmy/?page=2' '/video/filmy/?page=999'; do curl -sS "https://new.obshee-delo.ru$p" | grep -oE '<title>[^<]*</title>|rel="canonical" href="[^"]*"'; done`
- **Why:** `src/modules/WpPage/WpPage.tsx:48-50` states the rule («18 pages of `/about/smi/` under one title is a duplicate-title report waiting to happen») and the catalogue is the one surface that does not follow it, on the site's #2 entry page. · **Covered by:** `src/modules/Video/VideoCatalogue/VideoCatalogue.test.ts`

#### SEO-11 · P1 · script — List the 135 /profile/<slug>/ pages in the sitemap

- **Given** `src/app/profile/[slug]/page.tsx` is a native route with **no** `generateStaticParams` (its own docstring: reached from search rather than from a listing, 566 entry visits / 91 days landed on the pages it replaced). `sitemap.ts` crawls `/wp/v2/posts` (`src/app/sitemap.ts:72-73`) and `/wp/v2/pages` (`src/app/sitemap.ts:194-227`) and nothing else.
- **When** you count `/profile/` entries in the published sitemap, and count published `profile` records in WordPress.
- **Then** measured 2026-08-22: **0 of 8 426** sitemap entries are `/profile/…`, while `X-WP-Total` on `/wp/v2/profile` is **135** and `/profile/fedorenko-mihail-vladimirovich/` answers 200. Once the WP plugin sitemap goes with the domain, those 135 pages have no discovery path at all — the exact argument `src/app/sitemap.ts:184-188` gives for including WP pages.
- **Verify:** `curl -s https://new.obshee-delo.ru/sitemap.xml | grep -c '/profile/'  # expect 135, is 0 ; curl -sI 'https://od.webtm.ru/wp-json/wp/v2/profile?per_page=1' | grep -i x-wp-total`
- **Why:** `src/app/sitemap.ts:184-188` («These have no other discovery path once the domain moves … a page nobody links to would simply drop out of the index») applies verbatim to `profile`, which the crawl never asks for. · **Covered by:** **gap**

#### SEO-12 · P1 · e2e — Return a real 404, not a 200 soft-404, for a path nothing serves

- **Given** there is no `app/not-found.tsx`, so Next's default 404 carries the status. The catch-all `notFound()`s for a non-embeddable slug, for `/page/N/` WordPress cannot serve, and for a **definitive** upstream 404/410 — but deliberately renders the embed for a transient 5xx, because `revalidate = 3600` would cache a wrong 404 (`src/app/[...slug]/page.tsx:230-238`).
- **When** you GET `/no-such-page-xyz/`, `/favicon.png/`, `/materials/nothing-here/page/4/` and `/71933999/`; then unset `WP_LEGACY_BASE` on the tier and re-request one of the six `LEGACY_EMBED_PAGES`, e.g. `/actual/`.
- **Then** every one answers **404** — measured 2026-08-22, `/no-such-page-xyz/`-shaped paths return `HTTP/2 404` with `x-nextjs-cache: HIT` — never 200 with an empty shell. With `WP_LEGACY_BASE` unset, `/actual/` answers 404 and the container log carries `[legacy] WP_LEGACY_BASE missing — legacy fallback disabled` exactly once at boot, not once per request.
- **Verify:** `for p in /no-such-page-xyz/ /favicon.png/ /materials/nothing-here/page/4/ /71933999/; do curl -s -o /dev/null -w "$p %{http_code}\n" https://new.obshee-delo.ru$p; done`
- **Why:** `src/app/[...slug]/page.tsx:230-238` and `src/shared/legacy/isEmbeddable.ts:25-42` decide 404-vs-embed; runbook §5 gate 12's reading notes distinguish «this section isn't built» from a shape failure, and a soft 200 would make both invisible. · **Covered by:** `src/app/[...slug]/legacyBranch.test.tsx`

#### SEO-13 · P1 · manual — Purge the social-card caches after the apex moves to the frontend

- **Given** `OG_DEFAULT_IMAGE` is a **relative** path resolved against `metadataBase` = `SITE_URL` (`src/shared/config/site.ts:40`), so every link shared before cutover carries `https://new.obshee-delo.ru/og-default.png` — a host that is `noindex` today and gone later.
- **When** after the DNS swap you unfurl `https://obshee-delo.ru/`, `/news/` and `/video/` in Telegram, VK and WhatsApp; then force a re-fetch — Telegram **@WebpageBot** (send the URL, ~10/day), `https://vk.com/dev/pages.clearCache`, `developers.facebook.com/tools/debug` → Scrape Again.
- **Then** each unfurls with `https://obshee-delo.ru/og-default.png` (1200×630, 14 092 bytes) and the apex's own title; **no** card shows `new.obshee-delo.ru`. Yandex has no purge button and re-reads on its next crawl, so it is the one that stays stale — expected, and not a failure.
- **Verify:** `curl -s https://obshee-delo.ru/ | grep -o 'og:image" content="[^"]*"'` — then the three debugger URLs above.
- **Why:** runbook §5.5 note «After the move, the social networks still hold the stage tier's card» (Telegram/VK days, Facebook/WhatsApp up to a month); notes §F4b. · **Covered by:** **gap**

#### SEO-14 · P1 · e2e — Keep the Yandex verification meta and lang="ru" on the apex through cutover

- **Given** `src/app/layout.tsx:66-70` carries `verification: { yandex: '5970d7ec7d8e8b0b' }`, read off the **production** host rather than the dev copy, because Webmaster ownership is verified by that tag and would be lost the moment the frontend takes the domain. `<html lang="ru">` at `src/app/layout.tsx:78`; Russian-only is permanent, so there is no `hreflang` anywhere.
- **When** you GET the apex plus `/news/`, `/video/filmy/` and one `/<id>/` after cutover.
- **Then** every page carries `<meta name="yandex-verification" content="5970d7ec7d8e8b0b">`, `<html lang="ru">`, `<meta name="twitter:card" content="summary_large_image">`, `og:locale = ru_RU` on the routes that declare one, and **zero** `hreflang` links. All four confirmed on stage 2026-08-22. Losing the verification tag means no Webmaster access on the exact day the URL set changes.
- **Verify:** `curl -s https://obshee-delo.ru/ | grep -oE '<html lang="[^"]*"|yandex-verification" content="[^"]*"|hreflang'`
- **Why:** `src/app/layout.tsx:66-70` («Yandex Webmaster ownership is verified by this meta tag and would be lost the moment the frontend takes the domain»); notes §6 «No language switcher. Russian-only is permanent». · **Covered by:** **gap**

#### SEO-15 · P2 · unit — Keep robots.txt off pagination and advertise the sitemap slashless

- **Given** `app/robots.ts` deliberately does not port the live site's `Disallow: /*?` — it would make `/news/?page=2` and `/video/filmy/?page=2` uncrawlable, and a blocked URL is never fetched so no `noindex` on it is ever read. The sitemap line is built with `fileUrl`, not `canonicalUrl`.
- **When** you fetch `/robots.txt`, then `/sitemap.xml/` (the slashed twin).
- **Then** exactly: `User-Agent: *`, `Allow: /`, `Disallow: /health/`, `Disallow: /search`, `Disallow: /*?s=`, `Sitemap: <SITE_URL>/sitemap.xml` — no `page=`, no `_next`, no `/*?`. `/sitemap.xml/` answers **308 → /sitemap.xml** (measured 2026-08-22), which is exactly why the robots line must stay slashless.
- **Verify:** `curl -s https://new.obshee-delo.ru/robots.txt ; curl -sI https://new.obshee-delo.ru/sitemap.xml/ | head -1`
- **Why:** `src/app/robots.ts:4-18` and `src/shared/config/site.ts:83-92` («`trailingSlash: true` installs the inverse redirect for dotted last segments, so the slashed form is the one that 308s»). · **Covered by:** `src/app/robots.test.ts`

#### SEO-16 · P2 · unit — Keep /legacy/\* unindexable and out of the sitemap on both success and failure

- **Given** `/legacy/*` is the iframe's same-origin proxy: both `SUCCESS_HEADERS` and `FAILURE_HEADERS` set `x-robots-tag: noindex`, the success path adds `content-security-policy: frame-ancestors 'self'` and the failure path `cache-control: no-store` (`src/app/legacy/[...slug]/route.ts:25-43`). `isEmbeddable` refuses `legacy` as a first segment and caps depth at 6.
- **When** you `curl -sI /legacy/actual/`; `curl -sI` a 7-segment `/legacy/a/b/c/d/e/f/g/`; and grep the published sitemap for `/legacy/` and for the six paths in `LEGACY_EMBED_PAGES`.
- **Then** the first → 200 with `x-robots-tag: noindex, nofollow` and `content-security-policy: frame-ancestors 'self'` (both measured on stage 2026-08-22). The 7-segment path → 404 with `noindex` and `cache-control: no-store`. The sitemap contains **0** `/legacy/` entries and **0 of 6** legacy-embed paths (`/about/ostavit-otziv/`, `/actual/`, `/get-involved/`, `/get-involved/join/`, `/materials/pppuiv-constructor/`, `/добровольчество/`) — measured 0/6.
- **Verify:** `curl -sI https://new.obshee-delo.ru/legacy/actual/ | grep -iE 'x-robots|content-security' ; curl -s https://new.obshee-delo.ru/sitemap.xml | grep -cE '/legacy/|/actual/</loc>|ostavit-otziv'`
- **Why:** `src/app/legacy/[...slug]/route.ts:6-8` («it exists to be an `<iframe src>` and is `noindex`, so the page at `/<path>/` stays the only indexable address») ; `src/app/sitemap.ts:216` (`isLegacyEmbedPage(decodeURIComponent(pathname))`). · **Covered by:** `src/app/legacy/[...slug]/route.test.ts`

#### SEO-17 · P2 · build — Keep metadataBase in the root layout or every canonical goes relative

- **Given** `src/app/layout.tsx:38-43` sets `metadataBase: new URL(siteUrl)` and its comment records the failure it prevents: without it a relative `alternates.canonical` is emitted relative **and** slashless — pointing every crawler at a 308 — and relative OG images fall back to `http://localhost:3000`.
- **When** you delete the `metadataBase` line (the mutation), run `pnpm build && pnpm start` against a clean `.next`, and read `rel=canonical` and `og:image` on `/`, `/video/filmy/` and `/71933/`.
- **Then** with the line: all three canonicals are absolute, slash-terminated and on the tier's own host, and `og:image` is absolute. Without it: the canonicals come out relative and slashless and `og:image` reads `http://localhost:3000/og-default.png` — the mutation must break this check, and `next dev` alone is not enough to see it.
- **Verify:** `pnpm build && pnpm start`, then `curl -s http://localhost:3000/ | grep -oE 'rel="canonical" href="[^"]*"|og:image" content="[^"]*"'`
- **Why:** `src/app/layout.tsx:38-43` and `src/shared/config/site.ts:68-81` (`canonicalUrl` is «Always trailing-slashed … advertising the slashless twin in a canonical tag or sitemap would point search engines at a redirect»). · **Covered by:** **gap**

## 5. Accessibility & assistive-technology behaviour

_Can somebody navigating by keyboard, by heading or by screen reader reach and understand every surface this site serves — including the markup WordPress, Swiper, Radix and the A6 iframe author for us — and is the answer the same in `next start` as in `next dev`?_

#### A11Y-01 · P0 · e2e — Every rendered surface exposes exactly one h1; the news article at /<id> exposes none

- **Given** a production build served locally (`pnpm build && SITE_URL=http://localhost:3100 pnpm start -p 3100`) or od-stage at https://new.obshee-delo.ru. Four surfaces, one per branch of the app: home `/`, catalogue `/video/filmy/`, WP page `/about/`, news post `/74794/` («САХАР АТАКУЕТ»); `/71933/` is the film control.
- **When** counting `h1` elements in the top document of each URL and reading the first heading level that appears after the breadcrumbs.
- **Then** each of the four returns exactly 1 `h1` whose text is the page's own name, and the film control `/71933/` also returns exactly 1. `/74794/` returns **0** today — `NewsArticle.tsx` renders Breadcrumbs (`:108`) → lifted gallery → date → body with no heading element anywhere in its 156 lines, so the only headings on the page are two `h3`s («Похожие новости» from `SimilarNews.tsx:18` and «Подписаться» from `NewsletterSignup.tsx:50`), and the article opens at h3 with no h1 and no h2. A fix must not produce two h1s on `/video/<id>/`, which already has one at `FilmPage.tsx:111`.
- **Verify:** `for u in / /video/filmy/ /about/ /74794/ /71933/; do echo -n "$u "; curl -s http://localhost:3100$u | grep -o '<h1' | wc -l; done`
- **Why:** `src/modules/News/NewsArticle/NewsArticle.tsx` has no heading element at all; `src/modules/News/SimilarNews/SimilarNews.tsx:18` is `<h3>`; `src/modules/NewsletterSignup/NewsletterSignup.tsx:50` is `h3` in the `narrow` variant. `WpPage` gets one from `src/shared/ui/components/PageHeader/PageHeader.tsx:25` and `FilmPage.tsx:111` has its own, so the post branch is the one surface nothing gives a title to — and it is the largest content set on the site (8 241 published titles, `docs/implementation-notes.md`). §F2 of that doc already records «33 pages open at `h3`» as unfixed; this is the same defect on the post surface, where it was never counted. · **Covered by:** **gap**

#### A11Y-02 · P0 · manual — Measure the focus ring on both Input colours in next start, not next dev

- **Given** a **clean** `.next`, then `pnpm build && SITE_URL=http://localhost:3100 pnpm start -p 3100`. Two fields: the header search on the red bar (`color="red"`, `HeaderClient.tsx:112-118`) and the newsletter e-mail field (`color="gray"`, `NewsletterSignup.tsx:55-63`) on `/`.
- **When** tabbing to each field and reading the computed `outline-style`, `outline-color`, `outline-width` and `border-color` on the `.rt-TextFieldRoot` element, then repeating the whole measurement under `pnpm dev` and diffing the two.
- **Then** in `next start` a focus indicator is present on both fields with ≥3:1 contrast against its adjacent colour. Today it is **absent**: `Input.module.css:15` and `:38` set `outline: none` on `:focus-within`, which ties on specificity with Radix's `outline: 2px solid var(--text-field-focus-color)` (`node_modules/@radix-ui/themes/styles.css:14917`) and wins on source order because `layout.tsx:12` imports the Radix sheet first. The gray field's border is `--gray-4` `#ced2da` focused and unfocused — **1.52:1 against white, and zero change on focus**. The red field goes `--red-1` `#ffeaea` → `--red-4` `#ff8686` over a `--red-7` `#be1710` ground: **2.71:1**, under the 3:1 floor. The dev/start diff must be **empty** — a ring that appears only in dev is the C12 failure mode again.
- **Verify:** `pnpm build && SITE_URL=http://localhost:3100 pnpm start -p 3100`, focus each field, read `getComputedStyle($0)` in devtools, compare against `pnpm dev`; source `src/shared/ui/components/input/Input.module.css:13-16` and `:35-39`
- **Why:** `src/shared/ui/components/input/Input.module.css` lines 6, 15, 20, 28, 38, 44 set `outline: none` six times while line 2 sets `--text-field-focus-color: var(--gray-6)` — the token says a ring was intended and the `outline: none` deletes it. Exactly the RADIX-IMPORT-ORDER class (`docs/implementation-notes.md` §C12): a module class and a Radix rule at equal specificity, decided by graph order, right in `next dev` and wrong in `next start`. Vitest bypasses PostCSS and uses non-scoped class names, so no unit test can see it. · **Covered by:** **gap**

#### A11Y-03 · P0 · e2e — Keyboard-only round trip through the mobile drawer at 390, including focus return after Escape

- **Given** Playwright project `mobile-390` (`playwright.config.ts:19-27`) on `/`. Nav items come from the `main-navigation` menu, so at least one item with children and one without must be present.
- **When** tabbing to «Открыть меню», pressing Enter, tabbing forward through the drawer counting stops, expanding a section with Enter, then pressing Escape — and then repeating with Escape pressed while focus is on the last drawer link rather than on the toggle.
- **Then** the toggle reports `aria-expanded="true"` and `aria-controls="header-mobile-menu"`; every row and the «Оказать помощь» button are reachable; Tab does not escape into the page behind the sheet (the overlay covers it visually but nothing marks it inert); and after Escape focus is on the button now labelled «Открыть меню». Today the second case drops focus to `<body>` — `HeaderClient.tsx:75-79` sets state and unmounts `MobileMenu` with no focus handling, so a reader who opened the menu and tabbed into it lands back at the top of the document.
- **Verify:** `pnpm test:e2e -- --project=mobile-390`; in the spec assert `page.evaluate(() => document.activeElement?.getAttribute('aria-label'))` === 'Открыть меню' after `page.keyboard.press('Escape')`
- **Why:** `src/modules/Header/HeaderClient.tsx:70-79` handles Escape (and the widen-past-900 case at `:87-91`) but never restores focus, and `src/modules/Header/MobileMenu.tsx:45` is a plain `<div>` with a click handler — no `role="dialog"`, no `aria-modal`, nothing taken out of the tree. Contrast `Modal.tsx:54-59`, where the same problem was diagnosed and solved with `restoreFocusTo` because «focus falls to `<body>`». `HeaderClient.test.tsx:98` asserts Escape closes the drawer and asserts nothing about focus; e2e has no mobile-menu coverage at all. · **Covered by:** `src/modules/Header/HeaderClient.test.tsx`

#### A11Y-04 · P0 · unit — The app's own Carousel announces English on a lang="ru" page; the WordPress one announces Russian

- **Given** `/` in a production build, where `Carousel` draws «Программы», «Направления деятельности» (`Directions.tsx:30`, twice, since `SPLIT_HOME_SECTIONS` is true at 3 directions) and «Наши фильмы и мультфильмы» (`FilmsCarousel.tsx:25`, whose carousel is `ariaLabel="Фильмы и ролики"`) — three instances on the site's busiest page, under `<html lang="ru">` (`layout.tsx:78`).
- **When** reading the accessible name and role description of the carousel container, of one slide and of one pagination bullet, then doing the same on a WordPress page whose body carries a `cb-carousel-block`.
- **Then** all strings are Russian on both. Today the app's own component emits `aria-roledescription="carousel"` (`Carousel.tsx:35`), `containerRoleDescriptionMessage: 'carousel'` and `itemRoleDescriptionMessage: 'slide'` (`Carousel.tsx:56`), and — because `paginationBulletMessage` is not passed — Swiper's own default, so every bullet is named **«Go to slide 1»** (`node_modules/swiper/modules/a11y.mjs:19`). The WordPress adapter passes all seven strings in Russian. The two must agree: «карусель», «слайд», «Перейти к слайду N», «Предыдущий слайд», «Следующий слайд».
- **Verify:** `pnpm test -- Carousel` after adding the assertion, or focus a bullet on `/` in the built server and read its `aria-label` in devtools; compare `src/shared/ui/components/Carousel/Carousel.tsx:35,56` against `src/shared/ui/theme/gutenberg/Carousel/CarouselAdapter.ts:92-100`
- **Why:** `CarouselAdapter.ts:88-100` carries the comment «its own copy is English, so every string it announces is replaced here» and supplies seven Russian strings; `Carousel.tsx` supplies two, both still English, and omits the bullet message entirely. Same repo, same Swiper `A11y` module, opposite outcomes — and the English half is the one on the home page. Directly the DUPLICATE-TAB-STOPS family: defects in markup a library generated, which no component review sees. · **Covered by:** `src/shared/ui/components/Carousel/Carousel.test.tsx`

#### A11Y-05 · P1 · e2e — Every linked region of the /contacts/ map is one keyboard stop with a Russian name and a visible focus cue

- **Given** `/contacts/` in a production build. `regions.generated.ts` holds 82 region entries, **53** with an `href` and 29 with `href: null` — note that `RussiaMap.tsx`'s own doc comment and `docs/page-inventory.md` §3 both still say «70 of them linked», so confirm the count from the file before asserting a number.
- **When** tabbing into the SVG and counting stops until focus leaves it, reading the accessible name at each stop, and at one stop reading the computed `fill` of the focused `<path>` and the `outline-*` properties of the `<a>`.
- **Then** exactly one stop per linked region (53 today), each named by its Russian region name («Республика Крым и Севастополь», «Республика Саха (Якутия)»), no stop on any of the 29 unlinked paths, and the focused region's fill changes from `#f8aca0` to `--red-8` `#ae0a04` — the indicator the CSS comment calls the one that «always lands», since the 2px ring is painted over by later siblings. Recompute the comment's claimed **5.3:1** for that fill swap: the WCAG-formula contrast between `#f8aca0` and `#ae0a04` is ~4.0:1, so the number in the file is wrong even though the ≥3:1 requirement is met.
- **Verify:** `node -e "const s=require('fs').readFileSync('src/modules/RussiaMap/regions.generated.ts','utf8');console.log([...s.matchAll(/href: '/g)].length)"` for the expected stop count, then `pnpm test:e2e -- --project=desktop-1440` with a Tab loop, or Tab by hand on https://new.obshee-delo.ru/contacts/; source `src/modules/RussiaMap/RussiaMap.module.css:83-99`
- **Why:** `src/modules/RussiaMap/RussiaMap.tsx:26-46` ships 82 `<path>`s and wraps only the linked ones in `<a href>` with `aria-label`, deliberately with no client JS — so keyboard operability is entirely the browser's handling of an SVG `<a>`, which no test in this repo exercises. `RussiaMap.test.tsx` asserts the anchors and their names in jsdom, where focus order and `:focus-visible` do not exist. The stale «70» in two docs is itself the signal that nobody has counted this in a browser since `od-wp.php` drafted `evreiskaya-ao`. · **Covered by:** `src/modules/RussiaMap/RussiaMap.test.tsx`

#### A11Y-06 · P1 · manual — There is no skip link anywhere on the site, and /contacts/ is where that costs the most

- **Given** any page on od-stage. `grep -rn 'href="#' src/app/layout.tsx src/modules/Header` returns 0 and `layout.module.css` gives `.main` no `id` to target, so no bypass mechanism exists on any route.
- **When** pressing Tab repeatedly from a cold page load on `/contacts/` and counting the stops before reaching the first element of the page's own content (the map's first region), then before reaching the `[od_regions]` accordion below it.
- **Then** a visible «Перейти к содержимому» link is the first stop and jumps focus past the header. Today the count is: the header logo, search field, «Оказать помощь», then every `main-navigation` item, then **53 SVG region links** before the 75 region disclosures — with no way to skip any of it, on every page load, on the page the region accordion lives on. WCAG 2.4.1. A fix must not add a stop the sighted keyboard user cannot see: the link has to become visible on focus, which needs a real focus style — see A11Y-02.
- **Verify:** `grep -rn 'href="#' src/app/layout.tsx src/modules/Header | wc -l` → 0 today, then Tab-count by hand on https://new.obshee-delo.ru/contacts/ and on `/74794/`
- **Why:** `src/app/layout.tsx:78-84` renders `<HeaderServer /> <main> <Footer />` with nothing before the header, and `css.main` carries no `id`. `RussiaMap.tsx:26` is 53 consecutive links by design («A link is what that was imitating, so a link is what this ships»), which is the right decision and is exactly what makes a bypass necessary. The a11y list in `docs/next-steps.md` closed the icon and heading items and never carried this one. · **Covered by:** **gap**

#### A11Y-07 · P1 · manual — The 75 [od_regions] disclosures are keyboard-operable and announce their expanded state

- **Given** `/contacts/` on od-stage (the index came off the iframe on 2026-08-20, `docs/page-inventory.md` §3). `[od_regions]` emits one `<details class="wp-block-details od-region"><summary>` per region, all closed.
- **When** running a screen reader (NVDA or VoiceOver), tabbing to a region summary, pressing Enter, then Enter again, and reading what is announced each time — then checking the summary's computed `outline` on focus and whether the ⊕→⊗ state is conveyed by anything other than the rotated mask.
- **Then** each summary is one tab stop named by its region title, announced as a collapsed/expanded disclosure by the browser's native `<details>` mapping, toggling on both Enter and Space. Focus stays visible: `gutenberg.css:1749-1758` sets `display: flex` and `list-style: none` on the summary but no `outline: none`, so the UA ring must still be measurable — confirm it is not swallowed by any `.gutenberg` rule. The `::before` mask (`gutenberg.css:1772-1783`) is decoration only; the expanded state must not depend on it.
- **Verify:** `php wp/tests/od-regions.test.php` for the markup, then Tab + Enter by hand on https://new.obshee-delo.ru/contacts/ with a screen reader; source `wp/mu-plugins/od-regions.php:260-263`, `src/shared/ui/theme/gutenberg/gutenberg.css:1729-1800`
- **Why:** `od-regions.php:238-239` states the whole a11y argument for the design — «A native `<details>` per region: no script, no state, and the summary is a real one, so keyboard and find-in-page work without anything from us» — and that claim has never been checked in a browser with AT. It is the one place in this project where a shortcode beat a `core/query` loop precisely because `core/details`'s summary cannot be bound (`CLAUDE.md`, D4), so if the native semantics do not hold the whole justification goes with them. `display: flex` on a `<summary>` is also the classic way to lose the disclosure triangle and, in some engines, the toggle. · **Covered by:** `wp/tests/od-regions.test.php`

#### A11Y-08 · P1 · unit — All six A6 iframe pages share one generic accessible name and expose no heading

- **Given** `WP_LEGACY_BASE` set, in a production build. The six paths on `src/shared/config/legacyEmbedPages.ts:79-84`: `/about/ostavit-otziv/`, `/actual/`, `/get-involved/`, `/get-involved/join/`, `/materials/pppuiv-constructor/`, `/добровольчество/` — `/get-involved/` alone is 586 of the iframe's 933 pageviews/91 days (`docs/page-inventory.md` §6).
- **When** reading each of the six top documents' `<iframe title>` and counting their `h1`/`h2` elements, then listing the top document's frames and headings with a screen reader.
- **Then** each iframe carries a distinct Russian name naming the page («Оставить отзыв», «Присоединиться»), not the same string six times, and the top document exposes at least one heading. Today `src/app/[...slug]/page.tsx:247` renders `<LegacyEmbed key={legacyPathname(slug)} slug={slug} />` with no `title`, so every one of the six is announced «Содержимое страницы», and the shell renders header + iframe + footer with **no h1 and no h2** — a reader navigating by heading finds nothing outside the frame, and a reader listing frames cannot tell the six pages apart. The frame's own heading is inside a separate document and does not answer for the page.
- **Verify:** `for p in /about/ostavit-otziv/ /actual/ /get-involved/ /get-involved/join/ /materials/pppuiv-constructor/; do echo -n "$p "; curl -s http://localhost:3100$p | grep -o 'title="[^"]*"' | head -1; done` and the same with `grep -c '<h1'`
- **Why:** `src/app/[...slug]/page.tsx:247` passes only `slug`; `src/modules/Legacy/LegacyEmbed/LegacyEmbed.tsx:36` defaults `title = 'Содержимое страницы'`. LPF-003's V14 in `openspec/changes/fallback/verification-plan.md` asserts a «non-empty Russian `title`», and `LegacyEmbed.test.tsx:74` («gives the frame a Russian accessible name») asserts exactly that — both pass on the default while leaving all six identical, which is how the defect survived a green suite. The metadata path (`legacyMetadata`, V15) already reads the upstream `<title>`, so a per-page name is available at the same point the page is rendered. · **Covered by:** **gap**

#### A11Y-09 · P1 · manual — Moving content has no pause control, and only one of the two moving things honours prefers-reduced-motion

- **Given** two surfaces: the home hero's three marquee rows (`Hero.module.css` `--dur` 64s / 52s / 72s, `@keyframes marquee`) and any WordPress body whose `cb-carousel-block` carries `data-cb-autoplay="true"`.
- **When** loading each with `prefers-reduced-motion: no-preference`, then with `reduce` (devtools Rendering → Emulate CSS media feature), looking for any pause/stop/hide control in either state.
- **Then** with `reduce`, both stop. Today the hero marquee stops (`Hero.module.css:127-131`, `animation: none`) and the WordPress carousel **keeps auto-advancing** — Swiper's `autoplay` is JS-driven and `CarouselAdapter.ts:39-44` sets `disableOnInteraction: false`, so it ignores the media query and also cannot be stopped by interacting with it. With `no-preference`, neither surface offers a pause control at all, and both run longer than 5s — WCAG 2.2.2. Minimum acceptable outcome: the adapter reads `matchMedia('(prefers-reduced-motion: reduce)')` and passes `autoplay: false`, and `disableOnInteraction` becomes `true` so a keyboard user's first arrow press halts it.
- **Verify:** emulate `prefers-reduced-motion: reduce` on https://new.obshee-delo.ru/ and on a page carrying a `cb-carousel-block`; `grep -rn 'prefers-reduced-motion' src/` returns exactly one hit today (`src/modules/Home/sections/Hero.module.css:127`)
- **Why:** `grep -rn 'prefers-reduced-motion' src/` → one hit, in `Hero.module.css`. `src/shared/ui/theme/gutenberg/Carousel/CarouselAdapter.ts:5` imports `Autoplay` and `:39-44` wires it from a WordPress data attribute, so whether the site auto-advances content is an editor's checkbox with no motion guard on our side — and `disableOnInteraction: false` was chosen deliberately, which is the opposite of what SC 2.2.2 wants. Nothing in the repo distinguishes «this animation is decorative» from «this animation must be stoppable». · **Covered by:** **gap**

#### A11Y-10 · P1 · unit — The consent checkbox's label wraps a link, so one click both navigates and toggles consent

- **Given** `NEWSLETTER_SIGNUP_ENABLED` true (`src/shared/config/features.ts:19`) and the form rendered on `/`. The label is `Я согласен на ` + a `<Link href="/personal-data">обработку персональных данных</Link>`, inside a `<Text as="label" htmlFor>` (`Checkbox.tsx:26`).
- **When** clicking «обработку персональных данных»; then, separately, tabbing through the form and recording every stop and its accessible name; then activating the checkbox with Space from the keyboard.
- **Then** clicking the link navigates to `/personal-data/` and leaves `consent` unchanged — today the `<label for>` also fires its default action, so the same click flips the checkbox on the way out and «Подписаться» silently enables or disables. Tab order is: e-mail field → checkbox → link → submit, with the checkbox's own accessible name being the full consent sentence and the link named «обработку персональных данных» — not one control announced twice. Space on the checkbox toggles it without following the link.
- **Verify:** `pnpm test -- NewsletterSignup` with an added assertion on `consent` after clicking the link, or click the link on https://new.obshee-delo.ru/ and check whether the box changed state; source `src/modules/NewsletterSignup/NewsletterSignup.tsx:64-75`, `src/shared/ui/components/Checkbox/Checkbox.tsx:23-29`
- **Why:** `Checkbox.tsx:26` renders `<Text as="label" htmlFor={resolvedId}>{label}</Text>` and `NewsletterSignup.tsx:67-75` passes an element containing an anchor into that `label`. `Checkbox.test.tsx:9` asserts only the `htmlFor`/`id` pairing; `e2e/home.spec.ts:41` clicks the checkbox by its accessible name and never clicks the link. This is the site's 152-FZ consent control, so a state flip nobody asked for is worse here than anywhere else on the page. · **Covered by:** `src/shared/ui/components/Checkbox/Checkbox.test.tsx`

#### A11Y-11 · P1 · script — Audit alt text on WordPress-authored images across the redesigned pages

- **Given** od-stage's WP (`.env.stage`). `resolveContentAssets` rewrites `src`, strips `srcset`/`sizes` and sets `loading`/`fetchPriority` — it never touches `alt`, so whatever the editor left is what ships on 153 natively-rendered pages and ~8 200 posts.
- **When** fetching every published page's `content.rendered` and counting `<img>` with no `alt` attribute at all, with `alt=""`, and with a filename-shaped alt (`metodichka-mult`, `IMG_1234`, `photo-1`), broken down by page.
- **Then** a dated table with three numbers per bucket and a named worst offender. `alt` **missing entirely** is the bucket that must go to zero — an unnamed `<img>` is announced by its URL — while `alt=""` on a decorative image is correct and must not be "fixed". Filename-shaped alt is a content ticket, not a code one. Expect the redesigned pages to be better than the passthrough ones: `od_headings_into_image_alt` already wrote real alt on `/materials/metodichki/`, replacing the migrator's «metodichka-mult» on two of three covers.
- **Verify:** a one-off `node --env-file=.env.stage` script over `/wp/v2/pages?per_page=100&_fields=link,content` counting the three shapes, sibling to `scripts/page-inventory.mjs`; cross-check one page by eye with `curl -s https://new.obshee-delo.ru/materials/metodichki/ | grep -o 'alt="[^"]*"'`
- **Why:** `src/shared/lib/wpContent/resolveContentAssets.ts` rewrites `src`, `srcset`, `sizes`, `loading` and media `href` and has no `alt` branch — the string `alt` appears nowhere in the file (`grep -c alt` → 0). `docs/implementation-notes.md` records that the migrator wrote «metodichka-mult» as alt on two covers and that `od_headings_into_image_alt` (`wp/scripts/od-pages.php:1483`, comment at `:1493`) fixed exactly that one page, so the class is known to exist and has been measured on exactly one of 153 pages. Nothing on the frontend can see the rest (`docs/wp-page-redesign.md`: the fix for content lives in a script). · **Covered by:** **gap**

#### A11Y-12 · P1 · e2e — Open the lightbox from a keyboard on a real WordPress body, trap focus, and get it back on Escape

- **Given** `/materials/plakati/` on od-stage — 159 blocks, 33 `/wp-content/` links, the page whose thumbnails link a print-quality poster (`openspec/changes/fallback/verification-plan.md`, Fixtures). Content arrives across the RSC boundary: `GutenbergProvider` around `parsePost`'s output, wrapped by `ImagePreviewClient`.
- **When** tabbing to a thumbnail's anchor and pressing Enter, then tabbing forward more times than there are focusable elements in the dialog, then pressing Escape — and repeating on an image whose anchor points at a real page rather than an upload.
- **Then** Enter opens the dialog (`role="dialog"`, `aria-modal`, name «Просмотр изображения»); Tab cycles inside it and never reaches the header or footer; Escape closes it and focus is back on the exact anchor that opened it, not on `<body>`; and the page-linked image still navigates instead of opening a preview. The dialog's `<Image alt="">` (`ImagePreviewClient.tsx:147`) means the dialog announces only its generic title — acceptable only because the thumbnail behind it carries the name; if A11Y-11 finds the thumbnail's alt empty too, the preview is unnamed end to end.
- **Verify:** `pnpm test:e2e -- --project=desktop-1440` against a spec that does `keyboard.press('Enter')` then asserts `document.activeElement` after Escape, or by hand on https://new.obshee-delo.ru/materials/plakati/
- **Why:** `src/shared/ui/components/ImagePreview/ImagePreviewClient.tsx:136-139` states the keyboard path is «the anchor WordPress already wraps the image in» — a claim about markup this repo does not author, checked by no test. The whole component exists because the previous version «attached to nothing in the browser: 0 of 19 images» while its unit test passed (LIGHTBOX-RSC-BOUNDARY), and `Modal.tsx:19-26` documents that Radix drops focus to `<body>` for a triggerless dialog unless `restoreFocusTo` is supplied — which is set from `img.closest('a') ?? img` at `ImagePreviewClient.tsx:126`, i.e. from an element that only exists if the WP body wrapped it. Both halves are browser-only facts. · **Covered by:** `src/shared/ui/components/Modal/Modal.test.tsx`

#### A11Y-14 · P2 · manual — Two controls are announced as actionable and do nothing when activated

- **Given** `/` on od-stage. The header search field (`aria-label="Поиск по сайту"`, `HeaderClient.tsx:112-118`) and, below 900px, the search IconButton with the same label (`HeaderClient.tsx:138-140`).
- **When** reaching each control with a screen reader and activating it: Enter in the field, then the mobile button.
- **Then** either the control does something, or it is not offered: `disabled` / `aria-disabled="true"`, or removed behind the same kind of flag `NEWSLETTER_SIGNUP_ENABLED` gives the newsletter. Today both are announced as live controls — the button as «Поиск по сайту, кнопка» with no `onClick` at all — and activating either produces nothing, with no message and no error. A reader who cannot see that no results appeared has no way to learn the control is inert.
- **Verify:** activate the search button at 390px on https://new.obshee-delo.ru/ and observe; `grep -n 'onClick' src/modules/Header/HeaderClient.tsx` shows a handler only on the menu toggle (`:145`)
- **Why:** `src/modules/Header/HeaderClient.tsx:35-37` states «The search field is presentational until B7 lands a `/search/` route — the data layer (`fetchSearch`) exists, the page does not, so submitting it would only 404», and the mobile IconButton at `:138` has no handler whatsoever. The project already has the pattern for a control that must not be offered yet — `src/shared/config/features.ts:5-19` gates the newsletter form off «because a flag flipped before the integration exists reopens the dead path» — and search was not given the same treatment. Same class as NEWSLETTER-DEAD-FORM, on the surface a screen-reader user hits first on every page. · **Covered by:** **gap**

#### A11Y-15 · P2 · manual — What the .od-more disclosure on /about/ announces once it is open

- **Given** `/about/` on od-stage, where `od_pages_about()` (`wp/scripts/od-pages.php:4054`) writes the long read as a `core/details` classed `od-more`. Closed, the summary's text is the stored label; open, `gutenberg.css` sets `font-size: 0` on it and draws «Свернуть» with `::after`.
- **When** focusing the summary with a screen reader, reading what is announced, pressing Enter, and reading what is announced again.
- **Then** both states announce something a reader can act on, and the two do not contradict each other. The file's own claim is that «the stored label is what a screen reader announces in both states» — verify it, because generated `::after` content is in the accessibility tree in current Chrome, Firefox and Safari, which would make the open-state name the stored label **plus** «Свернуть» concatenated, while `font-size: 0` hides only the visual half. If that is what happens, the name has to move to a solution that is not a CSS trick (two summaries, or the label left alone).
- **Verify:** NVDA or VoiceOver on https://new.obshee-delo.ru/about/, both states; source `src/shared/ui/theme/gutenberg/gutenberg.css:2254-2292` (`.od-more summary`, `.od-more[open] summary`)
- **Why:** the comment at `gutenberg.css:2278-2288` states the constraint («a `<details>` has no way to swap its own summary and there is no script on a WordPress body to do it») and then asserts the AT behaviour without measuring it — «The stored label is what a screen reader announces in both states, which is the reason not to push this any further». That is the one accessibility claim in `gutenberg.css` that a browser can contradict, and `/about/` is a top-nav destination. · **Covered by:** **gap**

#### A11Y-16 · P2 · build — The app-wide aria-hidden on icons holds in the production bundle, and the two svgr configs have not drifted

- **Given** a production build. The default lives in the `@svgr/webpack` options in `next.config.ts:46` (`svgProps: { 'aria-hidden': 'true' }`) and is **mirrored by hand** in `vitest.config.ts:15` — two files that must say the same thing, with nothing linking them.
- **When** grepping the built HTML of `/` for `<svg` occurrences without `aria-hidden`, and checking the three components that import an SVG directly rather than through `Icons/index.tsx`: `Accordion.tsx:11`, `Breadcrumbs.tsx:3`, `ButtonGroupItem.tsx:6`.
- **Then** zero `<svg>` in the built output lacks `aria-hidden="true"` except where a call site deliberately passed `aria-hidden={false}` with its own `role`/`aria-label`. And every icon-only control still has a name of its own — «Предыдущий слайд», «Следующий слайд», «Поиск по сайту», «Открыть меню», «Закрыть меню», «Предыдущая страница», «Следующая страница», and the three footer social links — because the whole default is only safe on that precondition.
- **Verify:** `grep -o '<svg[^>]*>' .next/server/app/index.html | grep -vc 'aria-hidden'` → 0; and `diff <(grep -o "svgProps.*" next.config.ts) <(grep -o "svgProps.*" vitest.config.ts)` to catch the two configs drifting
- **Why:** `docs/next-steps.md` records this as closed with «the precondition was checked first, and it held», and `Icons.test.tsx:16,22` pins both the default and the `aria-hidden={false}` override — but that test runs under `vitest.config.ts`'s own copy of the option, so it proves the mirror, not the build. `src/shared/config/svgo.ts` is explicit that «the test pipeline deliberately doesn't use it», the same structural blind spot that made SVG-ID-COLLISION provable only from `.next/server/app/index.html`. A new icon-only control that forgets its `aria-label` also becomes nameless silently, which is the other half of what this asserts. · **Covered by:** `src/shared/ui/components/Icons/Icons.test.tsx`

#### GAP-03 · P1 · e2e — Open a desktop header flyout from the keyboard: the trigger is a link, not a button

- **Given** `ButtonGroupItem.tsx` wraps a `NextLink` in Radix's `NavigationMenuTrigger asChild`, so the trigger renders as an `<a href>` with `aria-current` and no `aria-haspopup`/`aria-expanded`; the submenu is `NavigationMenuContent` animated by `.content[data-state='open']` (`ButtonGroupItem.module.css:21-24`). The nav comes from the `main-navigation` menu — 35 items, 7 top-level on od-stage — so at least one cell has children. `src/shared/ui/components/ButtonGroup/` has no test file at all.
- **When** at 1440 in the `desktop-1440` Playwright project: tabbing to a nav cell that has a flyout and reading `aria-expanded`/`aria-haspopup`; pressing Enter; pressing Space; pressing ArrowDown; and tabbing forward from the closed trigger to see whether the child links are in the tab order — then repeating with the pointer to confirm the flyout exists at all.
- **Then** the flyout is reachable and dismissible without a pointer: activating the trigger either opens it (and Enter on a second press follows the link) or the child links are reachable by Tab from the parent, and the open state is announced. Today Enter navigates to the section page and the children are pointer-only, so a keyboard user reaches the flyout's destinations only by loading the parent page first — if that page lists them. `aria-expanded` is absent either way, so a screen reader is not told there is a submenu.
- **Verify:** `pnpm test:e2e -- --project=desktop-1440` with a new spec asserting `getAttribute('aria-expanded')` and `page.keyboard.press('Enter')` behaviour; source `src/shared/ui/components/ButtonGroup/ButtonGroupItem.tsx:21-36`
- **Why:** A11Y-03 covers the mobile drawer at 390 and `HeaderClient.test.tsx:123` covers a current section that has children _in the drawer_; nothing anywhere covers the desktop flyout. It is the same class as A11Y-04 — a defect in markup a library generated, invisible in a component review — and `NavigationMenuTrigger asChild` onto an anchor is the documented way to lose both the trigger's button semantics and its keydown handling. It sits on every page of the site. · **Covered by:** **gap**

## 6. Responsive layout & CSS-cascade fidelity

_Does the same element compute the same pixels in `next dev`, in `next start` and at each of the four breakpoint boundaries, when a CSS-module class, a Radix `:where()` rule, `gutenberg.css`'s bare tag rules and a dead theme's author `<style>` all tie on specificity and are settled only by source order?_

#### CSS-01 · P0 · manual — Diff 13 computed properties across `next dev` and `next start` on four pages

- **Given** local checkout on `main`, `.env` pointed at od-stage (`WP_BASE=https://od.webtm.ru`), a **clean** `.next`, and Chrome DevTools (or a headless script that walks the DOM).
- **When** for `/`, `/news/`, `/video/` and `/materials/`, snapshot `font-size font-family font-weight line-height letter-spacing text-transform color background-color padding height border-radius box-shadow margin` on every element carrying a CSS-module class — once against `pnpm dev`, once against `rm -rf .next && pnpm build && pnpm start` — and diff the two sets.
- **Then** zero differing elements. Specifically, `/news/`'s `<h1>` reading «НОВОСТИ» computes `font-size: 48px`, `font-family` beginning `PT Sans Narrow`, `text-transform: uppercase` and `color: rgb(190, 23, 16)` under **both** servers — not 24px / `PT Sans` / `none` / Radix ink under `start`. Any non-empty diff means the stylesheet import order moved.
- **Verify:** `rm -rf .next && pnpm build && pnpm start` on :3000 vs `pnpm dev`; the numbers to match are in `docs/implementation-notes.md` §C12 — 8 differing elements before the fix, «NO DIFFERENCES» after.
- **Why:** src/app/layout.tsx:1-13 carries a comment forbidding the move but nothing enforces it; `docs/prod-migration-runbook.md` §0.7 lists «a style is right in `next dev` and wrong in `next start`» as a live symptom. vitest.config.ts:36-42 bypasses the project PostCSS pipeline and uses `non-scoped` class names, so no unit test can observe specificity at all. · **Covered by:** **gap**

#### CSS-02 · P0 · build — Move the Radix imports into the provider and confirm the H1 drops to 24px

- **Given** a throwaway branch off `main`; CSS-01's snapshot method already working.
- **When** move `import '@radix-ui/themes/styles.css'` and `import '@/shared/ui/theme/radix/theme-override.css'` out of `src/app/layout.tsx` and back into `src/shared/ui/theme/radix/radix-provider.tsx`; run `pnpm lint` (so `import/order` re-alphabetises), then `rm -rf .next && pnpm build && pnpm start`; re-run CSS-01.
- **Then** `/news/`'s H1 computes `font-size: 24px` and CSS-01's diff reports **at least 8** differing elements — `PageHeader`'s `.title`, `Dropdown`'s `.trigger` and the `Button` size modifiers among them. `pnpm lint`, `pnpm type-check` and `pnpm test` all still pass, which is the point. Then revert. If the diff still reads zero, CSS-01's method is broken, not the code.
- **Verify:** src/app/layout.tsx:1-13 and src/shared/ui/theme/radix/radix-provider.tsx:4-13; §C12 of `docs/implementation-notes.md` names the 8 elements (`PageHeader`'s `.title`, `CardSection`'s `.heading`, `Dropdown`'s `.trigger`, two `Button` size modifiers) and the four pages the original script walked — `/materials/`, `/projects/`, `/video/`, `/news/`.
- **Why:** the whole C12 fix is an import position that no lint rule, type or test guards; a mutation is the only way to know CSS-01 has teeth. `import/order` ignores unassigned side-effect imports, which is exactly what lets them be moved back without a lint error. · **Covered by:** **gap**

#### CSS-03 · P0 · e2e — Measure horizontal overflow at 390 and 1440, where `overflow-x: clip` hides it

- **Given** Playwright projects `desktop-1440` and `mobile-390` (playwright.config.ts:14-27) against `pnpm build && pnpm start` or https://new.obshee-delo.ru.
- **When** on `/`, `/video/`, `/video/filmy/`, `/news/`, `/materials/`, `/contacts/`, a regional `/contacts/<region>/`, `/71933/`, `/about/` and `/team/`, evaluate `[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map(e => e.className)`.
- **Then** the list is empty at both widths, except the Hero photo band `.photos`, whose `right: calc(50% - 50vw)` is designed to land on the viewport edge. Note `document.documentElement.scrollWidth` is **useless** as the signal: `overflow-x: clip` on `html, body` stops the document growing, so an overflow shows up as no scrollbar and unreachable content, not as scrollWidth > clientWidth.
- **Verify:** `pnpm test:e2e` after adding the spec (`e2e/` already has both viewport projects and two specs), or paste the filter into the DevTools console at 390 and 1440.
- **Why:** src/shared/ui/styles/global.css:10-19 picks `clip` over `hidden` on purpose (to kill the ~8px scrollbar the hero's full bleed adds), so any overflow is silently lost rather than scrollable. gutenberg.css:164 gives only `pre` an `overflow-x: auto`; a WP body's bare `<table>` — one with no `.wp-block-table` figure, so `@wordpress/block-library/build-style/style.css:4113`'s `overflow-x: auto` never matches — gets `width: 100%` and `border-collapse: collapse` from gutenberg.css:167-175 and no scroll container. · **Covered by:** **gap**

#### CSS-04 · P0 · manual — Assert each query loop renders its `columns-N` tracks, not one full-width card

- **Given** od-stage (https://new.obshee-delo.ru) at 1440; a regional page with a coordinator loop plus an «События» loop — `/contacts/amurskaya/` is the measured one (57 such pages on the prod clone, 75 on od-dev).
- **When** for each `ul.wp-block-post-template.is-layout-grid` on the page read `getComputedStyle(el).gridTemplateColumns` and count the tracks; then read `document.body.scrollHeight`.
- **Then** every loop resolves to the number of tracks its own `columns-N` class asks for (or 2 where `:has(> .od-person)` applies), never a single full-width track. `/contacts/amurskaya/` is under ~2 500px tall — not the **9 257px** measured before the fix, against the mock's 1 963.
- **Verify:** src/shared/ui/theme/gutenberg/gutenberg.css:287-315 (`--od-loop-columns`); `docs/wp-page-passthrough.md` §4 «Every grid query loop came out one card per row».
- **Why:** WordPress prints `grid-template-columns` **per container** into the page's own `<style>` and a REST `content.rendered` carries the container class without the rule, so the tracks exist only in `gutenberg.css`. Any change to the class names `content.rendered` emits silently returns the 9 257px page on all 57 regional pages, at status 200. · **Covered by:** **gap**

#### CSS-05 · P1 · manual — Read the film page's Box gap at 390, where nested breakpoints render 40, not 32

- **Given** `/71933/` (a real film verified rendering on od-stage) at viewport width 390.
- **When** read `getComputedStyle(document.querySelector('[class*=gap-mobile]')).gap` — the outermost FilmPage `<div>`, which carries `gap-mobile gap-smallDesktop gap-desktop`. Repeat at 899, 900, 1439 and 1440.
- **Then** **40px at 390 and 899**, not the 32 that src/modules/Video/FilmPage/FilmPage.tsx:95 writes (`gap={{ mobile: 32, smallDesktop: 40, desktop: 40 }}`); 40px at 900, 1439 and 1440. Record 40 as the current deliberate behaviour: below 900 both `--mobile` and `--small-desktop` match and `.gap-smallDesktop` is in the later block. If it ever reads 32, `Box.module.css`'s block order has changed and every Box on the site needs re-checking.
- **Verify:** src/shared/ui/components/Box/Box.module.css:11-16 («Block order is load-bearing»); `grep -rn "mobile:" src --include='*.tsx' | grep smallDesktop` returns exactly this one call site.
- **Why:** the tiers are nested max-widths (src/shared/ui/styles/media.css:7-10), so the prop reads as the opposite of what it renders. There is no `Box.test.tsx` at all, and a media query is unobservable in jsdom, so nothing anywhere pins this. · **Covered by:** **gap**

#### CSS-06 · P1 · manual — Count coordinator cards per row at 390 on a regional contacts page

- **Given** a regional page whose coordinator loop holds two or more `profile` records — `/contacts/samarskaya/` holds eight — at viewport width 390.
- **When** read `getComputedStyle(document.querySelector('.wp-block-post-template.is-layout-grid')).gridTemplateColumns` on the loop containing `li.od-person`, and count cards per row visually.
- **Then** it currently renders **two** tracks of roughly 175px each, not the one track the `@media (--mobile)` rule intends: `.wp-block-post-template.is-layout-grid:has(> .od-person)` is (0,3,0) against that rule's (0,2,0) **and** comes 8 lines later. `/team/`'s `.od-team` grid does collapse to `1fr` below 900, so the two person grids disagree on a phone. Expected: one column below 900, matching `PersonCard`'s own mobile rules, which shrink the photo to 80×104 for a full-width card.
- **Verify:** src/shared/ui/theme/gutenberg/gutenberg.css:311-315 vs :323-326, and :2136-2140 for `.od-team`'s working override. `npx stylelint src/shared/ui/theme/gutenberg/gutenberg.css --mw 0` is clean (verified, exit 0), so `pnpm lint:styles` cannot catch it.
- **Why:** `:has()` takes the specificity of its argument, which nothing in the file's ordering accounts for. src/shared/lib/wpContent/parsePost.tsx:145 emits the `li.od-person` and parsePost.test.tsx:78 asserts it exists — nothing asserts what it lays out as. · **Covered by:** **gap**

#### CSS-07 · P1 · manual — Verify PersonCard's doubled selectors beat gutenberg.css's bare tag rules

- **Given** a regional `/contacts/<region>/` page at 1440 on od-stage, where `PersonCard` is rendered **inside** `<GutenbergProvider>` as a query-card swap.
- **When** on one card read the computed `font-size` and `margin` of the name paragraph, and the `padding-left`, `list-style-type` and `font-size` of its `<ul>` and `<li>` contact rows.
- **Then** name 18px with `margin: 0px`; contact list `padding-left: 0px`, `list-style-type: none`, `margin: 0px`; each row 18px with `margin: 0px`. Under a single (0,1,0) module class these measured 16px with a 1em bottom margin and `ul`'s 1.5em indent, because `@nested-import` turns gutenberg.css's bare `p`/`ul`/`li`/`a`/`img` rules into `.gutenberg p` at (0,1,1).
- **Verify:** src/shared/ui/components/PersonCard/PersonCard.module.css:1-13 names the exact symptom; the doubled selectors are at :43-50, :59-84 and :88. src/shared/ui/theme/gutenberg/gutenberg-provider.css:12-18 is where the nesting happens.
- **Why:** any new component placed inside a WP body inherits this trap, and the symmetric half bit too: a rule of ours matching an element directly beat the colour a page's own CSS set on the ancestor, which is why `.wp-block-columns p { color }` was deleted (`docs/wp-page-passthrough.md` §4, «Then the captions came back grey»). · **Covered by:** **gap**

#### CSS-08 · P1 · manual — Step the header nav label 16 to 14 at 1439 and its padding 100 to 20 at 1199

- **Given** `/` on od-stage, tested at exactly 1440, 1439, 1200, 1199 and 900 (DevTools device toolbar, responsive mode).
- **When** read the computed `font-size` and `padding` of a header nav cell (`ButtonGroupItem`'s `.base`) and the `padding` of the header's `.desktop` wrapper.
- **Then** nav label 16px at 1440, **14px at 1439, 1200, 1199 and 900**. Cell padding `10px 20px` at 1440, `10px 8px` at 1439 and below. Header side padding `0px 100px` at 1440 and 1200, `0px 20px` at 1199 and 900. The 14px step exists only because the selector is doubled — a lone `.base` ties with `.rt-Text:where(.rt-r-size-3)` and loses on source order, and it shipped that way rendering 16px at every width from 900 to 1439 while the `padding` in the same block applied.
- **Verify:** src/shared/ui/components/ButtonGroup/ButtonGroupItem.module.css:113-124 (`.base.base`) and :79-87 (the padding step); src/modules/Header/HeaderClient.module.css:25-34; `docs/design-system.md` §2.8 table and §4.4 item 1.
- **Why:** `:where()` contributes zero specificity, so every Radix prop is a silent tie with a single module class — the failure mode is one property in a block applying while its neighbour does nothing. `HeaderClient.test.tsx` tests markup and drawer behaviour, not computed style. · **Covered by:** **gap**

#### CSS-09 · P1 · manual — Compare the body column against the header and footer column at 1439 and 1200

- **Given** any page on od-stage, at exactly 1440, 1439, 1200, 1199, 900 and 899.
- **When** measure `getBoundingClientRect().width` of `main.main`, of the header's `.inner` and of the footer's `.inner`.
- **Then** 1440 → 1240 / 1240 / 1240. 1439 → **860 / 1239 / 1239** — a 379px mismatch, the nav row and footer grid wider than every page's content. 1200 → 860 / 1000. 1199 → 860 / 1159. 900 → 860 / 860 (they coincide). 899 → viewport−32 / mobile bar. Then decide whether 860 across the whole 900–1439 band is intended: `docs/design-system.md` §2.8's table gives 1240 at ≥1440 with 100/100 padding held down to 1200, i.e. a 1000-wide column at 1200, not 860.
- **Verify:** src/app/layout.module.css:3-14 (`--container-3: 860px` under `--small-desktop`) against src/modules/Header/HeaderClient.module.css:25-40 and src/modules/Footer/Footer.module.css:15-28; `--container-3`/`--container-4` values at src/shared/ui/theme/radix/theme-override.css:85-86.
- **Why:** the body column reads the 1440 threshold and the chrome reads the 1200 one — the unclosed half of A1b, still listed open at `docs/design-system.md` §4.4 item 4 while §2.8 says «Half of this closed with C9». Every page inherits it, because `app/layout.tsx` wraps all of them in `main.main`. · **Covered by:** **gap**

#### CSS-10 · P1 · manual — Land the footer's tier switches exactly one pixel below Figma's 1200 and 900

- **Given** `/` on od-stage at exactly 1200, 1199, 900 and 899.
- **When** count the footer's grid columns and read `getComputedStyle(footer).padding`; check whether the logo `<aside>` spans the full row.
- **Then** 1200 → 4 columns, `32px 100px 40px`, logo in column 1 (matches Figma `footer-1200`, 1621:15559, which draws four columns at 100px padding). 1199 → 3 columns, `32px 20px 40px`, logo `grid-column: 1 / -1`. 900 → 3 columns, 20px padding (matches `footer-900`, 1621:15660). 899 → 2 columns. Each transition sits exactly one pixel below the Figma frame it reproduces, because `--tablet (width < 1200px)` and `--mobile (width < 900px)` are strict `<`.
- **Verify:** src/shared/ui/styles/media.css:7-10; src/modules/Footer/Footer.module.css:20, :31-42, :45-49; `docs/design-system.md` §3.2 `footer-1200 · footer-900` row.
- **Why:** the four-tier ladder is correct today at both frame widths and nothing pins it — a `<=` typo, or a rename of `--tablet` to match Figma's label, moves the footer one tier at every width. `src/modules/Footer/utils/renderFooterWidget.test.tsx` maps widget HTML; it never sees a column count. · **Covered by:** **gap**

#### CSS-11 · P1 · manual — Read the H1's computed letter-spacing, where a percentage is not a valid length

- **Given** `/news/` at 1440 in Chrome DevTools (any tier — this is not build-order dependent).
- **When** select the `<h1>` reading «НОВОСТИ»; read `letter-spacing` in the Computed panel and find the `.title { letter-spacing: var(--letter-spacing-9) }` declaration in the Styles panel. Also run `getComputedStyle(document.querySelector('h1')).letterSpacing`.
- **Then** the computed value is **not** `0.96px` (2% of 48px). `letter-spacing` accepts `normal | <length>` and no shipping browser accepts a percentage, so the substituted `2%` is invalid at computed-value time and the declaration behaves as `unset` — DevTools shows it struck through with a warning. This makes the whole nine-step tracking scale inert, Radix's own `-0.025em` at size 9 included, for every `.rt-Text` and `.rt-Heading` on the site. The fix is `em`, exactly as `Logo.module.css:43` already writes (`0.04em`).
- **Verify:** src/shared/ui/theme/radix/theme-override.css:68-76 (all nine tokens are `0%`/`2%`); src/shared/ui/components/PageHeader/PageHeader.module.css:10-23, whose own comment says the tracking «went missing» before it was routed through the token; node_modules/@radix-ui/themes/styles.css:4456-4464 for the `em` values being overridden.
- **Why:** the C12 fix restored the H1's size, family, colour and case but not its tracking, and nothing reports it: the declaration parses, so lint and stylelint pass, and both `next dev` and `next start` agree — the only place the failure is visible is the computed panel. · **Covered by:** **gap**

#### CSS-12 · P1 · manual — Edit gutenberg.css alone and confirm the dev chunk does not invalidate

- **Given** `pnpm dev` running (check the log's `Local:` line for the real port — an `od-frontend` container often holds 3000), a page with WP content on screen, e.g. a regional `/contacts/<region>/`.
- **When** change one colour in `src/shared/ui/theme/gutenberg/gutenberg.css` only, save, hard-reload. Then `touch src/shared/ui/theme/gutenberg/gutenberg-provider.css` and reload. Then stage and commit (lint-staged runs `stylelint "**/*.css" --fix`) and reload again.
- **Then** the change is **absent** after the first reload, **present** after touching the provider, and can go absent again after the commit's `stylelint --fix` rewrites the imported file. Confirm by reading the served CSS chunk in the Network panel, not the source file.
- **Verify:** src/shared/ui/theme/gutenberg/gutenberg-provider.css:1-11 records exactly this behaviour; package.json:37-39 is the lint-staged hook that re-stales it.
- **Why:** Turbopack does not track `@nested-import` dependencies, so «my rule is being ignored» and «my rule was never compiled» are indistinguishable in dev — which is how a wrong diagnosis of a real cascade problem gets made, and why the C12 gate compares `dev` against `start` rather than trusting either. · **Covered by:** **gap**

#### CSS-13 · P1 · manual — Keep the two `.textcapt` captions inside their tiles, not over the site header

- **Given** `/materials/printed-products/` and `/materials/social-reklama/` at 1440 on od-stage — both served natively by the catch-all, both carrying an inline `<style>` with `.textcapt { position: absolute; top: 15px; left: 17px }` from the deleted CMSMasters theme.
- **When** for each caption compare its `getBoundingClientRect().top` against its tile's; read its computed `color`; read the computed `position` of the enclosing `.wp-block-column`.
- **Then** each caption's top is inside its own tile (not at the top of the document, over the red site header), the column computes `position: relative`, and the caption is red — the page's own `.redcapt` on the _column_ wins, because our competing `.wp-block-columns p { color }` rule was deleted (an inherited value loses to a direct match, so the rule was overriding the page rather than styling it).
- **Verify:** src/shared/ui/theme/gutenberg/gutenberg.css:354 (the parity rule); `docs/wp-page-passthrough.md` §4 «Captions flew to the top-left corner of the document» and «Then the captions came back grey», plus §2's table — 7 pages carry positioning author CSS, 3 of them reach this renderer.
- **Why:** the author CSS arrives inside `content.rendered` as unlayered, unscoped rules written against a theme that is no longer loaded, and prod's content migrates through the same converter at cutover, so it will bring the same `<style>` blocks. Deleting the parity rule puts a caption on top of the site header on a page nobody edited. · **Covered by:** **gap**

#### CSS-14 · P2 · unit — Pin Box's class and custom-property emission for empty, scalar and tiered props

- **Given** Vitest + jsdom, a new `src/shared/ui/components/Box/Box.test.tsx`.
- **When** render `<Box />`, `<Box pt={0} />`, `<Box py="1rem" />`, `<Box gap={{ mobile: 32, smallDesktop: 40, desktop: 40 }} />`, `<Box display={{ mobile: 'none' }} />`, `<Box mb={undefined} />` and `<Box mx={8} />` (one of the fifteen props that were deleted).
- **Then** `<Box />` renders a bare `<div>` with no class and no inline custom property. `pt={0}` emits class `pt` and `--box-pt: 0px` — zero is kept, only `undefined` is skipped. `py="1rem"` passes the string through unchanged. The responsive gap emits exactly `gap-mobile gap-smallDesktop gap-desktop` with `--box-gap-mobile: 32px`, `--box-gap-smallDesktop: 40px`, `--box-gap-desktop: 40px` and **no** bare `gap` class. `display={{ mobile: 'none' }}` emits only `display-mobile`. `mx={8}` falls through to `rest` and is spread onto the DOM node as an unknown attribute.
- **Verify:** `pnpm test src/shared/ui/components/Box`; src/shared/ui/components/Box/Box.tsx:59-66 (`LENGTH_PROPS`/`KEYWORD_PROPS`) and :79-92 (the `set` loop).
- **Why:** the layout primitive every page's spacing goes through has zero tests. The media-query half is unobservable in jsdom — that is CSS-05's job — but the class-and-variable half is pure function output and pinning it is what makes CSS-05 diagnosable when a gap comes out wrong. · **Covered by:** **gap**

#### CSS-15 · P2 · manual — Emulate reduced-motion, print and forced dark on the home page

- **Given** `/` and `/contacts/` on od-stage; DevTools → Rendering → «Emulate CSS prefers-reduced-motion: reduce», then Ctrl+P print preview.
- **When** with reduce on, watch the Hero photo band, then open an Accordion on `/contacts/`, hover a header nav cell with a flyout, and advance a home carousel. Then print-preview `/71933/`. Then force dark at the OS/browser level.
- **Then** the Hero marquee is static — src/modules/Home/sections/Hero.module.css:127-131 is the **only** `prefers-reduced-motion` block in the repo (`grep -rn prefers-reduced-motion src` returns 1). The 300ms Accordion `slideDown`/`slideUp`, the ButtonGroup submenu `scaleIn`/`scaleOut` and every 0.15–0.2s hover transition still run: record that as accepted, since the infinite animation is the one that matters. Print: no `@media print` exists anywhere, so the red header bar, the Kinescope player frame and the full footer all print — decide whether that is acceptable for the methodology pages editors are told to print. Forced dark: Radix declares `color-scheme: light` on the root theme, so form controls stay light and nothing in this repo declares a dark palette.
- **Verify:** `grep -rn "prefers-reduced-motion\|@media print\|prefers-color-scheme" src` (1 / 0 / 0 hits, verified); src/shared/ui/components/Accordion/Accordion.module.css:46-52 and :66-82; src/shared/ui/components/ButtonGroup/ButtonGroupItem.module.css:21-39; node_modules/@radix-ui/themes/styles.css:3438.
- **Why:** three preference media features the design never specified, one of which is partly honoured — the honest gate is knowing which, not assuming all three are handled. Documenting the single guard stops the next animation from being added on the assumption there is a global one. · **Covered by:** **gap**

#### CSS-16 · P2 · manual — Wrap the longest Russian film title at 390 without clipping or overflow

- **Given** od-stage at 390 and 1440. Real long titles to use: «Вред вейпа, айкоса, кальяна, курения – ДОКУМЕНТАЛЬНЫЙ ФИЛЬМ» and «Влияние алкоголя на репродуктивную систему человека».
- **When** find those cards on `/video/filmy/`; open one film's page and read its `<h1>`; on a regional `/contacts/<region>/` read a coordinator's e-mail row in the `PersonCard`.
- **Then** no word is clipped mid-glyph and no text escapes its card at 390: the film `<h1>` sets to 28px there (32px desktop) and may run several lines, which must push the card taller rather than overflow it. A long e-mail breaks mid-string — `PersonCard.module.css:88` is the only `overflow-wrap: anywhere` in the repo. `NewsCard.module.css`'s `.title` has neither a clamp nor a wrap rule, so an unusually long title makes that card taller than its row-mates; the excerpts are clamped (VideoCard 5 lines, NewsGrid 4). Cross-check with CSS-03: if any of this overflows, `overflow-x: clip` means there is no scrollbar to tell you.
- **Verify:** `grep -rn "overflow-wrap\|word-break\|hyphens" src` returns one hit (verified); src/modules/Video/FilmPage/FilmPage.module.css:30-39; src/shared/ui/components/NewsCard/NewsCard.module.css:44-48; src/modules/Video/VideoCard/VideoCard.module.css:89-98.
- **Why:** Russian words are long and the type is set in a narrow display face at 48/32/28px through tokens, so the wrap behaviour is load-bearing and untested — every existing fixture in the suite uses short strings, and the one class of URL bug this repo has already shipped (percent-encoded Cyrillic, commit d8bcada) survived 515 unit tests because no fixture was non-ASCII. · **Covered by:** **gap**

## 7. Security, privacy & 152-FZ consent

_Can a visitor-supplied path, a WordPress author's HTML, or one tier's own config make this app fetch, execute, frame, leak or purge something it was never meant to — and does anything reach a third party or collect an address before the visitor has consented?_

#### SEC-01 · P0 · infra — Prove the shipped container image carries no WordPress credential anywhere

- **Given** the image the `image` job of `.github/workflows/ci.yml` builds and pushes — `ghcr.io/obshee-delo-it/od-frontend:stage` — which receives `WP_USER` and `WP_PASSWORD` as build-args (`.github/workflows/ci.yml:106-107` → `Dockerfile:56-59`). Two needles: the plaintext application password, and `base64("$WP_USER:$WP_PASSWORD")`, which is the form `src/shared/api/httpClient.ts:20` actually stores.
- **When** you inspect the final image's config env, its filesystem and its layer history for both needles: `docker image inspect --format '{{json .Config.Env}}'`; `ls -la /app/.env /app/.env.*` inside the container; `grep -rlF` for each needle over `/app`; `docker history --no-trunc`.
- **Then** `.Config.Env` contains only `PATH`, `PNPM_HOME`, `HOSTNAME` (plus `NODE_ENV`/`PORT`) and no `WP_*` key. `/app/.env` and `/app/.env.*` do not exist (`No such file or directory`). `grep -rlF` returns 0 files for both needles. No `docker history` line contains either needle.
- **Verify:** `docker pull ghcr.io/obshee-delo-it/od-frontend:stage && docker image inspect ghcr.io/obshee-delo-it/od-frontend:stage --format '{{json .Config.Env}}' && docker run --rm --entrypoint sh ghcr.io/obshee-delo-it/od-frontend:stage -c 'ls -la /app/.env /app/.env.* 2>&1; grep -rlF "<needle>" /app | head'`
- **Why:** `Dockerfile:53-55` states the credentials "are safe here and only here … nothing from `builder` reaches `runner`", but `pnpm build` writes a copy of `.env` into the standalone output — measured in this repo today, `grep -rlF "$WP_PASSWORD" .next` returns exactly one file, `.next/standalone/.env` — and `Dockerfile:71-73` does `COPY --from=builder /app/.next/standalone ./`. The only thing keeping the WP application password out of a published GHCR layer is the `.env` / `.env.*` pair in `.dockerignore`, whose own comment says why. Deleting either line bakes the credential into the image with every gate still green. · **Covered by:** **gap**

#### SEC-02 · P0 · build — Grep the production build for the WP password and for its Basic-auth base64

- **Given** a clean production build made with real credentials: `rm -rf .next && pnpm build` with `.env` (or `.env.stage`) present. Two needles, as in SEC-01 — the plaintext `WP_PASSWORD` and `base64("$WP_USER:$WP_PASSWORD")`.
- **When** you grep `.next/static`, `.next/server` and every prerendered `*.html` under `.next/server/app` for both needles, then grep the whole of `.next` and account for every hit.
- **Then** 0 matching files under `.next/static`, 0 under `.next/server`, 0 in any prerendered HTML. The only permitted hit anywhere in `.next` is `.next/standalone/.env`, which `.dockerignore` keeps out of the image (SEC-01). Any other hit fails the build gate.
- **Verify:** `node --env-file=.env -e 'const b=Buffer.from(`${process.env.WP_USER}:${process.env.WP_PASSWORD}`).toString("base64");console.log(b);console.log(process.env.WP_PASSWORD)' > /tmp/n && grep -rlFf /tmp/n .next/static .next/server; grep -rlFf /tmp/n .next; rm /tmp/n`
- **Why:** `src/shared/api/httpClient.ts:4-20` reads the three vars at module load and keeps `'Basic ' + btoa(user:password)` in module scope, so the plaintext password never appears in the header — a grep for the password alone would pass while the base64 leaked. Nothing imports `shared/api` from a `'use client'` file today (checked across every `'use client'` file), and the repo installs no `server-only` guard to keep it that way, so this grep is the whole standing gate. Measured 2026-08-22: 0 hits in `static`/`server`, 1 in `.next/standalone/.env`. · **Covered by:** **gap**

#### SEC-03 · P0 · php — Close the four unauthenticated PHP entry points before the DNS moves

- **Given** the cutover target install (and every clone taken from prod) while `wp-content/plugins/cmsms-content-composer/` is still on disk. Three of its files bootstrap WordPress from `$_SERVER['SCRIPT_FILENAME']` and read `$_POST` with no nonce and no capability check.
- **When** you request each of the four paths unauthenticated, on prod today and again on the cutover install after `docs/prod-migration-runbook.md` §2.6's deactivate-delete-flush step has removed the directory: `/wp-content/plugins/cmsms-content-composer/framework/inc/cmsms-composer-templates-operator.php`, `/wp-content/plugins/cmsms-content-composer/inc/project/projects-loader.php`, `/wp-content/plugins/cmsms-content-composer/inc/post/posts-loader.php`, `/wp-content/plugins/wp-optimize/vendor/mrclay/minify/server-info.php`.
- **Then** all four answer **404**. Deactivating the plugin is not enough — measured on od-dev, all three kept answering 200 until the directory was deleted, and 404 immediately after. A 200 on any of the four blocks cutover.
- **Verify:** `for p in /wp-content/plugins/cmsms-content-composer/framework/inc/cmsms-composer-templates-operator.php /wp-content/plugins/cmsms-content-composer/inc/project/projects-loader.php /wp-content/plugins/cmsms-content-composer/inc/post/posts-loader.php /wp-content/plugins/wp-optimize/vendor/mrclay/minify/server-info.php; do echo -n "$p "; curl -s -o /dev/null -w '%{http_code}\n' "https://obshee-delo.ru$p"; done`
- **Why:** `docs/next-steps.md` §«Three unauthenticated PHP entry points are live on production» (found 2026-08-18): all three answered 200 on `https://obshee-delo.ru/` and the fourth was recorded as unchecked. It is live exposure on the public site today, and the only closing action — deleting the directory — is `docs/prod-migration-runbook.md` §2.6 step 4 (`next-steps.md` still calls it step 3), i.e. a cutover step that nothing verifies afterwards. · **Covered by:** **gap**

#### SEC-04 · P0 · manual — Prove REVALIDATE_SECRET is per tier and one tier cannot purge another's cache

- **Given** two tiers: od-stage (frontend `https://new.obshee-delo.ru`, WP `od.webtm.ru`) where `REVALIDATE_SECRET` is deliberately **unset**, and the cutover install where `OD_REVALIDATE_SECRET` is defined in `mu-plugins/od-revalidate/config.php`.
- **When** you POST `/api/revalidate/` **with the trailing slash** on each tier: with no header, with the other tier's secret, and with the tier's own; then compare the two halves of each pair by sha256 digest — never by value.
- **Then** stage answers **503** with body `{"error":"REVALIDATE_SECRET is not configured on this deployment"}`. A tier holding a secret answers **401** `{"error":"unauthorized"}` for the other tier's secret and **200** with a `revalidated` object for its own. The WP-side digest equals the frontend-side digest **within** a tier and differs **across** tiers.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' -d '{"postId":71933}' https://new.obshee-delo.ru/api/revalidate/` (expect 503); then runbook §4.8: `ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval "echo hash(\"sha256\", OD_REVALIDATE_SECRET);"'` and `node --env-file=.env -e "console.log(require('node:crypto').createHash('sha256').update(process.env.REVALIDATE_SECRET).digest('hex'))"`
- **Why:** `src/app/api/revalidate/route.ts:86-96` reads the secret per request and 503s when unset (the safe default); `docs/prod-migration-runbook.md` §4.8 spells out «One WP install can only notify one frontend» and «prod's on stage is access to prod's cache», and §4.1's `REVALIDATE_SECRET` row says to generate a fresh one per tier. `docs/implementation-notes.md` §A3b records stage's as deliberately unset. `route.test.ts` covers the 503 and the 401 as unit cases; nothing checks the deployed pairing, which is where a shared secret actually happens. · **Covered by:** **gap**

#### SEC-05 · P1 · unit — Refuse a script element authored inside WordPress post or page content

- **Given** a WP body containing a script element — an editor is a semi-trusted author, and `src/shared/lib/wpContent/parsePost.tsx:122-179` runs `html-react-parser` with no sanitiser: its `replace` callback special-cases only `Comment` nodes (lines 127-129) and returns every other node unchanged.
- **When** you render `parsePost('<p>a</p><script>window.__x=1</script>')` and serialise it with `renderToStaticMarkup`; then load a real post that carries one, e.g. `/72897/`, and check whether the script ran.
- **Then** no `<script>` (and no `<style>`) element appears in the serialised output. Measured today the output is `<p>a</p><script>window.__x=1</script>` — verbatim — so on a server-rendered page the browser parses and **executes** it. The scenario fails until `parsePost` drops script/style elements the way it already drops comments.
- **Verify:** add the case to `src/shared/lib/wpContent/parsePost.test.tsx` and run `pnpm test src/shared/lib/wpContent/parsePost`; read `src/shared/lib/wpContent/parsePost.tsx:126-179`.
- **Why:** the legacy proxy strips scripts by name (`transformLegacyHtml.ts:160-174` removes only `mc.yandex.ru` / `ym(` blocks), so the _native_ WP-content path — 153 of 168 published pages plus every post — has no equivalent guard. `parsePost.test.tsx` contains no case with `script`, `onclick`, `onerror` or `javascript:` in it. · **Covered by:** **gap**

#### SEC-06 · P1 · unit — Pin what parsePost drops: on\* handlers, javascript: hrefs, data: hrefs

- **Given** the same WP-content path, with the three attribute-level vectors an editor can write: `<a href="javascript:alert(1)" onclick="alert(2)">`, `<img src="x.png" onerror="alert(4)">`, `<a href="data:text/html,x">`.
- **When** you render each through `parsePost` and serialise with `renderToStaticMarkup`.
- **Then** no `onclick` / `onerror` attribute survives (html-react-parser does not map DOM-string handlers onto React props). The `javascript:` href is replaced by React 19's sentinel — literally `href="javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"`. The `data:text/html` href is currently **preserved** verbatim; record it and decide, because it is the one of the three that no layer neutralises.
- **Verify:** add the three cases to `src/shared/lib/wpContent/parsePost.test.tsx` and run `pnpm test src/shared/lib/wpContent/parsePost`.
- **Why:** these are the guarantees SEC-05's fix must not accidentally remove, and two of the three come from a dependency (React 19, html-react-parser) rather than from this repo — so a major-version bump can retract them with nothing failing. Measured 2026-08-22 against the current lockfile; `parsePost.test.tsx` asserts none of it. · **Covered by:** **gap**

#### SEC-07 · P1 · unit — Stop a rewritten legacy href from breaking out of a single-quoted attribute

- **Given** a legacy page whose anchor is written with single quotes and an entity-escaped apostrophe — `<a href='/te&#39;st/'>x</a>` — which `findAttribute` (`src/shared/legacy/html.ts:182-206`) reads and **decodes** (line 204) before `rewriteAnchors` splices the rewritten value back between the original quote characters (`transformLegacyHtml.ts:277-281`).
- **When** you run `transformLegacyHtml(html, { origin: 'https://legacy.example', path: '/team/', siteOrigin: 'https://site.example' })` over that anchor, and over the double-quoted, unquoted, backtick and space variants.
- **Then** every output anchor is one well-formed attribute. Measured today the single-quoted case emits `<a href='https://site.example/te'st/'>x</a>` — the apostrophe closes the attribute, so a browser reads `href="https://site.example/te"` plus a bogus `st/'` attribute, turning an author-controlled path into attribute injection. Fails until `encodeAttributeValue` escapes `'` as well.
- **Verify:** add the case to `src/shared/legacy/transformLegacyHtml.test.ts` beside line 418 and run `pnpm test src/shared/legacy/transformLegacyHtml`; read `src/shared/legacy/html.ts:29-30`.
- **Why:** `encodeAttributeValue` (`html.ts:29-30`) escapes only `&`, `<`, `>` and `"` — no `'` — while `findAttribute`'s own pattern explicitly accepts `'…'` values and `transformLegacyHtml.test.ts:418` ("recognises single-quoted, unquoted and space-padded hrefs") asserts those are rewritten. The two facts together are the bug, and the backtick/space variants show the escape _is_ otherwise doing its job (`%60`, `%20`), which is what makes the gap invisible. · **Covered by:** **gap**

#### SEC-08 · P1 · manual — Answer 405 to a non-GET on /legacy/\* without making any upstream request

- **Given** a running server with `WP_LEGACY_BASE` set. `src/app/legacy/[...slug]/route.ts` exports **only** `GET` (lines 45-65), so every other method is Next's own dispatch.
- **When** you send POST, PUT, DELETE and OPTIONS to `/legacy/team/`, with and without a body, and watch both the response and the upstream (`[legacy]` log lines / the legacy origin's access log).
- **Then** each non-GET answers **405** and carries `allow: GET` (plus `HEAD`); the response body is empty; and no `[legacy] upstream …` line appears and no request reaches the legacy origin. HEAD answers 200 with the same headers as GET and no body.
- **Verify:** `curl -s -D- -o /dev/null -X POST http://localhost:3000/legacy/team/ | head -3; curl -s -D- -o /dev/null -X PUT http://localhost:3000/legacy/team/ | head -1`
- **Why:** `openspec/changes/fallback/verification-plan.md` V9 (line 25) lists «non-GET» as an asserted scenario in `route.test.ts` — and that 128-line file only ever calls the exported `GET` (`route.test.ts:13-14`), so the method dispatch is claimed and untested. This route is the app's only outbound-fetch surface driven by a visitor-supplied path, i.e. the one place an open-proxy mistake would live. · **Covered by:** **gap**

#### SEC-09 · P1 · manual — Keep the /legacy-font/ relay read-only and strip cookies from what it forwards

- **Given** a dev server with `WP_LEGACY_BASE` pointed at a local echo server that prints the method, path and every header it receives. `src/proxy.ts:31-34` **rewrites** (i.e. proxies) any matching request to that origin, and `src/shared/legacy/legacyFonts.ts:71-79` constrains only the _path_.
- **When** you send: (a) `GET /legacy-font/fonts/MyriadPro-Cond.woff`; (b) the same as POST with a body, `Cookie: probe=1` and `Authorization: Basic zzz`; (c) `GET /legacy-font/../../wp-config.php.woff`; (d) `GET /legacy-font/css/fonts/fontello.js`; (e) `GET /legacy-font/f%2e%2e/x.woff`.
- **Then** (a) reaches the echo server as `GET /wp-content/themes/welfare/fonts/MyriadPro-Cond.woff`. (b) must not arrive carrying `cookie` or `authorization`, and non-GET/HEAD must not be relayed at all. (c), (d) and (e) answer **404** from our own origin with **zero** lines in the echo server's log.
- **Verify:** `node -e 'require("node:http").createServer((q,s)=>{console.log(q.method,q.url,JSON.stringify(q.headers));s.end("")}).listen(4010)' &` then `WP_LEGACY_BASE=http://localhost:4010 pnpm dev`, and curl the five URLs against `localhost:3000`
- **Why:** `loadLegacyDocument.ts:176-181` constructs its outbound headers precisely so «no cookie and no `Authorization` goes out» — the font relay is the _second_ egress path to the same foreign origin and gets none of that treatment, because a middleware rewrite forwards the inbound request. `legacyFonts.test.ts` covers `legacyFontTarget` as a pure function (5 cases) and nothing covers what the rewrite actually sends. `src/proxy.ts:51`'s matcher includes `/legacy-font/:path*` for every method. · **Covered by:** **gap**

#### SEC-10 · P1 · manual — Give public pages a framing policy, not just the /legacy/\* document

- **Given** the deployed stage tier. `src/app/legacy/[...slug]/route.ts:34` sets `content-security-policy: frame-ancestors 'self'` on the **inner** proxy document only; `next.config.ts` has no `headers()` block at all (the only CSP string anywhere in `src/` is that one line).
- **When** you request the page a visitor actually reaches — a LegacyEmbed page (`/actual/`, `/get-involved/`, `/добровольчество/`), a film page (`/71933/`) and the home page — and read the response headers.
- **Then** each carries either `x-frame-options: SAMEORIGIN`/`DENY` or a `content-security-policy` naming `frame-ancestors 'self'`. Measured today: neither header is present on any public route, so any origin can frame the whole site and overlay the embedded legacy page — while the inner `/legacy/actual/` document is protected.
- **Verify:** `for u in / /actual/ /71933/ /legacy/actual/; do echo "== $u"; curl -sI "https://new.obshee-delo.ru$u" | grep -iE 'content-security-policy|x-frame-options'; done`
- **Why:** the `/legacy/*` CSP exists so the chromeless fragment is framed by us only (`route.ts:30-34`), but the address that ranks and that visitors open is the parent page, and it declares nothing. A clickjacking overlay on `/actual/` reaches the CF7 form the page exists to keep working, and the site's own «Оказать помощь» CTAs sit on every route. · **Covered by:** **gap**

#### SEC-11 · P1 · manual — Make no third-party request on a film page before a 152-FZ consent exists

- **Given** a film page carrying a Kinescope id — `/71933/` embeds `kinescope.io/embed/q2ufLsHSSxyYp6teUUke92`, `/19123/` embeds `sNgGnFgYFfAKo7nF3NX5RT`, and 74 catalogue films have one (measured as 74 of 85; the catalogue is 83 since «Видео события» was untagged). No consent banner is shipped: A4/F6 are still open in `docs/implementation-plan.md`.
- **When** you open the page in a clean browser profile with the network panel recording, and list the distinct request hosts.
- **Then** the only hosts requested are this deployment's own origin and the media bucket `obshee-delo.website.yandexcloud.net`. Measured today `kinescope.io` is requested unconditionally by `src/modules/Video/FilmPlayer/FilmPlayer.tsx:32-38`, before any consent and with `allow="autoplay; … encrypted-media; …"` granted to that frame — so the scenario fails until the player is click-to-load or consent-gated.
- **Verify:** open `https://new.obshee-delo.ru/71933/` with DevTools → Network, sort by Domain; and read `src/modules/Video/FilmPlayer/FilmPlayer.tsx:34`
- **Why:** `docs/implementation-plan.md` A4 requires Metrica (counter `34478865`) to sit behind a 152-FZ consent banner and says «the legacy site already shows one, so the app must not ship without it»; §15.2 of the published policy claims the Operator asks for consent, which prod's own banner («Этот сайт использует cookie для хранения данных…») was switched on to make true (notes §F6). Shipping a third-party player that loads before consent re-falsifies the same sentence, and the film pages are the #2/#3 entry surfaces. · **Covered by:** **gap**

#### SEC-12 · P1 · e2e — Verify the newsletter form is absent from all five surfaces while the flag is off

- **Given** `NEWSLETTER_SIGNUP_ENABLED = false` (`src/shared/config/features.ts:19`), gated in one place (`NewsletterSignup.tsx:89-90`) for five call sites: `/` (`app/page.tsx:84`), `/news/` (`news/page.tsx:119`), `/materials/articles/` (`articles/page.tsx:68`), `/video/` and each `/video/<segment>/` (`VideoCatalogue.tsx:167`), and the article sidebar (`NewsArticle.tsx:150`).
- **When** you fetch all five rendered surfaces and count «Подписаться», «Подписаться на новости», `placeholder="Адрес электронной почты"` and `<form`.
- **Then** zero occurrences of each on all five. And `pnpm test:e2e` must be run: `e2e/home.spec.ts:21` asserts the heading «Подписаться на новости» is _visible_ and `e2e/home.spec.ts:33-43` drives the form to an enabled submit — both contradict the shipped flag and are failing today, unnoticed because e2e is not in CI.
- **Verify:** `for u in / /news/ /video/ /materials/articles/ /72897/; do echo -n "$u "; curl -s "https://new.obshee-delo.ru$u" | grep -c 'Адрес электронной почты'; done` (expect 0 each); then `pnpm test:e2e -- home`
- **Why:** risk register NEWSLETTER-DEAD-FORM: «Nothing asserts the flag's off-state hides the section everywhere it is rendered». The submit handler does nothing (`NewsletterSignup.tsx:40-43`, issue #54), so a rendered form collects an email address with no processor and no purpose — personal data under 152-FZ, which is exactly why `features.ts:6-18` gates it rather than shipping it. · **Covered by:** `src/modules/NewsletterSignup/NewsletterSignup.test.tsx`

#### SEC-13 · P1 · manual — Keep images.remotePatterns a four-host allowlist, not an open image proxy

- **Given** `next.config.ts:54-71` — four entries, each built as `new URL('/**', <origin>)`: the `WP_BASE` origin, the Punycode legacy domain `https://xn----9sbkcac6brh7h.xn--p1ai`, the media CDN from `mediaCdn.ts:11-12`, and `https://kinescope.io`. Evaluated at **build** time.
- **When** you ask the deployed optimizer for a foreign host and for one URL on each allowlisted host, then print the patterns the build actually compiled.
- **Then** `/_next/image?url=https%3A%2F%2Fevil.example%2Fa.jpg&w=640&q=75` → **400**. Each allowlisted origin → **200**. The compiled `remotePatterns` array has exactly four entries and no `*` inside any `hostname`.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}\n' 'https://new.obshee-delo.ru/_next/image?url=https%3A%2F%2Fevil.example%2Fa.jpg&w=640&q=75'; node -e "import('./next.config.ts').then(m=>console.log(JSON.stringify(m.default.images.remotePatterns,null,1)))"`
- **Why:** `new URL('/**', origin)` pins scheme, host and port and widens only the path, which is what keeps the optimizer from fetching arbitrary hosts on request. The shape people reach for when a bucket moves — a hand-written `{ hostname: '**.yandexcloud.net' }` — opens every bucket on that provider. Two silent widenings/narrowings already exist by construction: an unset `WP_BASE` allowlists `https://wp.invalid` and `WP_MEDIA_CDN=""` drops an entry (`mediaCdn.ts:11-12`), both build-time and invisible at runtime. `mediaCdn.test.ts`/`mediaUrl.test.ts` cover the resolvers, never the allowlist. · **Covered by:** **gap**

#### SEC-14 · P1 · manual — Keep WP_LEGACY_BASE off our own origin and off live production

- **Given** a deployed tier with the fallback on. Two failure modes: (a) `WP_LEGACY_BASE` equals this deployment's own origin, so the app proxies itself; (b) the frozen copy was cloned without the domain search-replace, so its HTML still emits `obshee-delo.ru` links, which `transformLegacyHtml.ts:248` compares **by host** and therefore leaves alone.
- **When** you read the container's boot log for `[legacy]` lines; then fetch `/legacy/team/` and tabulate the host of every absolute `href` in the served document.
- **Then** the boot log contains no `[legacy] WP_LEGACY_BASE is the site's own origin` line. Every absolute `href` host is this deployment's own, except paths under `/wp-content|/wp-includes|/wp-json`. Against a frozen copy missing the search-replace, 32 of `/team/`'s 80 anchors point at live production instead — on stage that sends visitors off the tier entirely.
- **Verify:** `docker logs <od-frontend-stage container> 2>&1 | grep '\[legacy\]'; curl -s https://new.obshee-delo.ru/legacy/team/ | grep -oE 'href="https?://[^"/]+' | sort | uniq -c | sort -rn`
- **Why:** `src/shared/legacy/legacyOrigin.ts:37-51` warns and deliberately does **not** refuse, because the two match harmlessly in local dev — so the misconfiguration ships at 200. `docs/prod-migration-runbook.md` §4.1's `WP_LEGACY_BASE` row spells out both halves, and `docs/implementation-plan.md` A6 adds that `pnpm legacy:sweep` «will _not_ catch it — its link check only asks whether a link is still on the legacy origin». `legacyOrigin.test.ts` asserts the warn fires; nothing asserts the served document. · **Covered by:** **gap**

#### SEC-15 · P2 · manual — Resolve the consent link before the newsletter flag is ever flipped

- **Given** `src/modules/NewsletterSignup/NewsletterSignup.tsx:13` sets `PERSONAL_DATA_LINK = '/personal-data'` — no trailing slash — reached from the checkbox label «Я согласен на обработку персональных данных» (lines 67-74).
- **When** you request `/personal-data` and `/personal-data/` on the deployed tier, and grep the published legal page set.
- **Then** `/personal-data` answers **301/308** to `/personal-data/`, and `/personal-data/` answers **200** rendering the personal-data text. Today the published legal set is `/conf_politics/`, `/rekvizit/`, `/personal-data-usage-terms/`, `/donation-service-terms/`, `/paypal/`, `/sms/`, `/thank-you-for-your-donation/`, `/sorry-donation-failure/` — there is no `/personal-data/`, so the link falls to the A6 iframe and 404s wherever the frozen copy has no such page.
- **Verify:** `curl -sI https://new.obshee-delo.ru/personal-data/ | head -1; curl -sI https://new.obshee-delo.ru/personal-data | head -2; grep -n 'legal / donation' docs/page-inventory.md`
- **Why:** the checkbox is the 152-FZ artefact — `docs/implementation-plan.md` F6 records that the wording lives in policy §8.2 («Заполняя соответствующие формы … Пользователь выражает свое согласие с данной Политикой»), and a consent whose link 404s is a consent the visitor cannot read. P2 only because `NEWSLETTER_SIGNUP_ENABLED = false` hides the link today; it becomes a launch blocker the moment SEC-12's flag flips. · **Covered by:** **gap**

#### SEC-16 · P2 · unit — Confine a leaked revalidate secret to the wp:\* tag namespace and the item caps

- **Given** a tier with `REVALIDATE_SECRET` set and a caller holding it — i.e. the blast radius of a leaked secret.
- **When** you POST bodies: `{"tags":["_N_T_/layout"]}`, `{"tags":["wp"]}`, 50 ids, 51 ids, `{"paths":["../x"]}`, `{}`.
- **Then** `_N_T_/layout` → **400** `{"error":"only wp* tags may be revalidated","rejected":["_N_T_/layout"]}`. `["wp"]` → 200. 50 ids → 200 (expanding to 51 tags, which is deliberately over the cap). 51 ids → 400 `at most 50 post ids, 50 tags and 50 paths per request`. `../x` → 400 `paths must be absolute route paths beginning with /`. `{}` → 400 `nothing to revalidate — pass postId, postIds, tags or paths`.
- **Verify:** `pnpm test src/app/api/revalidate`
- **Why:** `src/app/api/revalidate/route.ts:142-153` states the reason in the code: Next's implicit route tags (`_N_T_/…`) are addressable through the same API, «and accepting them would turn a leaked secret into a purge of the entire render cache». The 50-vs-51 pair is the deliberate off-by-one at lines 125-130 — the cap bounds the _inputs_, not the tag set they expand into. · **Covered by:** `src/app/api/revalidate/route.test.ts`

#### GAP-01 · P0 · php — Refuse a Subscriber's POST to the migrator's eight admin-ajax actions

- **Given** `wp/plugins/cmsms-gutenberg-upgrade/` is active on od-stage and is activated on production during cutover. It registers eight `wp_ajax_` actions (`cmsms-gutenberg-upgrade.php:82, 126, 168, 191, 241, 281, 1005, 1291`). `admin-ajax.php` never goes through the `manage_options` gate on `add_menu_page`, so before commit `ee4fb31` any authenticated user down to a Subscriber could reach all eight; `get_posts_pages()` additionally concatenated `$_POST['tag']` into a LIKE clause and wrapped the finished string in `$wpdb->prepare()`, which escapes arguments and not SQL text already in the query.
- **When** you log in as a Subscriber (`wp user create probe probe@example.test --role=subscriber`) and POST each of the eight actions to `/wp-admin/admin-ajax.php` — with no `_wpnonce`, then with a nonce minted for another action. Include `action=transform_gutenberg_cmsms` (the unbounded `UPDATE wp_posts JOIN wp_postmeta`), `action=get_cmsms_gutenberg&id=<a draft id>`, and `action=get_posts_pages&tag=%25%27+OR+1%3D1+--+`.
- **Then** every one of the eight answers **-1 or 403** and writes nothing: `wp post get <id> --field=post_content | md5sum` is unchanged across the whole run, and the draft's body never appears in a response body. The injection probe returns the empty/unfiltered list rather than every row, and `SAVEQUERIES` shows the `LIKE` argument arriving as a bound parameter with the `%` and the quote escaped. Re-run as an Administrator without a nonce: also refused — the capability check alone is not the fix.
- **Verify:** `php -l wp/plugins/cmsms-gutenberg-upgrade/cmsms-gutenberg-upgrade.php && php wp/tests/cmsms-upgrade.test.php`, then the eight curl POSTs against od-stage with a Subscriber cookie jar
- **Why:** fixed in `ee4fb31` («the plugin is active on od-stage and is activated on production during cutover, so the hole is live, not theoretical»), which added `nv_gu_check_ajax_access()` at `cmsms-gutenberg-upgrade.php:74` and a fifth PHP suite. SEC-03 closes the _file-level_ entry points of the other plugin — three PHP files reachable by URL — and stops there; admin-ajax is a different surface and the one this repo owns and maintains. WP-09 and WP-14 exercise the migrator only through its WP-CLI commands, which never touch the AJAX handlers. · **Covered by:** `wp/tests/cmsms-upgrade.test.php`

## 8. Performance & media delivery

_For every byte and millisecond the visitor actually pays for — the LCP image, the CDN probe, the Swiper hydration, the framed legacy document — is the cost bounded, measured against a number, and measured in a production build rather than `next dev`?_

#### PERF-01 · P0 · manual — Hold each top-traffic route to the measured Web Vitals and transfer budget

- **Given** od-stage frontend at https://new.obshee-delo.ru, built by the CI image job (five build-args set), warm ISR. The four routes are `/`, `/video/`, `/video/filmy/` and one film at `/<id>/` — `/video/` and `/video/<segment>/` are the #2 and #3 entry pages on the site.
- **When** Run Lighthouse mobile (390×844, 4× CPU throttle) against each of the four URLs on a build served by `pnpm start` (or the deployed container) — never `next dev` — and record LCP, CLS, TBT, TTFB, and the transferred JS/CSS/document bytes.
- **Then** Every route: LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms, TTFB ≤ 600 ms on a response carrying `x-nextjs-cache: HIT`. Transfer, against the 2026-08-22 measurement of `/`: JS ≤ 260 KB gzip over ≤ 15 chunks (measured 828 109 B raw / 256 887 B gzip / 14 chunks), CSS ≤ 120 KB gzip (917 570 B raw / 117 371 B gzip / 7 files), document ≤ 220 KB gzip (696 395 B raw / 216 058 B gzip). Any route over any one line is a fail, recorded with its own number rather than a verdict.
- **Verify:** `pnpm build && SITE_URL=http://localhost:3100 pnpm start -p 3100`, then Lighthouse each URL; re-derive the byte lines with `grep -o 'src="/_next/static/chunks/[^"]*\.js"' .next/server/app/index.html | sed 's/src="//;s/"//;s#^/_next#.next#' | sort -u | xargs du -cb | tail -1` (and the same with `href`/`.css`).
- **Why:** `docs/implementation-plan.md:166` still has F3 open — «Targets (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1) wired to CI as a gate» — and `docs/prod-migration-runbook.md` §5's sixteen gates contain no performance gate at all. `next dev` is explicitly untrustworthy for anything cascade- or bundle-shaped (CLAUDE.md styling, `docs/implementation-notes.md` §C12: 24px in `next start` against 48px in `next dev`). · **Covered by:** **gap**

#### PERF-02 · P0 · build — Emit exactly one eager fetchPriority=high image per main body, none in the footer

- **Given** A production build. `WpPage.tsx:85`, `NewsArticle.tsx:85` and `FilmPage.tsx:87` call `resolveContentHtml(html, true)`; `Footer.tsx:27` and `app/profile/[slug]/page.tsx:79` deliberately do not.
- **When** Read the prerendered HTML for a news article, then curl a WP page and a profile page from od-stage, counting `loading="eager"`, `fetchPriority="high"` and `loading="lazy"` in each.
- **Then** A news article and a WP page each carry exactly one `loading="eager"` with `fetchPriority="high"` (camelCase — the lowercase spelling is rejected by React 19, commit 37257d7) and every other body `<img>` is `lazy`. Measured 2026-08-22 on the committed build: `.next/server/app/47856.html` has 36 `<img>`, 1 eager, 2 `fetchpriority="high"`. The footer's widget images and the profile body carry zero eager images. Two eager images in one body, or zero, is the fail.
- **Verify:** `for pg in 47856 56321 63287; do echo "$pg imgs=$(grep -o '<img' .next/server/app/$pg.html|wc -l) eager=$(grep -o 'loading=\"eager\"' .next/server/app/$pg.html|wc -l)"; done` — then `curl -s https://new.obshee-delo.ru/materials/metodichki/ | grep -c 'loading="eager"'`.
- **Why:** `src/shared/lib/wpContent/resolveContentAssets.ts:111-124` is the only place the LCP element is chosen, and the choice is a single boolean argument at five call sites. `resolveContentAssets.test.ts` covers the transform against fixtures; nothing checks that the five callers pass the flag the way their surface needs, and a new surface gets it wrong silently (`docs/next-steps.md` «The first cover was lazy-loaded»). · **Covered by:** **gap**

#### PERF-03 · P0 · manual — Prioritise the first film poster on /video/ and /video/filmy/

- **Given** od-stage. `/video/` renders ten `VideoCard`s (`VideoCatalogue.tsx:18`, PER_PAGE = 10), each poster a `next/image` with `fill` and `sizes="(max-width: 900px) 100vw, 368px"` and no `priority`. These two URLs are the #2 and #3 entry pages on the site.
- **When** Load /video/ and /video/filmy/ at 390×844 with 4× CPU and Slow 4G throttling; read Lighthouse's «Largest Contentful Paint element» and the `loading` attribute of the first card poster.
- **Then** The LCP element is the first card poster and it carries `loading="eager"` with `fetchPriority="high"`. Today it does not: `curl -s https://new.obshee-delo.ru/video/ | grep -o 'loading="[a-z]*"' | sort | uniq -c` reports every poster `lazy` and `grep -ci 'fetchpriority="high"'` reports 0 — that is the fail, and it costs the two highest-traffic index pages one round trip past the preload scanner.
- **Verify:** `curl -s https://new.obshee-delo.ru/video/ | grep -o 'loading="[a-z]*"' | sort | uniq -c`; then Lighthouse mobile on the same URL and read the LCP element row.
- **Why:** `src/modules/Video/VideoCard/VideoCard.tsx:49` renders the poster with no `priority`, while `src/modules/Video/FilmPlayer/FilmPlayer.tsx:44` shows the project's own convention for a hero image (`priority`). Runbook §5 gates 1-2 check this page's card _count_ and 200 status; nothing checks what it paints first. `docs/implementation-notes.md:255` records the same class already known and deferred («the header logo is `loading="lazy"` on an above-the-fold element … the change belongs with a look at LCP»). · **Covered by:** **gap**

#### PERF-04 · P1 · unit — Probe the media CDN once per URL per hour and give up after 3 s

- **Given** `resolveMediaUrl`'s memoised existence probe: `CDN_PROBE_TTL_MS = 60 * 60 * 1000` and a module-level `Map` (`mediaUrl.ts:23-24`), each probe a `HEAD` with `redirect: 'manual'` and `AbortSignal.timeout(3000)` (`mediaUrl.ts:40`).
- **When** Resolve the same bucket URL twice inside the TTL with a counting `fetch` stub; then resolve a third URL with a stub that never settles; then advance a fake clock past 3 600 000 ms and resolve the first URL again.
- **Then** Two resolves inside the window = exactly **one** `fetch` call. The never-settling probe resolves to the WP-origin URL within ~3 s (fake timers: aborts at 3 000 ms, does not hang) and that `ok:false` verdict is memoised, so a second resolve of it makes no second 3 s wait. After the clock passes the TTL the probe is made again. Duplicate invocation must not double the HEAD count; an expired entry must not be served.
- **Verify:** Add the cases to `src/shared/api/mediaUrl.test.ts` asserting the mock's `mock.calls.length`, then `pnpm test mediaUrl`.
- **Why:** `mediaUrl.test.ts:39-64` covers the 200 / 301 / error mapping and nothing else — not the memoisation, not the abort. Both are load-bearing: `docs/wp-backend.md` §6.4 measures the WP origin at ~1.3 s through its 301 against the bucket's ~0.8 s direct, so an un-memoised probe adds one HEAD per image per render, and an unbounded one turns a slow bucket into a slow page. · **Covered by:** **gap**

#### PERF-05 · P1 · manual — Bound the HEAD-probe burst a heavy WordPress body opens on a cold render

- **Given** `/materials/plakati/` on od-stage — the #6 entry page on the site, fifteen posters plus fifteen photos-in-use, each poster additionally linking a print master through `MEDIA_HREF` (`docs/implementation-notes.md:691`, `:719`). `resolveContentAssets.ts:82` sends every distinct source through `Promise.all` with no gate.
- **When** Request the page with a cold ISR entry, count the distinct bucket/origin URLs the served HTML carries (one HEAD probe each was made during that render), and time TTFB cold and warm.
- **Then** Concurrency stays at or below 4 — the number both `sitemap.ts:37` (`CONCURRENCY`) and `legacyStore.ts:101` (`LEGACY_CONCURRENCY_LIMIT`) chose for this same WP host — and the cold TTFB stays under 5 s. Record the probe count: `curl -s … | grep -oE '(yandexcloud\.net|od\.webtm\.ru)[^"]*' | sort -u | wc -l` is the number of sockets the render opened at once. A count above 40 with no gate is the finding, whatever the TTFB happened to be on the day.
- **Verify:** `curl -s -o /dev/null -w 'ttfb=%{time_starttransfer}\n' -D- https://new.obshee-delo.ru/materials/plakati/ | grep -i 'x-nextjs-cache'`; then the grep above on the same body.
- **Why:** Every other outbound fan-out in this repo is capped — `next.config.ts:74-80` caps the prerender at 4 because «od-dev WP … starts 503ing under the build's parallel prerender», `sitemap.ts:33-37` matches it, `legacyStore.ts` queues at 4 — and `resolveContentAssets` is the one that is not. It runs on the render path of every page body. · **Covered by:** **gap**

#### PERF-06 · P1 · manual — Stop a 2560px body original from reaching a 390px phone unresized

- **Given** A WordPress body reaches the browser as raw HTML: `src/shared/lib/wpContent/parsePost.tsx` has no `<img>` handling, so no body image goes through `next/image`. `imageUrl.ts` strips the `-WIDTHxHEIGHT` suffix to the full-size original (because the sized variants 500 on the bucket) and `resolveContentAssets.ts:103-104` strips `srcset` and `sizes`.
- **When** Load /materials/plakati/ and /about/ at 390×844 and record, for each body `<img>`: intrinsic width, rendered CSS width, transferred bytes.
- **Then** No body image transfers more than 300 KB, and none has an intrinsic width greater than 3× its rendered CSS width at 390 px. Today a body thumbnail stored as `-300x169` resolves to the un-suffixed original — up to WordPress's 2560px `-scaled` cap — with no `srcset` to fall back to, so the phone downloads the print-size file to paint a 320px box. Every violation is listed with its URL and byte count.
- **Verify:** DevTools Network on https://new.obshee-delo.ru/materials/plakati/ at 390px sorted by size; or `curl -sI` each src from `curl -s … | grep -o 'src="[^"]*uploads[^"]*"'` and read `content-length` against the element's rendered width.
- **Why:** `docs/wp-backend.md` §6.4 states the constraint that forces full-size («WordPress's resized variants … frequently 500 / 404 … never use a sized URL as-is») and `imageUrl.ts`'s own docstring promises «the Next image optimizer then downscales cleanly» — true for card thumbnails, which are `next/image`, and false for a body `<img>`, which is not. `docs/implementation-notes.md:719` shows the same asymmetry already bit once in the lightbox (187×207 served for a print poster). · **Covered by:** **gap**

#### PERF-07 · P1 · manual — Keep a nav prefetch from downloading another route's body images

- **Given** A production build with the header nav linking `/about/`, whose body WordPress returns with six `<img>` carrying no `loading` attribute at all (`docs/wp-backend.md:506`) — and an image without the attribute is eager, which puts a preload hint in the route's flight payload.
- **When** Load `/` on od-stage, let the App Router prefetch the nav links, and record every request whose **host** is the media bucket or `WP_BASE`; then count the `loading` attributes in the served `/about/` HTML.
- **Then** Zero requests for /about/'s partner logos and certificates while sitting on `/`. In the served /about/ HTML, `grep -c '<img'` equals the count of `<img` tags carrying a `loading=` attribute, and exactly one of them is `eager`. The 2026-08-21 regression was 7 cross-origin fetches per page view, the slowest 1.6 s, for images never displayed.
- **Verify:** `curl -s https://new.obshee-delo.ru/about/ | grep -o '<img[^>]*' | tee /tmp/imgs | grep -c 'loading=' ; wc -l < /tmp/imgs` — the two numbers must match. Then DevTools Network on `/`, filtered by the bucket host, with «Preserve log» on.
- **Why:** commit f6ef5e7 and `docs/wp-backend.md:506` measured it: «every page on the site fetched /about/'s seven partner logos and certificates straight from the bucket … Aborting /about/?\_rsc= alone took it to zero». `resolveContentAssets.test.ts:74` («lazy-loads an image WordPress left without a loading attribute») guards the transform against a fixture; nothing checks the attribute survives against real WordPress output, and the runbook's own §5.6 note warns that matching bucket traffic by URL substring instead of by host «roughly triples the count». · **Covered by:** **gap**

#### PERF-08 · P1 · build — Keep the 167 KB Gutenberg stylesheet off routes with no WordPress body

- **Given** `app/layout.tsx:18` imports `RadixProvider` from `@/shared/ui/theme`, and that barrel (`src/shared/ui/theme/index.ts:1-2`) also exports `GutenbergProvider`, which imports `gutenberg-provider.css` — five `@nested-import`s including `@wordpress/block-library`'s `style.css` and `theme.css`.
- **When** Build, then list the stylesheets the prerendered home page links and size each one.
- **Then** The home page — which renders no `.gutenberg` element anywhere — does not link the Gutenberg chunk. Measured 2026-08-22 it does: `/` links 7 stylesheets totalling 917 570 B raw / 117 371 B gzip, of which 167 472 B raw / 21 561 B gzip is the chunk whose first rule is `.gutenberg .wp-block-heading h1`. Pass = that file absent from `/`, `/video/` and `/news/`; the Radix chunk (678 979 B raw / 80 792 B gzip) stays, it is the design system.
- **Verify:** `grep -o 'href="/_next/static/chunks/[^"]*\.css"' .next/server/app/index.html | sed 's/href="//;s/"//;s#^/_next#.next#' | sort -u | xargs -I{} sh -c 'echo "$(stat -c%s {}) {}"; head -c 80 {}; echo'`
- **Why:** Render-blocking CSS on the busiest route, from an import that only needs `RadixProvider`. The barrel is the whole mechanism, and it is invisible in review: `src/shared/ui/theme/index.ts` is two lines and `layout.tsx`'s own comment block (lines 2-11) is about the _order_ of the Radix imports, not about what else the barrel drags in. Vitest bypasses the PostCSS pipeline entirely (`vitest.config.ts:40-41`), so no test can see a stylesheet graph. · **Covered by:** **gap**

#### PERF-09 · P1 · e2e — Hold the home carousels to CLS 0.1 across Swiper hydration at 390px

- **Given** The home page renders two `Carousel`s — the film row headed «Наши фильмы и мультфильмы» with its «Все видео (83)» CTA (`FilmsCarousel.tsx:25`, `:62`) and Directions. `Carousel.tsx:36-40` server-renders `swiper/react` with `slidesPerView={3}`, and `FilmsCarousel.tsx:30-35` supplies breakpoints `0: 1.1 / 900: 2 / 1280: 3` — the server cannot know the viewport, so the SSR markup lays slides out for 3-per-view and hydration re-lays them at 1.1 on a phone.
- **When** Load `/` in the mobile-390 Playwright project; measure the first `.swiper-slide`'s bounding box before hydration (`waitUntil: 'commit'`) and after (`networkidle`); separately read Lighthouse mobile's CLS attribution.
- **Then** CLS ≤ 0.1 for the page, and the first slide's width changes by no more than 8 px across hydration. The film-card box itself is protected — `FilmsCarousel.module.css:45` sets `aspect-ratio: 397 / 266` and `VideoCard.module.css:27` sets `368 / 207` — so any shift measured here comes from Swiper's own re-layout, not from image loading.
- **Verify:** `pnpm test:e2e` (needs a running server) with a new case in `e2e/home.spec.ts` using `page.locator('.swiper-slide').first().boundingBox()` before and after; plus Lighthouse mobile on https://new.obshee-delo.ru/ reading the CLS «Avoid large layout shifts» table.
- **Why:** `Carousel.test.tsx:46` stubs `swiper/react` wholesale — jsdom has no layout, so no unit test can observe a shift. This class has already produced three real defects in the sibling adapter (commit 72ad5cc: double mount, never destroyed, unreachable controls), each found in a browser. The home page also ships the Swiper chunk itself (91 444 B raw / 26 423 B gzip, measured 2026-08-22), which is the JS whose execution does the re-layout. · **Covered by:** **gap**

#### PERF-10 · P1 · manual — Separate a cold ISR miss from a warm hit by x-nextjs-cache and TTFB

- **Given** `revalidate = 3600` on `/` (`app/page.tsx:17`), `/news/`, `/video/`, `/video/[segment]/` and the catch-all; the ISR cache lives on the container filesystem (`output: 'standalone'`) on a persistent volume that outlives a deploy (commit fa3d244, `Dockerfile` lines 74-78).
- **When** curl the same URL twice in a row on od-stage, reading `x-nextjs-cache` and `time_starttransfer`; repeat on a route the deploy has never rendered.
- **Then** A MISS may cost up to ~4 s TTFB (od-dev WP answers ~1.5 s per request and a page makes several); the immediately following request is `x-nextjs-cache: HIT` with TTFB ≤ 600 ms. Two consecutive MISSes on the same URL, or a HIT whose TTFB is still above 600 ms, is the fail. Note for the tester: a HIT can be a _previous deployment's_ HIT — the volume survives redeploys, so «new code, old data» is the expected shape, not a bug in this scenario.
- **Verify:** `for i in 1 2; do curl -s -o /dev/null -D- -w 'ttfb=%{time_starttransfer}\n' https://new.obshee-delo.ru/video/ | grep -iE 'x-nextjs-cache|ttfb'; done`
- **Why:** This is the only signal that separates a real render cost from a cache read, and every other perf number in this lens is meaningless without it — the budget in PERF-01 is stated against a HIT. The volume behaviour is documented at `docs/prod-migration-runbook.md` §4.8 and was measured once: `/video/` served a post that had left the category while `/video/famous-people/` was correct. · **Covered by:** **gap**

#### PERF-11 · P1 · manual — Keep the Kinescope embed off the film page's critical path

- **Given** A film page whose post carries `kinescope_id` — 70 of 99 qualify on od-dev (runbook §5 gate 4). `FilmPlayer.tsx:32-38` renders it as a plain `<iframe src="https://kinescope.io/embed/…">` with no `loading` attribute, i.e. eager, unsandboxed, third-party. The alternative branch (`FilmPlayer.tsx:44`) renders the poster with `priority`.
- **When** Load a Kinescope film page (e.g. https://new.obshee-delo.ru/56321/ — confirm the iframe is present first) at 390×844 with 4× CPU throttling, then a poster-only film from runbook §5 gate 5.
- **Then** LCP ≤ 2.5 s on both. On the Kinescope page the LCP element is page text or chrome, never the un-painted frame, and Lighthouse's «Reduce the impact of third-party code» attributes ≤ 250 ms of main-thread blocking to kinescope.io. On the poster page the poster is the LCP element and carries `fetchPriority="high"` — `curl -s <url> | grep -c 'fetchpriority="high"'` ≥ 1.
- **Verify:** Lighthouse mobile on the two URLs; then `curl -s https://new.obshee-delo.ru/56321/ | grep -o '<iframe[^>]*kinescope[^>]*>'` to confirm which branch rendered.
- **Why:** `next.config.ts:61-65` allowlists `kinescope.io` for the _poster_ only and says so; the player itself is an iframe this repo does not control, on the surface that carries 46 % of site entries via `/<id>/`. `FilmPlayer.test.tsx` covers which branch renders, never what it costs, and no `loading="lazy"` decision has been recorded for the frame either way. · **Covered by:** **gap**

#### PERF-12 · P1 · unit — Bound the legacy store, its window and the slow-origin timeout

- **Given** `legacyStore.ts:40` capacity 64 against ~170 crawlable legacy slugs, `:43` TTL 3 600 000 ms matched to the catch-all's `revalidate`, `:101` concurrency 4 with `:104` a 4 000 ms queue budget, `loadLegacyDocument.ts:29` an 8 000 ms upstream timeout and `:49` a 5 MB body cap against a largest-measured legacy page of 128 KB.
- **When** Fill the store to capacity and one over; read an entry at its expiry boundary and one ms past; burst ten requests through a cap of four; point the loader at an origin that accepts and never answers; and feed it a body over the cap and a lying `content-length`.
- **Then** Capacity 65 evicts the oldest and `size()` stays 64; a rewritten key moves to the back; an expired entry is dropped, never served stale; ten concurrent requests all succeed with none refused; the never-answering origin aborts at 8 s and returns `unavailable`; an oversized body is refused without ever being fully buffered, and logs `[legacy] upstream oversized for <path>`.
- **Verify:** `pnpm test legacyStore loadLegacyDocument` — 15 + 30 cases; read `src/shared/legacy/legacyStore.test.ts:31-56` (capacity, eviction order) and `loadLegacyDocument.test.ts:258` (abort), `:376` onward (bounded reading).
- **Why:** This is the one bounded-resource story in the repo that is fully asserted, and it is the model the unbounded ones (PERF-04, PERF-05, PERF-14) are measured against. The bound also has a real failure mode behind it: `legacyStore.ts:181-183` records that the module is instantiated once per bundle — «measured, three copies of this module land in `.next/server`» — so two stores would mean twice the upstream load LCP-010 promises. · **Covered by:** `src/shared/legacy/legacyStore.test.ts` + `src/shared/legacy/loadLegacyDocument.test.ts`

#### PERF-13 · P2 · manual — Serve the legacy iframe's five theme fonts from this origin, cacheably

- **Given** The six paths still on the A6 iframe (`legacyEmbedPages.ts:79-84`: /about/ostavit-otziv/, /actual/, /get-involved/, /get-involved/join/, /materials/pppuiv-constructor/, /добровольчество/), carrying 0.5 % of entry visits and 1.6 % of pageviews (`docs/page-inventory.md` §1a). The framed document keeps all 26 live stylesheets and 46-58 script elements of the old theme; its five webfaces are relayed through `/legacy-font/` by `proxy.ts:31-34`.
- **When** Load https://new.obshee-delo.ru/actual/ at 390px with an empty cache, record every request grouped by host, then navigate to /get-involved/ in the same session and count new `/legacy-font/` requests.
- **Then** All five faces (`fontello.woff` + four `MyriadPro-*.woff`, `legacyFonts.ts:40-44`) come from this origin and none from the legacy one; each answers 200 with a `cache-control` that permits reuse, so the second framed page makes **0** new font requests. The shell's own CSS/JS is fetched once, not once per frame, and the combined shell + frame transfer stays under 2.5 MB.
- **Verify:** `curl -sI https://new.obshee-delo.ru/legacy-font/fonts/MyriadPro-Cond.woff | grep -iE 'HTTP/|cache-control|content-length'`; then DevTools Network across /actual/ → /get-involved/ filtered on 'legacy-font'.
- **Why:** `legacyFonts.ts:8` measured the failure this relay exists for («three requests, three net::ERR_FAILED»), and `e2e/legacy-embed.spec.ts:534` (V29) asserts the frame asks _us_ rather than the legacy origin. What neither covers is cost: the relay is a middleware `rewrite`, so whatever `cache-control` the legacy Apache sends is what the browser gets, and an origin sending none makes five font round trips per framed page. The frame document itself is `s-maxage=3600` with no `max-age` (`app/legacy/[...slug]/route.ts:35`), so the browser re-requests it on a back-navigation. · **Covered by:** `e2e/legacy-embed.spec.ts`

#### PERF-14 · P2 · manual — Stop the legacy height reporter after eleven settling ticks

- **Given** `legacyRuntime.ts:123-130` — a 1 000 ms `setInterval` that force-reports the frame's height and clears itself once `ticks > 10`, plus reports on DOMContentLoaded, load, `pageshow` and every ResizeObserver callback. Each forced message calls `setHeight` in the parent (`LegacyEmbed.tsx:57`).
- **When** Open an embedded page, count `od:legacy-height` messages the parent receives over 30 s, and check whether any arrives after ~12 s.
- **Then** At most 11 forced messages plus the event-driven ones; nothing at all after ~12 s. A message at t = 20 s means the interval never cleared — a permanent 1 Hz timer plus a React state write on a phone, on the one surface that also runs the old theme's 46-58 scripts.
- **Verify:** On https://new.obshee-delo.ru/actual/, paste in the console: `let n=0; addEventListener('message', e => { if (e.data && e.data.type === 'od:legacy-height') console.log(++n, Math.round(performance.now())); })` — then reload and watch the timestamps stop.
- **Why:** The forced resend is deliberate and load-bearing (commit b8fa172: «2149px of page in a 540px box, permanently»), so the bound is the only thing standing between the repair and a permanent timer. `e2e/legacy-embed.spec.ts:203` covers the recovery half («recovers when the parent starts listening late»); the upper bound on ticks is asserted nowhere. · **Covered by:** **gap**

#### PERF-15 · P2 · unit — Keep the fixture-parsing suites inside the 60 s CI test timeout

- **Given** `vitest.config.ts:25-33`: the default 5 s timeout «lost» because `transformLegacyHtml` parses whole 85-128 KB legacy fixture pages — 1.5 s for the file locally against 175 s on a GitHub runner, its slowest single case 30 s there, which «had CI red on main for three pushes with nothing broken». The ceiling is now 60 s.
- **When** Run the two fixture-driven suites locally, and read the CI job's own duration for the `Test` step (`.github/workflows/ci.yml:50-51`).
- **Then** Locally: 93 tests pass in ≤ 5 s — measured 1.88 s on 2026-08-22. On CI the `Test` step completes and no single case is within 10 s of the 60 s ceiling. A new fixture-parsing case measuring over 6 s locally is over the ceiling on a runner and must not be added without raising the ceiling in the same commit.
- **Verify:** `npx vitest run src/shared/legacy/transformLegacyHtml.test.ts src/shared/legacy/fixtures.test.ts` (read the Duration line), then the `Test` step duration on the latest main run of `.github/workflows/ci.yml`.
- **Why:** A red main with nothing broken is a real incident this repo already had, and the ~100× local-to-runner ratio makes local timing a useless guide. The fixtures are also pinned by hash (`src/shared/legacy/__fixtures__/README.md`) and asserted by `fixtures.test.ts`, so their size — and therefore this cost — cannot drift silently, only deliberately. · **Covered by:** **gap**

#### PERF-16 · P2 · manual — Render /sitemap.xml's 8 248 URLs in one pass without a 503 storm on WordPress

- **Given** `app/sitemap.ts` — `revalidate = 86400`, `PER_PAGE = 100` so ~83 pages of `/wp/v2/posts`, `CONCURRENCY = 4` (matched to `staticGenerationMaxConcurrency`), `ATTEMPTS = 3` with `RETRY_BACKOFF_MS = 500`, and `MIN_COVERAGE = 0.9` below which it throws rather than publishing a short file.
- **When** Request /sitemap.xml on od-stage with a cold cache, timing it and watching the WordPress host for 5xx during the crawl; then request it again.
- **Then** One request completes and `grep -c '<loc>'` returns the full archive (8 248 at the A8 measurement — compare against `X-WP-Total` on /wp/v2/posts for the tier). No 5xx from WordPress during the crawl. The second request is served from cache in ≤ 600 ms. A truncated document is worse than none: under 90 % coverage the route must throw and leave the previous body in place, which reads as an unchanged sitemap and not as an outage.
- **Verify:** `time curl -s https://new.obshee-delo.ru/sitemap.xml | grep -c '<loc>'` — twice in a row; and `curl -sI 'https://od.webtm.ru/wp-json/wp/v2/posts?per_page=1' | grep -i x-wp-total`.
- **Why:** This is the heaviest single render in the app — ~83 upstream requests at ~1.5 s each behind a cap of 4 — and it is the one a crawler hits, on a route whose failure mode is silent. `src/app/sitemap.test.ts:113-259` covers the crawl shape, the retry, the coverage floor and the credential-free stub against mocks; nothing measures the cost on a real tier, and `next.config.ts:74-76` records that this WP host «starts 503ing» above that parallelism. · **Covered by:** **gap**

#### GAP-11 · P1 · build — Serve every image with WP_MEDIA_CDN unset — the documented disable path

- **Given** `WP_MEDIA_CDN=""` is documented as disabling the CDN rewrite (`src/shared/api/mediaCdn.ts`), and `docker-compose-prod.yaml:12` passes it as `${WP_MEDIA_CDN:-}` — so an unset variable is the _default_, not an error. It is also a build-arg feeding `images.remotePatterns`, so unsetting it removes an allowlist entry at build time and changes what `resolveMediaUrl` returns at runtime, in the same build.
- **When** `rm -rf .next && WP_MEDIA_CDN= pnpm build && pnpm start`, then load a film page, a news article with a body gallery, `/materials/plakati/` and the home film row. Read every image URL's host and status, and the compiled `remotePatterns` from `.next/images-manifest.json`.
- **Then** Every image resolves to the WP origin and answers 200 — no `-WxH` sized variant (which 500s on the bucket), no `/_next/image` 400 from a host that is no longer allowlisted, and the manifest holds three hostnames rather than four with no `wp.invalid` among them. The page is slower and correct. If any image 400s or 404s, the documented disable path is not a fallback and the doc has to stop saying it is.
- **Verify:** `WP_MEDIA_CDN= pnpm build && node -e "console.log(require('./.next/images-manifest.json').images.remotePatterns.map(p=>p.hostname))"`; then `curl -sI` each image src on /71933/.
- **Why:** SEC-13 names the mechanism in prose («`WP_MEDIA_CDN=""` drops an entry, build-time and invisible at runtime») and asserts only that a foreign host 400s. OPS-02 checks the four-host allowlist in the healthy case. Neither runs the disabled case, and it is the state a tier lands in by forgetting one line of Coolify config — with the origin measured at ~1.3 s through its 301 and its sized variants 500ing, that is a slow site with broken images, at 200. · **Covered by:** **gap**

## 9. WordPress-side PHP, content scripts & mu-plugins

_Does the PHP running inside WordPress — five mu-plugins loading on every site request, two `wp eval-file` content scripts and the shortcode→Gutenberg migrator — survive its own runtime floor, refuse to write when it was not asked to, and read production's body shape rather than od-dev's?_

#### WP-01 · P0 · script — Lint every wp/mu-plugins file under PHP 7.4, not the dev machine's 8.5

- **Given** the dev machine's CLI is PHP 8.5.9 (`php -v`, measured 2026-08-22); od-dev serves the _site_ on `apache2handler` PHP 7.4.33 while its CLI is 8.2.32, and production's mu-plugin runtime is 8.2. An mu-plugin loads on every site request, so 7.4 is the floor. `wp/mu-plugins/` holds five files plus `od-revalidate/config.example.php`.
- **When** `docker run --rm -v $PWD/wp:/w:ro php:7.4-cli sh -c 'for f in /w/mu-plugins/*.php /w/mu-plugins/od-revalidate/*.php; do php -l $f || exit 1; done'` — then repeat against a scratch copy of `od-regions.php` with `return match(true){default=>1};` spliced into `od_regions_has_class()`.
- **Then** six lines of `No syntax errors detected in …`, exit 0 (measured green 2026-08-22). The mutated copy prints `Parse error: syntax error, unexpected 'default' (T_DEFAULT)` and `Errors parsing …` under 7.4, while `php -l` on the dev machine's 8.5 still says `No syntax errors detected` — so the local binary cannot be the gate.
- **Verify:** `docker run --rm -v /home/alexey/Projects/od-frontend/wp:/w:ro php:7.4-cli sh -c 'for f in /w/mu-plugins/*.php /w/mu-plugins/od-revalidate/*.php; do php -l $f; done'`
- **Why:** `wp/mu-plugins/od-regions.php:10-17` and `docs/wp-page-redesign.md` §1. Syntax above the floor is a parse error that takes the whole WordPress site — and therefore every REST response this frontend consumes — down the moment WordPress loads. `grep -n php .github/workflows/ci.yml` returns nothing: CI runs no PHP at all. · **Covered by:** **gap**

#### WP-02 · P0 · script — Grep mu-plugins for PHP 8 functions that php -l under 7.4 accepts

- **Given** an undefined function is a _runtime_ fatal, not a parse error, so WP-01's lint cannot see it. `wp/scripts/od-pages.php` runs only under WP-CLI (8.2 on prod) and legitimately calls `str_contains`/`str_starts_with` at 9 sites; the five mu-plugins run on every site request at the 7.4 floor.
- **When** `grep -nE '\b(str_contains|str_starts_with|str_ends_with|array_is_list|get_debug_type)\s*\(' wp/mu-plugins/*.php wp/mu-plugins/od-revalidate/*.php` — then the same pattern over `wp/scripts/od-pages.php` as the control.
- **Then** zero matches across `wp/mu-plugins` (measured: 0 in each of od-film-meta, od-profile, od-regions, od-revalidate, od-sidebars). 9 matches in `wp/scripts/od-pages.php`, proving the pattern works and that the two runtimes differ on purpose. Proof the lint cannot substitute: a one-line `function g($s){return str_contains($s,'x');}` reports `No syntax errors detected` under php:7.4-cli — measured 2026-08-22.
- **Verify:** `grep -nE '\b(str_contains|str_starts_with|str_ends_with|array_is_list|get_debug_type)\s*\(' /home/alexey/Projects/od-frontend/wp/mu-plugins/*.php`
- **Why:** `wp/mu-plugins/od-regions.php:14-15` enumerates exactly this list. `od_regions_has_class()` runs on every `/contacts/` render, so a `str_contains` there is a fatal on that page rather than a warning — and `/contacts/` is the only place the 59 (od-stage) / 75 (od-dev) regions are listed. · **Covered by:** **gap**

#### WP-03 · P0 · php — Run all five wp/tests suites and read the printed assertion count

- **Given** `php -i | grep zend.assertions` reports `-1 => -1` on the dev machine and on both servers, which compiles `assert()` out of the file entirely; `assert_options(ASSERT_ACTIVE, 1)` cannot switch it back on. `wp/tests/harness.php`'s `od_test()` is an `if` plus `exit(1)`, which no ini setting can disable.
- **When** `for f in od-pages od-wp od-regions od-revalidate cmsms-upgrade; do php wp/tests/$f.test.php || echo BROKEN $f; done`; then `grep -nE '(^|[^_[:alnum:]])assert\s*\(' wp/tests/*.php`; then flip one `od_test()` condition to `false` in a scratch copy and re-run it.
- **Then** five suites exit 0 printing `1124 assertions passed.` / `174` / `43` / `13` / `21` (all measured 2026-08-22 — `docs/wp-page-redesign.md:56` still records od-wp at 150 and says «all four», so the doc is the stale half, not the suites). The grep returns only three docblock mentions (`harness.php:5`, `harness.php:6`, `od-pages.test.php:11`) and no call site. The flipped copy exits **1** and prints `FAIL  <description>` on stderr; the same mutation written as `assert(false)` exits **0** and prints nothing.
- **Verify:** `php /home/alexey/Projects/od-frontend/wp/tests/od-pages.test.php | tail -1; echo $?`
- **Why:** `wp/tests/harness.php:5-11`; `docs/wp-page-redesign.md` §Tests — the D6e/D6f branch's 114 `assert()` checks had never executed and hid six wrong assertions until they were ported onto `od_test()` on 2026-08-18. Nothing prevents a new suite reaching for `assert()` again: no lint, no grep, no CI step. · **Covered by:** **gap**

#### WP-04 · P0 · manual — Run od-pages.php with no argument, with --apply, and with apply

- **Given** od-stage (WordPress at `https://od.webtm.ru`), script `scp`'d to the WordPress root, with `od-regions.php` installed and `od-wp.php apply` already run — the order in `docs/wp-page-redesign.md` §3a is not negotiable.
- **When** (1) `wp --url=https://od.webtm.ru eval-file od-pages.php` (2) `wp --url=https://od.webtm.ru eval-file od-pages.php --apply` (3) `wp --url=https://od.webtm.ru eval-file od-pages.php apply`
- **Then** (1) prints `Dry run — pass \`apply\` to write.`and **0** lines starting`Success:`, and `wp post get 529 --field=post_content | md5sum`is unchanged afterwards. (2) WP-CLI rejects the unknown flag and the script never runs — it must not read as a successful dry run. (3) prints`Applying changes.`and one`Success: … written`per changed record, with **no** WordPress critical error:`global $wpdb;`at`od-pages.php:5601` is what stops a write dying _after_ the dry-run line has already printed.
- **Verify:** the three commands above, plus `wp --url=https://od.webtm.ru post get 529 --field=post_content | md5sum` before and after run (1)
- **Why:** `wp/scripts/od-pages.php:5601` and `:5603-5604` (`in_array('apply', $args ?? [], true)`); `docs/wp-page-redesign.md` §1 «One thing that is not in the file and cannot be: `$wpdb`» — `wp eval-file` runs the script in a function scope, and without the global the write fails in a way that reads exactly like a successful run. · **Covered by:** **gap**

#### WP-05 · P0 · manual — Re-run od-pages.php a third time and count warnings, not successes

- **Given** od-stage after `od-wp.php apply` then `od-pages.php apply` have each been run once (done 2026-08-21: 308 + 5 bodies written). The registry addresses records by path, and production's page set is not od-dev's — 148 published pages against 168.
- **When** `wp --url=https://od.webtm.ru eval-file od-pages.php 2>&1 | tee /tmp/third.log`, then `grep -c 'Warning:' /tmp/third.log` and `grep -c 'bytes ->' /tmp/third.log`.
- **Then** `Warning:` count **0** and `bytes ->` count **0**; every non-sweep entry logs `already in shape, skipped`. A non-zero warning count names a page that was left exactly as the editor had it, at status 200 — the five that did this on the first prod-clone run were `/contacts/`, `/healthy-kids/`, `/materials/audio-roliki-social-reklama/`, `/about/` and `/contacts/samarskaya/`. Distinguish the two warning texts: `no such page` is production's page set (information), `unexpected media`/`unexpected prose` is a transform that refused the body (a defect).
- **Verify:** `wp --url=https://od.webtm.ru eval-file od-pages.php 2>&1 | grep -c 'Warning:'` — expect 0
- **Why:** `docs/wp-page-redesign.md` §3a step 3 and §Tests; `docs/prod-migration-runbook.md` §5 gate 15 («0 writes and — the part that is easy to miss — 0 warnings»). Per-transform idempotency is proven by 32 `od_test_idempotent` cases in `wp/tests/od-pages.test.php`, but «no page was refused» exists only in the run log. · **Covered by:** **gap**

#### WP-06 · P0 · php — Feed each transform production's body shape, not only od-dev's

- **Given** `wp/tests/fixtures/` holds five `*.prod.html` captures from od-stage (2026-08-21) beside their od-dev `*.before.html` twins: contacts, healthy-kids, audio-roliki-social-reklama, page-about, contacts-samarskaya. Production still holds CMSMasters shortcodes and converts through the migrator at cutover, so its shape is the one that ships.
- **When** `php wp/tests/od-pages.test.php`; then delete the `contacts.prod.html` block (`od-pages.test.php:1917-1942`) in a scratch copy and re-run.
- **Then** 1124 assertions pass. The prod cases assert what od-dev cannot: prod's `/contacts/` carries **0** `<!-- wp:details`, its branch list is `[pagelist child_of="529"` over a `<div id="vmap"`, and `od_pages_contacts()` still emits exactly **1** `<!-- wp:shortcode -->\n[od_regions]\n<!-- /wp:shortcode -->` with no `vmap` and no `<script` left; prod's `/healthy-kids/` has **1** `<h3><a href=…>` not two; prod's audio page holds 4 `<!-- wp:audio` and no `[cmsms_audio]`; prod's `/about/` holds a raw `kinescope.io/embed/btj4T6bA6nco148tuqBpgY` iframe not a `wp:embed`; and `od_pages_samarskaya_coordinators($samarskaya_prod, 532) === $samarskaya_prod` exactly. Deleting any of those cases drops the count below 1124.
- **Verify:** `php /home/alexey/Projects/od-frontend/wp/tests/od-pages.test.php | tail -1`
- **Why:** `docs/wp-page-redesign.md` §Tests — «a transform that is right about od-dev and refuses production does nothing where it matters, at 200, with a one-line warning in a 364-line log». All five differences are od-dev hand edits or an older migration production never had. · **Covered by:** `wp/tests/od-pages.test.php`

#### WP-07 · P0 · manual — Count /contacts/ disclosures on od-stage, never the literal [od_regions]

- **Given** `od-pages.php` rewrites `/contacts/` (page 529) to a single `[od_regions]` shortcode block, and `od-regions.php` is what renders it. On od-stage the `/contacts/` subtree holds **58** published children against od-dev's 74, and `/khabarovskiy/` is the one region page that is not a child (`od-regions.php:59`).
- **When** `curl -s 'https://od.webtm.ru/wp-json/wp/v2/pages?slug=contacts&_fields=content' | python3 -c 'import json,sys; c=json.load(sys.stdin)[0]["content"]["rendered"]; print(c.count("od-region\""), c.count("[od_regions]"))'`, then `curl -s https://new.obshee-delo.ru/contacts/ | grep -c 'od-region__link'`.
- **Then** **59** `<details class="wp-block-details od-region">` on od-stage (58 children + `/khabarovskiy/`; od-dev's answer is 75), exactly one `<div class="od-regions">`, and **0** occurrences of the literal string `[od_regions]`. Every item carries an `<a … od-region__link">Страница отделения</a>` with a real permalink. A literal `[od_regions]` in `content.rendered` means the mu-plugin is not installed on that tier — WordPress prints an unknown shortcode as its own source text, so the region list becomes eleven characters of prose.
- **Verify:** `curl -s 'https://od.webtm.ru/wp-json/wp/v2/pages?slug=contacts&_fields=content' | grep -c '\[od_regions\]'` — expect 0
- **Why:** `docs/wp-page-redesign.md` §3a step 1 («od-regions.php first … a shortcode that no plugin defines renders as literal text»); `wp/mu-plugins/od-regions.php:251-272`. The 58-vs-74 split is `docs/implementation-notes.md:1256` and `docs/page-inventory.md` §8; the map was regenerated against production's 57 region pages rather than od-dev's 75. · **Covered by:** **gap**

#### WP-08 · P0 · manual — Install od-profile.php while cmsms is still active, then deactivate

- **Given** a prod clone where `cmsms-content-composer` is still installed and active, holding 205 `profile` records (139 published) and 75 regional `wp:query` blocks filtered on `pl-categs`.
- **When** `scp wp/mu-plugins/od-profile.php` into `wp-content/mu-plugins/`, `php -l` it on the host, then capture `wp eval 'echo json_encode([get_post_type_object("profile")->rewrite, get_post_type_object("profile")->menu_position, get_object_taxonomies("profile"), get_taxonomy("pl-categs")->show_in_rest]);'` and `curl -so /dev/null -w '%{http_code}' https://od.webtm.ru/wp-json/wp/v2/pl-categs` — **before** deactivating cmsms and again after.
- **Then** the two captures are identical, which is the whole point of priority 20. Specifically: `get_object_taxonomies('profile')` returns **both** `post_tag` and `pl-categs` (`od-profile.php:106-113` declares `post_tag` because re-registering a post type resets the taxonomy list — dropping it shrank one regional page's rendered output by 23 bytes), `rewrite.slug` is `profile`, `menu_position` is 52, `/wp/v2/pl-categs` answers **200** where cmsms alone 404s, and `/wp/v2/profile` returns 139 items. Installing the mu-plugin _after_ deactivation instead opens a window in which 205 records have no post type at all.
- **Verify:** the two `wp eval` captures above, diffed; `wp/mu-plugins/od-profile.php:53`
- **Why:** `docs/wp-backend.md` §3.1 «The mu-plugin — shipped, and cmsms deactivated on od-dev» (the `post_tag` trap is recorded there verbatim); `docs/prod-migration-runbook.md:446` («don't skip step 2's verification: installing the mu-plugin after deactivating means a window in which 205 records have no post type, and the 75 regional query blocks ask for one that does not exist»). · **Covered by:** **gap**

#### WP-09 · P0 · manual — Dump a converted region page and read its taxQuery taxonomy and ids

- **Given** production converts through `cmsms-gutenberg-upgrade` at cutover, so a bug in the migrator is a bug in prod's future content. Its `cmsms_profiles` branch once resolved `categories="activity-<region>"` against `post_tag` (2 of 139 profiles carry one) instead of `pl-categs` (135 do), fell into a `taxQuery => ['post_tag' => [-1]]` placeholder, and all 75 regional coordinator lists rendered 113 bytes of wrapper — at 200, with no error.
- **When** on the target install: `wp cmsms dump <region page id> --converted --url=https://od.webtm.ru | grep -o 'taxQuery[^}]*}'`, then `wp cmsms migrate --post=<id> --dry-run --url=https://od.webtm.ru`.
- **Then** the converted body carries `"taxQuery":{"pl-categs":[<n>]}` with **this install's own term id** — `core/query` takes ids, not slugs, and ids differ per environment — and **not** `[-1]`. A shortcode with no `categories` attribute must emit **no** `taxQuery` key at all rather than the placeholder. Across a full pass the shape is 71 referenced region slugs → 1 resolving to no term (where `-1` is correct), 20 whose term holds no published profile, and **50 pages holding 128 profile rows**.
- **Verify:** `wp cmsms dump <id> --converted --url=https://od.webtm.ru | grep -o 'taxQuery[^}]*}'`
- **Why:** `wp/plugins/cmsms-gutenberg-upgrade/cmsms-gutenberg-upgrade.php:843-895` (the Russian comment block records the 2-of-139 measurement) and `docs/wp-page-passthrough.md` §5a. No frontend test can see an empty query loop, and `pnpm pages:inventory` counts the page as redesigned either way. · **Covered by:** **gap**

#### WP-10 · P1 · php — Re-parent /khabarovskiy/ under /contacts/ and count its disclosures

- **Given** `od_regions_records()` unions `get_posts(['post_parent' => <index id>])` with `get_page_by_path('khabarovskiy')` and splices the second into the first with no membership check (`wp/mu-plugins/od-regions.php:102-133`, `array_splice` at `:163`). `wp/tests/od-regions.test.php` stubs `get_posts()` with a table that never contains the extra page, so the overlap is never exercised.
- **When** add a case to `wp/tests/od-regions.test.php` putting the same `WP_Post('Хабаровский край','khabarovskiy')` in **both** `$GLOBALS['od_pages_table']` and `$GLOBALS['od_extra_page']`, then `php wp/tests/od-regions.test.php`. On a tier: `wp post update <khabarovskiy id> --post_parent=529 --url=https://od.webtm.ru` and re-read `/contacts/`.
- **Then** exactly **1** `<summary>Хабаровский край</summary>` in the accordion, whatever the page's parent is. Today the count is **2** — one from the children query, one from the splice — so this scenario fails until the union dedupes by ID, and `od_regions_records()` returning 3 records for a 2-page table is the unit-level signal.
- **Verify:** `php /home/alexey/Projects/od-frontend/wp/tests/od-regions.test.php` (after adding the duplicate case)
- **Why:** `wp/mu-plugins/od-regions.php:52-59` addresses the page by path precisely _because_ it is not a child — which makes «set the parent in the admin» a one-click change with no error, on the only page where all 59/75 regions are listed. · **Covered by:** **gap**

#### WP-11 · P1 · manual — Assert od_profile_register hooks init at priority 20, not the default 10

- **Given** mu-plugins load before ordinary plugins, so at a shared priority `od-profile.php`'s callback runs first and a still-installed cmsms re-registers over it. cmsms's `$pl_categs_args` omits `show_in_rest`, which is why `/wp/v2/pl-categs` used to 404.
- **When** on a tier where cmsms is still active: `wp eval 'global $wp_filter; foreach ($wp_filter["init"]->callbacks as $p => $cbs) { foreach ($cbs as $k => $c) { if (strpos($k, "od_profile_register") !== false) echo $p; } }'`. Then set the priority to 10 in a copy uploaded to od-dev and re-check `/wp/v2/pl-categs`.
- **Then** prints `20`. With priority 10, the same tier's `/wp/v2/pl-categs` returns to **404** and `wp eval 'var_dump(get_taxonomy("pl-categs")->show_in_rest);'` returns to `bool(false)` — cmsms's later registration wins. That reversal is the mutation this scenario exists to catch; it is invisible on any tier where cmsms has already been deleted.
- **Verify:** `wp eval 'var_dump(get_taxonomy("pl-categs")->show_in_rest);' --url=https://od.webtm.ru` — expect `bool(true)`
- **Why:** `wp/mu-plugins/od-profile.php:36-42` and `:53`; `docs/wp-backend.md` §3.1 — priority 20 is what makes the rollout verifiable: install, check REST and the admin, and only then deactivate cmsms, at which point nothing changes because this was already the live registration. · **Covered by:** **gap**

#### WP-12 · P1 · manual — Check sidebar_bottom is registered with welfare's own <aside> wrappers

- **Given** the `welfare` theme registered `sidebar_bottom` and was deleted (the step that opened REST), which moved its 28 widget instances to `wp_inactive_widgets`. `fetchFooter` asks for that exact id (`src/shared/api/fetchFooter.ts:8`) and `Footer.module.css` lays the footer out with `.footer aside:nth-child(1)` … `:nth-child(6)`.
- **When** `wp eval 'print_r($GLOBALS["wp_registered_sidebars"]["sidebar_bottom"]);' --url=https://od.webtm.ru`, then `curl -s 'https://od.webtm.ru/wp-json/wp/v2/widgets?sidebar=sidebar_bottom' | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))'`, then `curl -s https://new.obshee-delo.ru/ | grep -c '<aside id="block-'`.
- **Then** the registration exists with `before_widget` exactly `<aside id="%1$s" class="widget %2$s">`, `after_widget` `</aside>`, `before_title` `<h3 class="widgettitle">` and name «Подвал сайта»; the widgets endpoint returns a non-empty array; the rendered home page carries **6** `<aside id="block-`. WordPress's default `<li>` wrappers would answer 200 with identical widget _content_ and silently break every `nth-child` rule, so the wrapper strings are part of the contract, not cosmetics.
- **Verify:** `curl -s https://new.obshee-delo.ru/ | grep -c '<aside id="block-'` — expect 6 (`prod-migration-runbook` §5 gate 13)
- **Why:** `wp/mu-plugins/od-sidebars.php:28-33` and `:48-53` (its docblock still says «the four the footer renders», predating the six-block footer authored on the clone) and `docs/prod-migration-runbook.md:102` + §5 gate 13. An unregistered area returns an empty array, which renders as an empty footer shell at 200 with nothing in any log. · **Covered by:** **gap**

#### WP-13 · P1 · manual — Read meta.od_card_cover for a film with a плакат and one without

- **Given** `od_card_cover` is computed on read by a `get_post_metadata` filter (`wp/mu-plugins/od-film-meta.php:60`) and registered at `init` (`:41`), because Block Bindings read only _registered_ meta keys and this site had exactly one — core's `footnotes`. 11 of 99 films carry a `poster_image_url`.
- **When** `curl -s 'https://od.webtm.ru/wp-json/wp/v2/posts/71933?_fields=id,featured_media,meta.od_card_cover,meta.poster_image_url'` for a film that has a плакат and for one that does not; then rename the mu-plugin on the host and repeat.
- **Then** with a плакат: `meta.od_card_cover` === `meta.poster_image_url`. Without one: `meta.od_card_cover` is the featured image's full-size URL (non-empty) while `meta.poster_image_url` stays `""` — so no film falsely claims a printable плакат to `FilmPosterCard`. With the mu-plugin absent the key is **missing from `meta` entirely** and every card in the «Проекты программы» row on `/healthy-russia/`, `/healthy-youth/` and `/healthy-kids/` renders coverless at 200.
- **Verify:** `curl -s 'https://od.webtm.ru/wp-json/wp/v2/posts/71933?_fields=meta.od_card_cover,meta.poster_image_url'`
- **Why:** `wp/mu-plugins/od-film-meta.php:23-32` and `:72-86`; `docs/prod-migration-runbook.md:161` («a programme card has no cover → `od-film-meta.php` must be installed») and §2.4's gate («18 acf keys **and** `meta.od_card_cover`»). The fallback is the design: uploading a плакат upgrades a card with nothing else to do. · **Covered by:** **gap**

#### WP-14 · P1 · manual — Run wp cmsms migrate twice and check the second dry-run reports 0

- **Given** `migrate` always converts from the `nvp_content_copy` backup, never from the current body, and writes through `$wpdb->update` — because the plugin's own `save_post` hook (`cmsms-gutenberg-upgrade.php:67-73`) deletes that meta on `wp_update_post`, destroying the copy both a re-run and `restore` depend on.
- **When** `wp cmsms backup --url=https://od.webtm.ru`; `wp cmsms migrate --url=…`; then `wp cmsms migrate --url=… --dry-run` a second time; then `wp cmsms restore --post=<id> --url=…` and `wp cmsms dump <id> --url=…` / `--original`.
- **Then** the second dry-run's success line reads `К обновлению: 0, без изменений: <N>, всего проверено: <N>` — the same input converts to the same output twice, which is the convergence check (od-dev: 2 657 records changed, 5 821 already identical, then 0 left). `restore` puts the pre-migration body back byte-for-byte, so `dump <id>` and `dump <id> --original` agree afterwards. A run that had used `wp_update_post` anywhere shows up here as `Error: Нет записей с копией оригинала.`
- **Verify:** `wp cmsms migrate --url=https://od.webtm.ru --dry-run | tail -1`
- **Why:** `wp/plugins/cmsms-gutenberg-upgrade/cmsms-gutenberg-upgrade.php:1146-1195`; `docs/wp-page-passthrough.md` §6 («re-running is safe by construction … a second dry-run afterwards reported 0 left»). The same `save_post` hazard is why `od-pages.php` writes through `$wpdb->update` after `wp_save_post_revision`. · **Covered by:** **gap**

#### WP-15 · P1 · php — Boot od-revalidate.php with no constants and check every post type routes

- **Given** `wp/tests/od-revalidate.test.php` loads the mu-plugin with only `ABSPATH`, a two-field `WP_Post` stub and an `add_action` stub, and reads the private queue back through reflection. `boot()` returns early when either constant is missing, which is the wanted state on an instance whose frontend is not deployed — od-dev ships with `OD_REVALIDATE_URL` commented out on purpose.
- **When** `php wp/tests/od-revalidate.test.php`
- **Then** 13 assertions pass: `OD_Revalidate::configured()` is `false`; a `post` (39664) queues `['ids' => [39664], 'tags' => []]`; a `page` (27642) queues `['wp:pages']` and **no** id; a `profile` (46651) queues `['wp:profiles']` and no id; `attachment`, `project`, `product` and `nav_menu_item` queue **nothing at all**; and every emitted tag starts `wp:`, the only namespace `POST /api/revalidate/` accepts. A post type missing from `queue_post()` fails silently — the editor saves, no purge happens, the page serves its cached render for up to an hour, which is exactly what happened to `page` and `profile` until 2026-08-18.
- **Verify:** `php /home/alexey/Projects/od-frontend/wp/tests/od-revalidate.test.php | tail -1` — `13 assertions passed.`
- **Why:** `wp/mu-plugins/od-revalidate.php:275-310` and `wp/tests/od-revalidate.test.php:9-17`; `docs/wp-backend.md` §6.5 table of bodies and tags. · **Covered by:** `wp/tests/od-revalidate.test.php`

#### WP-16 · P1 · manual — Save against an unreachable frontend and time five edits

- **Given** od-dev runs `apache2handler`, so `fastcgi_finish_request()` does not exist there and the 5-minute breaker transient is the entire protection. Measured baseline: 2607 ms per REST title edit; an unreachable endpoint with `blocking => false` cost **8216 ms on every save**, because WordPress's curl transport calls `curl_exec()` for a non-blocking request too and merely discards the response.
- **When** point `OD_REVALIDATE_URL` at an unreachable host in `mu-plugins/od-revalidate/config.php`, make five identical REST title edits and time each; then `wp transient get od_revalidate_unreachable`, `grep -F '[od-revalidate]' wp-content/debug.log | tail`, and `wp eval 'echo substr(OD_REVALIDATE_URL, -1);'`.
- **Then** the first save costs ~6600 ms and the next four **795–1765 ms**, not 8200 ms each. `od_revalidate_unreachable` exists with a TTL ≤ 300 s. `debug.log` carries exactly one line ending `— not retrying for 300s` (failures always log; successes only under `OD_REVALIDATE_DEBUG`). And `substr(OD_REVALIDATE_URL, -1)` prints `/` — the client sets `redirection => 0` and does not re-POST, so the slashless form's 308 would purge nothing while looking configured.
- **Verify:** `wp eval 'echo substr(OD_REVALIDATE_URL, -1);' --url=https://od-dev.tmweb.ru` — expect `/`
- **Why:** `wp/mu-plugins/od-revalidate.php:22-25`, `:55-61` and `:199-225`; `docs/wp-backend.md` §6.5 «The thing that surprised us» — the first draft of that section promised «an editor never waits» on the strength of `blocking => false`, which bought nothing. · **Covered by:** **gap**

#### WP-17 · P1 · manual — Run od-wp.php with a typo'd task name and with no name at all

- **Given** `od-wp.php`'s runner maps eight task names; naming one is what lets production take a single fix without also taking the programme tags, the index renames and the branch drafting it has not asked for (`wp/scripts/od-wp.php:1005-1019`).
- **When** (1) `wp --url=https://od.webtm.ru eval-file od-wp.php apply untag-video-event` (singular typo) (2) `wp --url=… eval-file od-wp.php apply` (3) `wp --url=… eval-file od-wp.php untag-video-events`
- **Then** (1) exits non-zero with `Error: unknown task(s): untag-video-event` followed by `Known: tag-programme-films, rename-pages, order-pages, draft-empty-branches, edit-menu, create-profiles, untag-video-events, rehost-posters`, and writes **nothing** — it must not fall through to running all eight. (2) prints `Applying every task.` and runs all eight. (3) prints `Dry run — untag-video-events.` and produces 0 `Success:` lines, only `-«<category>»` log lines for the three miscategorised «Видео события» posts.
- **Verify:** `wp --url=https://od.webtm.ru eval-file od-wp.php apply untag-video-event; echo $?`
- **Why:** `wp/scripts/od-wp.php:1005-1019` («Refuse rather than silently run everything: a typo'd task name on production would apply all eight») and `docs/wp-page-redesign.md` §1. `wp/tests/od-wp.test.php` exercises only the registries — the runner has no unit coverage at all. · **Covered by:** **gap**

#### WP-18 · P2 · php — Assert every od*pages*\* transform is registered and every sweep is scoped

- **Given** two registry records written as one array literal duplicate the `label`/`path`/`fix` keys; PHP keeps the last of each, the earlier record vanishes, nothing is malformed and nothing warns. `/materials/autosticker/` sat that way from D6m until 2026-08-20 and was never once transformed while every doc counted it as redesigned.
- **When** `php wp/tests/od-pages.test.php`; then merge two adjacent `$registry[] = [ … ];` literals into one in a scratch copy of `od-pages.php` and re-run.
- **Then** the suite asserts `count($defined[1]) >= 34` transforms matching `function od_pages_\w+\(string $content, int ` and that **each** appears in `array_column(od_pages_registry(), 'fix')`; that the fix|path|title|parent|post_type tuples and the labels are each unique; and that every `sweep` entry names a `post_type` or a `parent` — `page` by default would put every published page through a `profile` transform. The merged scratch copy exits 1 naming the transform that lost its record.
- **Verify:** `php /home/alexey/Projects/od-frontend/wp/tests/od-pages.test.php` (assertions at `od-pages.test.php:1857-1907`)
- **Why:** `wp/tests/od-pages.test.php:1866-1907` and `docs/wp-page-redesign.md` §1 («Write each record as its own array literal … A count is the only thing that catches it»). · **Covered by:** `wp/tests/od-pages.test.php`

## 10. Build, container, CI/CD, cutover & rollback

_Will this exact image — built by this pipeline, with these build args, started by this orchestrator against this tier — serve the site correctly, and is there a way back if it does not?_

#### OPS-01 · P0 · infra — Assert the header and footer are in the prerendered HTML of the deployed image, not only in a live render

- **Given** a tier deployed from a GHCR image (stage: `https://new.obshee-delo.ru`), `revalidate = 3600` on every route, and the root layout fetching the `main-navigation` menu plus the `sidebar_bottom` widget area.
- **When** you curl `/` (prerendered at build time) and `/news/` (rendered on demand) and compare the two.
- **Then** both answer 200 and both contain 6 occurrences of `<aside id="block-` and all three of «ГЛАВНАЯ», «ФИЛЬМЫ», «КОНТАКТЫ». `/` carries `x-nextjs-cache: HIT`, proving the assertion was made against the build's own copy. If `/news/` has the shell and `/` does not, the image was built without `WP_USER`/`WP_PASSWORD` — fail.
- **Verify:** `curl -s https://new.obshee-delo.ru/ | grep -c '<aside id="block-'` (expect 6) · `curl -s https://new.obshee-delo.ru/ | grep -o 'ГЛАВНАЯ\|ФИЛЬМЫ\|КОНТАКТЫ' | sort -u | wc -l` (expect 3) · `curl -sI https://new.obshee-delo.ru/ | grep -i x-nextjs-cache` — then repeat all three against `/news/`
- **Why:** without the credentials at BUILD time `src/shared/api/httpClient.ts:5-13` falls back to `stubFetch` (returns `[]` for everything), `pnpm build` still exits 0, and the empty shell is baked into the static HTML for the whole hour — measured 2026-08-21 on the first real image (`Dockerfile:44-59`, runbook §4.5 and §5 gate 13, commit a822763 defect 2). CI's build is secretless on purpose, so CI can never catch this. · **Covered by:** **gap**

#### OPS-02 · P0 · build — Prove images.remotePatterns was baked from the tier's real WP_BASE, not from https://wp.invalid

- **Given** a clean tree (`rm -rf .next`) and the tier's env — for stage `WP_BASE=https://od.webtm.ru`, `WP_MEDIA_CDN=https://obshee-delo.website.yandexcloud.net`.
- **When** you run `pnpm build` and read the compiled allowlist out of `.next/images-manifest.json`; then, as the one-over case, `docker build --target runner -t od:noarg .` with NO `--build-arg WP_BASE` and request one optimized image from it.
- **Then** the manifest's `remotePatterns` hostnames are exactly four — `od.webtm.ru`, `xn----9sbkcac6brh7h.xn--p1ai`, `obshee-delo.website.yandexcloud.net`, `kinescope.io` — and `wp.invalid` appears 0 times. In the `od:noarg` container every `/_next/image/?url=…` answers 400. (Today's stale local manifest holds only three of the four — no `kinescope.io` — which is exactly what a non-clean `.next` looks like.)
- **Verify:** `node -e "console.log(require('./.next/images-manifest.json').images.remotePatterns.map(p=>p.hostname).join('\n'))"` · `grep -c 'wp\.invalid' .next/images-manifest.json` (expect 0)
- **Why:** `next.config.ts:54-66` evaluates `remotePatterns` at build time from `process.env.WP_BASE || 'https://wp.invalid'`, so a runtime-only variable allowlists nothing; `Dockerfile:30-42` and runbook §0.7 («every `next/image` request 400s on the deployed site»). No test exists over `next.config.ts` — grep for `remotePatterns` across `src/**/*.test.*` returns nothing. · **Covered by:** **gap**

#### OPS-03 · P0 · infra — Start the runner image cold and prove it boots, ships curl, and answers /health/ from inside

- **Given** the sha-tagged GHCR image (never `:stage`), `pnpm-workspace.yaml` present at the repo root, and Coolify's health check configured on `/health/` — with the trailing slash.
- **When** you `docker run` the image with the tier's env file, then probe from inside the container the way Coolify does, and probe the slashless form as the one-over case.
- **Then** the container stays up (no `Cannot find module '/app/server.js'` and no exit), `curl` resolves to a path inside it, `http://127.0.0.1:3000/health/` prints `200` with body `ok`, `http://127.0.0.1:3000/health` prints `308`, and Coolify reports the container `healthy`. In the build tree `.next/standalone/server.js` exists at the top level and `.next/standalone/app/` does not.
- **Verify:** `docker exec <c> which curl` · `docker exec <c> curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/health/` (200) · the same for `/health` (308) · `ls .next/standalone/server.js && test ! -d .next/standalone/app`
- **Why:** three separate defects meet on this one command. `outputFileTracingRoot: import.meta.dirname` (`next.config.ts:10-17`) is what flattens the standalone output the Dockerfile's `COPY --from=builder /app/.next/standalone ./` assumes; `node:22.16.0-slim` ships neither curl nor wget so `runner` installs it (`Dockerfile:65-69`); and `trailingSlash: true` makes `/health` a 308 (`src/app/health/route.ts:10-12`, runbook §4.6). `src/app/health/route.test.ts` calls the exported handler directly, so it can see the 200 body and never Next's normalisation or the container. · **Covered by:** **gap**

#### OPS-04 · P0 · build — Read SITE_URL out of the built artifact — one image cannot serve two tiers

- **Given** `SITE_URL` feeds `metadataBase`, every canonical, `sitemap.xml` and `robots.txt`, defaults to `https://obshee-delo.ru` in `src/shared/config/site.ts:13-15`, and is consumed at build time.
- **When** you build the image for a tier and read the generated robots body; separately build with the repo's own `.env` (which has no `SITE_URL` key — `grep -c '^SITE_URL=' .env` → 0) and watch what Compose interpolates.
- **Then** `.next/server/app/robots.txt.body`'s last line reads `Sitemap: https://new.obshee-delo.ru/sitemap.xml` for the stage image and `Sitemap: https://obshee-delo.ru/sitemap.xml` for prod's — never the WordPress host. The `.env` build prints `The "SITE_URL" variable is not set. Defaulting to a blank string.` and its image silently advertises prod. Measured on this checkout right now: the line reads `Sitemap: https://od.webtm.ru/sitemap.xml`, i.e. `WP_BASE` was passed as the site origin.
- **Verify:** `tail -1 .next/server/app/robots.txt.body` · `ENV_FILE=.env docker compose -f docker-compose-prod.yaml build 2>&1 | grep 'SITE_URL'` · `curl -s https://new.obshee-delo.ru/robots.txt | tail -1`
- **Why:** `docker-compose-prod.yaml:13` passes `SITE_URL: ${SITE_URL}` with no `:-` default (unlike `WP_MEDIA_CDN` on the line above), and `site.ts`'s `process.env.SITE_URL || DEFAULT_SITE_URL` turns the resulting empty string into prod's host. Runbook §4.1 (`SITE_URL` row), §4.7 («`SITE_URL` is baked at build time, so one image cannot serve both tiers»), `Dockerfile:30-36`. `site.test.ts` only checks URL shape against whatever resolved at module load. · **Covered by:** **gap**

#### OPS-06 · P0 · script — Re-run pnpm url:check against the deployed container as the post-cutover smoke gate

- **Given** the frontend serving the apex from the Coolify container, `WP_BASE` on the new WordPress install, `WP_LEGACY_BASE` on the frozen copy, and the Metrica «Страницы входа» export in `~/Documents/od/ya.metrika/`.
- **When** you replay the live site's top 200 real entry URLs against the deployed base URL, ranked by the entry visits each earns.
- **Then** «Entry-traffic coverage» is at least 99.0 % (stage measured 99.7 %: 197/200 URLs, 20 847/20 907 visits), the run exits 0 under `--fail-under 99`, and there is no _shape_ failure — at least one `/video/<segment>/`, one `/category/video/mult/`, one `/page/N/` and one `/<id>/` served, and nothing under `/category/` 404ing. Anything approaching 83.7 % means the A6 fallback is not serving at all.
- **Verify:** `pnpm url:check -- --base https://obshee-delo.ru --top 200 --fail-under 99`
- **Why:** runbook §5 gate 12 and §4.5 record the 99.7 % figure measured 2026-08-21 on `https://new.obshee-delo.ru`, with the three known misses (`/sms/`, two `draft` profiles). Since A6 this is the fallback's _only_ production signal — there is no alerting stack — so it is run after every deploy, not just before launch (`scripts/check-legacy-urls.mjs:175-178`). · **Covered by:** **gap**

#### OPS-07 · P0 · manual — Verify frozen.obshee-delo.ru is closed by Require ip — 403 outside, 200 from the container, never a 301

- **Given** after cutover: the frozen copy is the old un-migrated install on its own subdomain, still on PHP 7, fetched server-side by `loadLegacyDocument` and by nothing else.
- **When** you request a legacy page from a laptop, then the same page from inside the frontend container, then load an A6-fallback page through the apex.
- **Then** from outside: `403`. From inside the container: `200`, with `X-Robots-Tag: noindex, nofollow` on the response. The first response line is never a `301` — a blanket `frozen/* → frozen/` redirect would make all six iframe pages render the frozen copy's home page at 200. `https://obshee-delo.ru/actual/` shows real content in the frame, not a blank one. The `Require ip` line matches the container's own outbound address.
- **Verify:** `curl -sI https://frozen.obshee-delo.ru/team/ | head -1` (expect 403, not 301) · `docker exec <c> curl -sI https://frozen.obshee-delo.ru/team/ | head -1` (expect 200) · `docker exec <c> curl -s https://api.ipify.org` must equal the `Require ip` value
- **Why:** runbook §5.6 («frozen.obshee-delo.ru — closed to everything but the frontend») and §0.4 note 4. The outbound VPS address is not the A record `45.130.41.70`, which is why the IP is read from inside the container; and if that address ever changes the fallback fails totally, with `[legacy] upstream error` in the log (§0.7). PHP 8 on that install fatals in `welfare/functions.php:754` (§2.7), so the same drill re-runs after any host change. · **Covered by:** **gap**

#### OPS-09 · P1 · infra — Drill the A6 rollback: unset WP_LEGACY_BASE, restart, confirm ~170 pages return to a clean 404

- **Given** a tier where the fallback works — `/actual/` and `/добровольчество/` answer 200 through the iframe.
- **When** you remove `WP_LEGACY_BASE` from the tier's runtime env, restart the container (module-load read — an env edit alone changes nothing), then put it back and restart again.
- **Then** after the restart both paths answer 404 (not 500, not a blank 200), the log carries `[legacy] WP_LEGACY_BASE missing — legacy fallback disabled`, and `pnpm url:check` drops toward the pre-A6 83.7 % rather than erroring. After restoring the value and restarting, both answer 200 again and the warning is gone.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}\n' https://new.obshee-delo.ru/actual/` (404 while unset, 200 after) · `docker logs <c> 2>&1 | grep 'legacy fallback disabled'`
- **Why:** runbook §4.1: «Unset ⇒ the fallback is off and ~170 pages 404 exactly as before A6 — safe, and the rollback». It is the documented escape hatch for the whole feature and has never been exercised on a deployed tier; the restart requirement is the module-load contract in CLAUDE.md's Env vars section. · **Covered by:** **gap**

#### OPS-10 · P1 · infra — Separate the module-load env vars from the one per-request exception, on a running container

- **Given** the stage container running with `REVALIDATE_SECRET` deliberately unset (`POST /api/revalidate/` 503s) and `SITE_URL=https://new.obshee-delo.ru`.
- **When** you set `REVALIDATE_SECRET` in Coolify and do NOT redeploy or restart, then POST to `/api/revalidate/` with the matching `x-revalidate-secret`; then change `SITE_URL` in the same place, restart the container, and re-read `/robots.txt`.
- **Then** the POST goes from `503` to `200` with no restart at all. `/robots.txt` still names the OLD host after the restart — `SITE_URL` is baked into the bundle, so only a rebuild moves it. Any other variable (`WP_BASE`, `WP_LEGACY_BASE`, `WP_MEDIA_CDN`) needs the restart to take effect and a rebuild to change what was prerendered.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://new.obshee-delo.ru/api/revalidate/ -H "x-revalidate-secret: $S" -H 'content-type: application/json' -d '{"postId":39664}'` · `curl -s https://new.obshee-delo.ru/robots.txt | tail -1`
- **Why:** `src/app/api/revalidate/route.ts:30` is `force-dynamic` and reads the secret per request — the single documented exception to «all are read at module load» (CLAUDE.md Env vars, runbook §4.1). Getting this backwards is what produces «I changed the variable and nothing happened» on one var and «I changed it and it broke» on another, and it decides whether a tier change is a config edit or a rebuild. · **Covered by:** `src/app/api/revalidate/route.test.ts`

#### OPS-11 · P1 · infra — Confirm CI stays secretless and green, and that the image job runs only on main after a green ci

- **Given** `.github/workflows/ci.yml` with two jobs: `ci` (typegen → lint → type-check → test → build, no WP env) and `image` (`needs: ci`, `if: github.ref == 'refs/heads/main'`).
- **When** you open a pull request; then merge it to `main`; then push a commit that fails `pnpm test`.
- **Then** on the PR: `ci` is green and its Build step log contains `[httpClient] WP_BASE / WP_USER / WP_PASSWORD missing — using stub client; all WP requests return empty data.`, while `image` does not run. On `main`: `image` starts only after `ci` succeeds, and pushes both `:stage` and `:<sha>`. On the red commit: `image` never starts, so no tier receives it.
- **Verify:** `gh run list --branch main --workflow CI --limit 5` · `gh run view <id> --log | grep 'using stub client'` · `gh run view <id> --json jobs -q '.jobs[].name'`
- **Why:** the secretless verification build is deliberate (`.github/workflows/ci.yml:53-57`, with `needs`/`if` at :63-64) and is exactly why the three defects of 2026-08-21 — nested `server.js`, empty shell, `EAI_AGAIN` — reached the first image untouched (notes §A3b, runbook §4.7). This scenario pins the property CI _does_ guarantee, so the gates it cannot see (OPS-01, OPS-02, OPS-03) stay accounted for rather than assumed. · **Covered by:** **gap**

#### OPS-12 · P1 · infra — Prove the shipped public image carries no WP application password and no .env layer

- **Given** `ghcr.io/obshee-delo-it/od-frontend` is a PUBLIC package (which is why the VPS needs no registry credentials), and `WP_USER`/`WP_PASSWORD` are `ARG`+`ENV` in the `builder` stage only.
- **When** you inspect the pushed sha-tagged image's history and manifest, and look for `/app/.env` inside the running filesystem, as an anonymous puller.
- **Then** `docker history --no-trunc` contains 0 matches for `WP_PASSWORD` or `WP_USER`; the raw manifest contains 0 in-toto/provenance attestations; `/app/.env` does not exist; and `docker logout ghcr.io && docker pull` succeeds without credentials.
- **Verify:** `docker history --no-trunc ghcr.io/obshee-delo-it/od-frontend:<sha> | grep -ci 'WP_PASSWORD\|WP_USER'` (0) · `docker buildx imagetools inspect ghcr.io/obshee-delo-it/od-frontend:<sha> --raw | grep -c in-toto` (0) · `docker run --rm ghcr.io/obshee-delo-it/od-frontend:<sha> node -e "console.log(require('fs').existsSync('/app/.env'))"` (false)
- **Why:** three separate guards hold this together and each has failed once in this project's class: `provenance: false` at `.github/workflows/ci.yml:112`, because a buildx provenance attestation records build args and would publish the application password on a public package (notes §A3b); nothing from `builder` reaching `runner` (`Dockerfile:52-55`, «Never move them below»); and `.dockerignore`, which was named `.docerkignore` until 2026-08-04 while the Dockerfile does `COPY . .` (runbook §4.7). · **Covered by:** **gap**

#### OPS-13 · P1 · infra — Recreate the ISR volume from scratch and confirm /app/.next/cache is nextjs-owned and writable

- **Given** a persistent Docker volume mounted at `/app/.next/cache`, and the runner stage creating and chowning that directory before `USER nextjs`.
- **When** you remove the named volume so Docker must seed a fresh one from the image directory, redeploy, then load `/` and `/video/` twice each.
- **Then** `stat -c '%U'` on `/app/.next/cache` inside the container prints `nextjs`; after the page loads the directory holds `fetch-cache` and `images`; and the container log contains no `EACCES`. If the chown line is removed from the Dockerfile the fresh volume mounts root-owned and every ISR write fails at runtime while the container still reports healthy.
- **Verify:** `docker exec <c> stat -c '%U %a' /app/.next/cache` (expect `nextjs`) · `docker exec <c> ls /app/.next/cache` (expect `fetch-cache`, `images`) · `docker logs <c> 2>&1 | grep -c EACCES` (expect 0)
- **Why:** `Dockerfile:74-78`: «Docker seeds a fresh named volume from the image's directory — including its ownership — so the directory has to exist here and belong to `nextjs`». One of the three Dockerfile changes that came with A3b (notes §A3b), verified on the deployed tier 2026-08-21 with `.next/cache` owned by `nextjs` and already holding `fetch-cache` + `images`. Nothing in CI runs the built image, so this only ever fails on a tier. · **Covered by:** **gap**

#### OPS-14 · P2 · build — Check the pnpm and Node pins agree across all three places that hold them

- **Given** pnpm 11.3.0 is pinned in three files and in none of the usual one: `package.json` has no `packageManager` field at all (`grep -c packageManager package.json` → 0), and the lockfile is `lockfileVersion: '9.0'`.
- **When** you read the three pins, then build the image and read the Node version it actually runs.
- **Then** `Dockerfile:10` says `corepack use pnpm@11.3.0`, `.github/workflows/ci.yml:30` says `version: 11.3.0`, `README.md:40` says `pnpm@11.3.0` — all three identical; `docker run --rm <image> node -v` prints `v22.16.0`, matching `.nvmrc`; and `pnpm install --frozen-lockfile` succeeds in both `deps` and CI. A mismatch surfaces as a `--frozen-lockfile` failure in one of the two places only.
- **Verify:** `grep -n 'pnpm@' Dockerfile README.md` · `grep -n 'version:' .github/workflows/ci.yml` · `grep -c packageManager package.json` (0 today) · `docker run --rm ghcr.io/obshee-delo-it/od-frontend:<sha> node -v`
- **Why:** CLAUDE.md pins Node in `.nvmrc` and «pnpm@11.3.0 (enforced in the Dockerfile via corepack)», but the enforcement is three hand-kept copies rather than the `packageManager` field corepack reads from the manifest — so the image, CI and the README can drift apart while every one of them looks pinned. `pnpm-workspace.yaml` additionally holds the config pnpm 11 no longer reads from `package.json`. · **Covered by:** **gap**

#### OPS-15 · P2 · infra — Run the documented Docker dev command — `docker compose up frontend-local` fails to resolve today

- **Given** CLAUDE.md documents `docker-compose up --build frontend-local` (the `dev` target, repo mounted). `docker-compose.yml` defines only `frontend-local`, which does `extends: { service: frontend }` with no `file:` key, while `frontend` lives in `docker-compose-prod.yaml`.
- **When** you resolve the config the way Compose does, from the repo root, with the default file set and with both files passed explicitly.
- **Then** both fail with exactly `cannot extend service "frontend-local" in /home/alexey/Projects/od-frontend/docker-compose.yml: service "frontend" not found` — measured 2026-08-22. Fixed, `docker compose config` prints a `frontend-local` service with `target: dev`, port 3000:3000 and the repo bind-mount.
- **Verify:** `docker compose config | head -20` · `docker compose -f docker-compose-prod.yaml -f docker-compose.yml config | head -20`
- **Why:** `extends` resolves `service:` within the same file unless `file:` names another, so the documented dev path has been non-functional; `docker-compose-prod.yaml` (the file that actually works, via `ENV_FILE=.env.stage docker compose -f docker-compose-prod.yaml`) is where `frontend` is declared. Low blast radius — nobody deploys with it — but it is the command a new contributor runs first, and CLAUDE.md's Commands section advertises it. · **Covered by:** **gap**

#### OPS-16 · P2 · infra — Test the Coolify deploy poll at its 10-minute bound and confirm the tag-pin rollback path

- **Given** the `image` job PATCHes `docker_registry_image_tag` to the commit sha BEFORE it POSTs the deploy, then polls `/deployments/<uuid>` with `for _ in $(seq 60)` and `sleep 10` — a hard 10-minute budget.
- **When** you let a deploy finish inside the budget; then consider one that exceeds it (a slow pull, a queued job); then perform a rollback.
- **Then** inside the budget the workflow exits 0 on `finished` and the application reports the sha it was pinned to. Over the budget the workflow exits 1 with `still <status> after 10 min — check https://coolify.obshee-delo.ru` while the deploy may still complete, and the application is left pinned to the untested sha — so a later manual redeploy pulls it. Rollback is the same PATCH with an older sha, and the application's `docker_registry_image_tag` reads that older sha afterwards.
- **Verify:** `curl -fsS -H "Authorization: Bearer $TOKEN" https://coolify.obshee-delo.ru/api/v1/applications/$APP | jq -r .docker_registry_image_tag` · `gh run view <id> --log | grep -E 'deployment |finished|still '`
- **Why:** the deploy step at `.github/workflows/ci.yml:125-141` and notes §A3b: the poll exists because «the API answers as soon as the job is queued, so without this the workflow goes green on a deploy that failed», and «Rollback is the same PATCH with an older sha». The token needs `read` as well as `write,deploy` for the poll — that returned `403 {"message":"Missing required permissions: read"}` on the first attempt — so a token rotation can break exactly this step and nothing else. · **Covered by:** **gap**

#### OPS-17 · P2 · build — Keep the base image Debian: prerender completes with zero getaddrinfo EAI_AGAIN

- **Given** `FROM node:22.16.0-slim` (not Alpine), with `staticGenerationRetryCount: 3` and `staticGenerationMaxConcurrency: 4` in `next.config.ts:77-80` because the WP origin 503s under the default parallel prerender.
- **When** you build the image end to end and read the build log's prerender phase; then check what the runner actually runs.
- **Then** the log contains 0 occurrences of `EAI_AGAIN`, the static-page count matches the previous build (52/52 measured 2026-08-21; `.next/prerender-manifest.json` holds 46 route entries on the current checkout) rather than silently dropping, and `cat /etc/os-release` inside the image reports Debian. Switching the base to `-alpine` reproduces the failure part way through the prerender on a machine whose DNS is otherwise fine.
- **Verify:** `docker build --target builder --progress=plain . 2>&1 | grep -c EAI_AGAIN` (expect 0) · `docker run --rm ghcr.io/obshee-delo-it/od-frontend:<sha> head -1 /etc/os-release` · `node -e "console.log(Object.keys(require('./.next/prerender-manifest.json').routes).length)"`
- **Why:** `Dockerfile:1-7` records the measurement: «musl's resolver does not retry and does not cache, so the prerender — which makes hundreds of requests to WordPress from a few parallel workers — dies part way through with `getaddrinfo EAI_AGAIN`, reproducibly… `--network host` does not help». Runbook §0.7 and §4.5 carry the same row. A silently smaller prerender count is the quieter half of the same failure: retries exhausted rather than the build dying. · **Covered by:** **gap**

#### GAP-05 · P1 · script — Pin scripts/lib/wp.mjs's duplicate film-category ids to filmCategories.ts

- **Given** `src/shared/config/filmCategories.ts` is documented as the single source of truth for the four WP category ids, and `scripts/lib/wp.mjs:9` keeps its own copy (`FILM_CATEGORY_IDS = [581, 580, 86, 559]`, a bare array with no segment keys) because zero-dep Node cannot import TypeScript. Nothing links them. The ids are per-environment, so repointing `WP_BASE` at stage or prod is exactly when both copies must change.
- **When** you extract both id sets and compare them; then simulate the drift — change one id in `scripts/lib/wp.mjs` only and run `pnpm film:export`, and change one in `filmCategories.ts` only and run the vitest suite.
- **Then** the two sets are equal as sets (`559,580,581,86` on both sides today). Under drift, `pnpm film:export` writes a worksheet with zero or wrong rows while every frontend test stays green, and the frontend serves the wrong films while `film:import --apply` would write metadata onto posts that are not in the catalogue. A check that fails on either drift direction is the deliverable — a node one-liner in `pnpm test` or a line in the film scripts' own preflight.
- **Verify:** `node -e "const fs=require('fs');const t=fs.readFileSync('src/shared/config/filmCategories.ts','utf8');const s=fs.readFileSync('scripts/lib/wp.mjs','utf8');const a=[...t.matchAll(/(?:filmy|multy|roliki|'famous-people'):\s*(\d+)/g)].map(m=>+m[1]).sort();const b=JSON.parse(s.match(/FILM_CATEGORY_IDS = (\[[^\]]+\])/)[1]).sort();console.log(a.join(',')+' | '+b.join(','))"`
- **Why:** ROUTE-13's `why` names the hazard and then says «which no test links to this one»; CLAUDE.md names it twice and the runbook lists «pnpm film:export writes an empty worksheet» as a symptom in §0.7. It is the only place in the repo where a documented single source of truth has a second copy with no gate, and B5 — repointing `WP_BASE` — is the change that trips it. · **Covered by:** **gap**

#### GAP-06 · P1 · script — Regenerate the WP types and survive all three of generate:types' documented traps

- **Given** `pnpm generate:types` is `scripts/generate-wp-types.mjs`, a wrapper whose three jobs are three recorded lost afternoons: it rewrites the eight `view-config` properties WP 7.1 declares as `[]` where a schema object belongs (openapi-typescript stops at the first with «Expected Schema Object or boolean, got Array») while leaving the 39 legal `default: []` alone; it runs the generator from a scratch directory because `redocly.yml` otherwise wins over any CLI argument and silently generates the _config's_ host into the committed file; and it runs Prettier because the CLI emits double quotes and 4-space indent, burying the real diff in ~35 000 lines. The committed types come from od-stage (`redocly.yml` → `root: https://od.webtm.ru/wp-json-openapi`). CI runs `next typegen` and never this.
- **When** you run it three ways against a clean tree: bare; with `-- --from <another tier>`; and with the schema patcher stubbed out. Diff the committed `src/types/generated/wp-json-openapi.ts` each time.
- **Then** the bare run reproduces the committed file byte-for-byte (or the diff is only the intended schema change) and prints one line per patched pointer. The `--from` run generates _that_ tier's host, not `redocly.yml`'s. With the patcher stubbed, the command fails loudly on the first `[]` rather than emitting a partial file. A run that reformats 35 000 lines means Prettier did not fire; a run whose paths name the redocly host means the scratch-directory guard broke.
- **Verify:** `pnpm generate:types && git diff --stat src/types/generated/wp-json-openapi.ts`
- **Why:** no scenario in the catalogue touches the generated types or the script that writes them, and nothing in CI does either — so all three traps are guarded only by prose in CLAUDE.md. The failure is quiet in the worst way: a regenerate that picks up `redocly.yml`'s host commits a type surface describing a different WordPress, and `pnpm type-check` passes because the shapes are close enough. · **Covered by:** **gap**

#### GAP-08 · P1 · script — Re-run the two census scripts and reconcile them with the docs they wrote

- **Given** three published counts disagree today. `regions.generated.ts` holds 82 regions with **53** linked and 29 grey; `src/modules/RussiaMap/RussiaMap.tsx:8` says «70 of them»; `docs/page-inventory.md` says «70 of them linked» in §5 and «52 linked regions, 30 drawn but not clickable» in its 404-bucket paragraph; runbook §5 gate 17 (`docs/prod-migration-runbook.md:812`) expects 52/30. `pnpm pages:inventory` and `pnpm legacy:sweep` are the scripts that derive every «how many pages are redesigned» number the catalogue leans on, and no scenario runs either.
- **When** you run `pnpm pages:inventory` against the tier's own `WP_BASE`, `pnpm legacy:sweep`, and `pnpm map:generate --dry-run`, then diff each output against the dated tables in `docs/page-inventory.md` and the region counts in the two source comments.
- **Then** every bucket in the inventory (redesigned / passthrough / iframe, each traffic-weighted) matches the doc for that tier or the doc is re-dated in the same commit; the sweep reports 0 unexpected pages and 0 links still on the legacy origin outside the `wp-content`-shaped allowlist; and the map's linked/grey split matches `regions.generated.ts`, `RussiaMap.tsx`'s docstring and gate 17 — one number, not four.
- **Verify:** `node --env-file=.env.stage scripts/page-inventory.mjs && pnpm legacy:sweep && node --env-file=.env.stage scripts/generate-russia-map.mjs --dry-run`
- **Why:** CLAUDE.md's instruction for these scripts is «Re-run it instead of trusting a table», and A11Y-05 and JRN-05 both had to route around the stale «70». The counts are load-bearing — SEO-02's 8 426 locs, ROUTE-12's 153-of-168, PERF-13's 0.5 % of entries — so a catalogue that never re-derives them inherits whatever drifted. This is the cheapest scenario in the set and it re-grounds a dozen others. · **Covered by:** **gap**

#### GAP-09 · P0 · infra — Reach WordPress from the frontend container once wp.obshee-delo.ru is IP-allowlisted

- **Given** runbook §5.6 puts `Require ip` (frontend VPS only) on `wp.obshee-delo.ru` after cutover. The frontend reads that host on every ISR rebuild, with credentials built at module load. The outbound address of the container is not the host's A record — OPS-07 already establishes that for the frozen copy — and a 403 is not the 401 DATA-05 models: the typed client throws (taking the root layout down) while `wpFetch` returns an empty listing, so half the site 500s and half serves empty shells at 200 for an hour.
- **When** after the allowlist lands: `docker exec <container> curl -sI "$WP_BASE/wp-json/wp/v2/posts?per_page=1"`; the same from a laptop; and `docker exec <container> curl -s https://api.ipify.org` compared against the `Require ip` value. Then force a rebuild of one route (`POST /api/revalidate/`) and read it.
- **Then** from inside the container: 200. From off-VPS: 403. The allowlisted address equals the container's own outbound address, not the DNS A record. The forced rebuild renders real content — a header with three nav labels and six footer `<aside>`s — rather than an empty shell. Any 403 from inside blocks cutover: it produces exactly the empty-shell-at-200 that OPS-01 measures, on every route, with nothing in the frontend log but a stub warning that is not printed at runtime.
- **Verify:** `docker exec <c> curl -s -o /dev/null -w '%{http_code}\n' -u "$WP_USER:$WP_PASSWORD" "$WP_BASE/wp-json/wp/v2/posts?per_page=1"; docker exec <c> curl -s https://api.ipify.org`
- **Why:** SEC-07 covers what the allowlist does to _social crawlers_ fetching `og:image`; OPS-07 runs this exact drill for `frozen.obshee-delo.ru` and not for the WordPress host the whole app reads. Two lenses each assumed the other owned the app's own egress to WP. It is the single change most likely to be made after cutover, by a different person, on a day when the previous ISR entries still make the site look fine. · **Covered by:** **gap**

## 11. End-user journeys & editorial-content regression

_Does a real visitor get from a landing page to the thing they came for — and does what an editor publishes, unpublishes or types badly arrive the way they meant it to?_

#### JRN-01 · P0 · e2e — Walk home page → film card → player and reach a playable film

- **Given** a production build (`pnpm build && pnpm start -p 3100`, clean `.next`) pointed at od-stage via `.env.stage`, browser at 1440×900. The home row is scoped to `HOME_FILM_CATEGORY_IDS` (581 «Фильмы» + 580 «Мультфильмы») and shows `FILMS_ON_HOME = 12`.
- **When** you open `/`, read the «Наши фильмы и мультфильмы» row, click the first card, then activate the player.
- **Then** the row holds exactly 12 cards; every card `href` matches `^/\d+$`; the CTA reads «Все видео (83)» — the whole catalogue, not the row's 12 — and links to `/video/` with zero redirect hops. The film page shows the card's title as `<h1>`, breadcrumb «Видео», and either an `<iframe src^="https://kinescope.io/embed/">` or a «Смотреть онлайн» overlay — never an empty 16:9 box. None of the 12 titles is an event report (each also appears on `/video/filmy/` or `/video/multy/`).
- **Verify:** `pnpm test:e2e -- home` once the journey is added; today by hand: open `http://localhost:3100/`, then `curl -s http://localhost:3100/71933/ | grep -o 'kinescope.io/embed/[A-Za-z0-9]*'`
- **Why:** `src/app/page.tsx:46,49` (FILMS_ON_HOME=12) + `src/shared/config/filmCategories.ts:75` (HOME_FILM_CATEGORY_IDS); the CTA's catalogue count is `src/modules/Home/sections/FilmsCarousel.tsx:62` fed by `src/shared/api/fetchFilms.ts:58,62`; the player's three-way fallback is `src/modules/Video/FilmPlayer/FilmPlayer.tsx:25,47,66`. Runbook §5 gates 1/3/4. `e2e/` holds only `home.spec.ts` and `legacy-embed.spec.ts` — no browser test ever opens a film page. · **Covered by:** **gap**

#### JRN-03 · P0 · manual — Land from search on /category/video/mult/ and see «Мультфильмы», not the whole catalogue

- **Given** the deployed tier. `/category/video/mult/` carries 256 entry visits in 91 days on its own; `/category/novosti/` is the news half of the same family.
- **When** you follow each URL with redirects enabled, then count the rendered cards and read the active filter.
- **Then** exactly **one 301 hop** each — to `/video/multy/` and `/news/?category=nashi-dela`. `/video/multy/` renders the «Мультфильмы» card count that WP reports for `categories=580` (never the whole catalogue's 83) and its «Мультфильмы» tab carries `aria-current`; `/news/?category=nashi-dela` renders 15 cards with «Наши дела» as the active chip. A count equal to the unfiltered total is the failure — status is 200 either way.
- **Verify:** `curl -sI -L -o /dev/null -w '%{num_redirects} %{url_effective}\n' https://new.obshee-delo.ru/category/video/mult/`; then `curl -s https://new.obshee-delo.ru/video/multy/ | grep -c 'О фильме'` against `curl -sI -u "$WP_USER:$WP_PASSWORD" "$WP_BASE/wp-json/wp/v2/posts?format=video&categories=580&per_page=1" | grep -i x-wp-total`
- **Why:** `src/shared/config/legacyRedirects.ts` (`WP_CATEGORY_ALIASES` maps `mult`→`multy`, `NEWS_CATEGORY_ALIASES` the `novosti` case); the filter-degrades-to-«Все» bug shipped twice during A8 (`src/shared/config/newsCategories.ts:5-9`), and runbook §5 gate 12 says «A redirect answering 200 is not proof it worked». `legacyRedirects.test.ts` asserts no destination carries a numeric id; nothing compares a rendered count against WP. · **Covered by:** `src/shared/config/legacyRedirects.test.ts`

#### JRN-04 · P0 · e2e — Run the home journey gate green against HEAD before trusting any other e2e result

- **Given** `pnpm dev` on localhost:3000, `pnpm test:e2e -- home`, both Playwright projects (desktop-1440 and mobile-390). e2e is not in CI, so nothing has run this spec since the components moved under it.
- **When** you run the spec and compare each asserted string against what the component renders today.
- **Then** all four tests pass on both projects. Today two of the four fail: `e2e/home.spec.ts:13` asserts the heading «Наши фильмы, мультфильмы и ролики» while `FilmsCarousel.tsx:25` renders «Наши фильмы и мультфильмы», and `e2e/home.spec.ts:21,33-43` assert «Подписаться на новости» and the «Подписаться» button while `NEWSLETTER_SIGNUP_ENABLED = false` renders nothing at all. Until both are reconciled the only browser journey gate this repo owns is red for non-defect reasons.
- **Verify:** `pnpm dev` then `pnpm test:e2e -- home`; the drift itself: `grep -n 'Наши фильмы' e2e/home.spec.ts src/modules/Home/sections/FilmsCarousel.tsx`
- **Why:** commits f6a26d7 / dc7fc9f rescoped the home film row and its heading; `src/shared/config/features.ts:19` gates the newsletter off. CLAUDE.md marks `pnpm test:e2e` as **not** in CI, which is exactly how a spec drifts three commits behind the components it guards. · **Covered by:** `e2e/home.spec.ts`

#### JRN-05 · P0 · script — Reach a regional contact page from every clickable region of the /contacts/ map

- **Given** the deployed tier. `src/modules/RussiaMap/regions.generated.ts` currently holds 82 regions, **53 linked and 29 greyed**, while runbook §5 gate 17 expects **52/30 against the prod clone** — production publishes 57 children of `/contacts/` where od-dev publishes 75.
- **When** you run `pnpm map:generate --dry-run` against the tier's own `WP_BASE`, then request every `href` in the table.
- **Then** the dry run exits 0 and prints 52 linked / 30 grey on od-stage. Every linked href answers 200 from `modules/WpPage` — the body carries the region's «Об отделении» branch card and its coordinator cards — and **none** falls through to `modules/Legacy/LegacyEmbed` or 404s. Each href over the expected split is one region whose page this tier does not publish; `/contacts/chechnya/` is the known case, its page being in production's trash.
- **Verify:** `node --env-file=.env.stage scripts/generate-russia-map.mjs --dry-run`, then `for h in $(grep -o '/contacts/[a-z-]*/' src/modules/RussiaMap/regions.generated.ts | sort -u); do curl -s -o /dev/null -w "%{http_code} $h\n" https://new.obshee-delo.ru$h; done`
- **Why:** `docs/prod-migration-runbook.md` §5 gate 17 (line 812, «52/30 on the clone») and §0.7 («57 region pages against od-dev's 75»); `docs/page-inventory.md:43` — eighteen regional URLs sit in the 404 bucket today and the live site links them from its own map. `RussiaMap.test.tsx` checks the table against a hand-written **od-dev** page set, which by construction cannot see prod's smaller one. · **Covered by:** `src/modules/RussiaMap/RussiaMap.test.tsx`

#### JRN-06 · P1 · e2e — Browse /video/ → a category → a film → a related film without leaving the catalogue

- **Given** the deployed tier at 1440×900. `/video/` and `/video/<segment>/` are the #2 and #3 entry pages on the site; the catalogue renders `PER_PAGE = 10`.
- **When** you open `/video/`, click the «Фильмы» tab, open the first card's «О фильме», then open the first card of the «Рекомендуем к посмотру» strip.
- **Then** `/video/` shows 10 cards plus pagination; the tab reaches `/video/filmy/` with **no** redirect hop, H1 «Фильмы» and breadcrumbs «Главная / Видео / Фильмы». The film page's related strip holds at most 3 cards, none of them the film itself, and each shares a catalogue category with it. The related card lands on `/<id>/` and renders the film layout (breadcrumb «Видео», a player region), not the news article layout.
- **Verify:** browser walk on `https://new.obshee-delo.ru/video/`; counts by `curl -s https://new.obshee-delo.ru/video/ | grep -c 'О фильме'` (expect 10) and `curl -s https://new.obshee-delo.ru/71933/ | grep -c 'Рекомендуем к посмотру'` (expect 1)
- **Why:** `src/modules/Video/VideoCatalogue/VideoCatalogue.tsx:18` (PER_PAGE=10) and `src/modules/Video/FilmPage/FilmPage.tsx:60,63,67` (related scoped by `ALL_FILM_CATEGORY_IDS`, self filtered out, sliced to 3); runbook §5 gates 1-3. `VideoCatalogue.test.ts` covers only `cataloguePage` and `catalogueMetadata` — nothing renders the catalogue or a film page. · **Covered by:** **gap**

#### JRN-07 · P1 · e2e — Filter /news/, page to 3, open an article and follow an in-body link without leaving the site

- **Given** the deployed tier. `/news/` renders `PER_PAGE = 15`; article bodies come from WordPress with **absolute** WP-origin hrefs that `resolveContentLinks` rewrites.
- **When** you open `/news/`, click the «Наши дела» chip, go to page 3, open the first card, then click an in-body link that points at another page of this site.
- **Then** `/news/` shows 15 cards; the chip's href is `/news?category=nashi-dela` and it carries `aria-current`; page 3 shows 15 cards none of which appeared on page 1, with «3» marked current. The article renders an `<h1>`, a date and the «Похожие новости» rail. The in-body link keeps the browser on the site origin — no href in the body still points at the WordPress host except those under `/wp-content/`, `/wp-admin/`, `/wp-includes/`, `/wp-json/`.
- **Verify:** browser walk; `curl -s 'https://new.obshee-delo.ru/news/?page=3' | grep -o 'href="/[0-9]\{4,\}"' | sort -u | wc -l` (expect 15); `curl -s https://new.obshee-delo.ru/71933/ | grep -o 'href="https\?://[^"]*obshee-delo[^"]*"' | sort -u`
- **Why:** `src/app/news/page.tsx:13` (PER_PAGE=15) and `src/shared/lib/wpContent/resolveContentLinks.ts:14,55-60` (`WP_ONLY_PATH`, D6c/D6d — 12 724 such hrefs across 5 052 posts on od-dev). `resolveContentLinks.test.ts` covers the transform over strings; nothing renders an article and follows a link, and there is no test file for `app/news/page.tsx`. · **Covered by:** `src/shared/lib/wpContent/resolveContentLinks.test.ts`

#### JRN-10 · P1 · e2e — Read a real A6-iframe page through to the end, then press Back

- **Given** `WP_LEGACY_BASE` set on the deployed tier. `/get-involved/` is the biggest remaining iframe page — 586 pageviews / 84 entry visits in 91 days, and 6 of 168 pages are still on the list.
- **When** you load `/get-involved/`, scroll to the bottom of the framed content, click a tile inside the frame, then press browser Back.
- **Then** exactly one iframe with a non-empty Russian `title`; its height grows to the framed document's `scrollHeight`, so the last element of the old page is reachable without an inner scrollbar. The in-frame click navigates the **top** window to a path on this site's origin, never to the frozen copy. After Back, the frame is re-sized rather than cropped — the measured regression was 540px around 2149px of content, permanently. No `[legacy] boundary miss for /get-involved/` in the container log.
- **Verify:** `pnpm test:e2e -- legacy-embed` (fixture-based), then the same walk by hand on `https://new.obshee-delo.ru/get-involved/`; `docker logs <container> | grep '^\[legacy\]'`
- **Why:** commit b8fa172 («back-navigation left the frame cropped at 540px around 2149px of page»); `docs/implementation-notes.md` §A6; verification-plan V8/V17/V20. `/get-involved/` is on `src/shared/config/legacyEmbedPages.ts:81`. The e2e suite covers this against a committed fixture and **is not in CI**; nothing exercises a real legacy page end to end. · **Covered by:** `e2e/legacy-embed.spec.ts`

#### JRN-11 · P1 · manual — Download a printable poster from /materials/plakati/ and get the file, not a 404

- **Given** `/materials/plakati/` — the site's #6 entry page, carrying 33 `/wp-content/` download links and the heaviest cmsms markup. It renders natively now (redesigned bucket), so its links go through `resolveContentLinks`.
- **When** you click a poster thumbnail, then click its download link; separately, tab through the three covers on `/materials/metodichki/`.
- **Then** the thumbnail opens the lightbox and does not navigate. Every download `href` is **absolute** on the WordPress host and `https` — none is root-relative (which resolves against this origin and 404s) and none is `http://metodic.obshee-delo.ru/…` (a 301 plus a mixed scheme). Each answers 200 with a non-HTML content type. On `/materials/metodichki/` each cover is **one** tab stop carrying `aria-label="Подробнее: <alt>"`, not two anchors announcing «Подробнее» three times with nothing to tell them apart.
- **Verify:** `curl -s https://new.obshee-delo.ru/materials/plakati/ | grep -o 'href="[^"]*wp-content[^"]*"' | sort -u | wc -l` (expect 33), `curl -s … | grep -c 'href="/wp-content'` (expect 0), then `curl -sI` the first five hrefs
- **Why:** `src/shared/legacy/__fixtures__/README.md:10,52` (33 `/wp-content/` links, #6 entry page); `src/shared/lib/wpContent/resolveContentLinks.ts:14,55-60` (`WP_ONLY_PATH`, D6d); `wp/scripts/od-pages.php:1567` `od_cover_link_names` and `:1614` `od_https_own_links` from commit e30256e, whose findings were exactly duplicate tab stops and one `http://` hop. · **Covered by:** `src/shared/lib/wpContent/resolveContentLinks.test.ts`

#### JRN-12 · P1 · e2e — Serve a film with no player, no poster and no downloads without an empty shell

- **Given** od-stage. 36 of its 86 catalogue films had neither a featured image nor a body image; the Kinescope-still fallback covers 31, and the remaining **five have no player either** — those five are the case.
- **When** you open one of the five at `/<id>/`, and find the same film's card on `/video/`.
- **Then** the page shows an `<h1>` with the title and the «Видео» breadcrumb; **no** empty 16:9 frame, **no** empty download-pill strip, **no** poster card with a blank image, and no `next/image` request returning 400 in the network log. The «Рекомендуем к посмотру» strip still offers a way onward. The card on `/video/` shows a Kinescope still or a deliberate placeholder — never an empty box.
- **Verify:** pick a row from `node --env-file=.env.stage scripts/export-film-worksheet.mjs` (`pnpm film:export`) with `kinescope_id` and cover both empty, open `https://new.obshee-delo.ru/<id>/`; runbook §5 gate 8
- **Why:** `src/modules/Video/FilmPlayer/FilmPlayer.tsx:65-67` returns `null` with neither stream nor poster; `src/modules/Video/FilmPage/FilmPage.tsx:92,124` gates the poster card on `hasPosterCard`; `src/shared/api/fetchVideoList.ts:67-70` documents «36 of the 86 … 31 of those have a player, so this fills all but five» (B-VIDEO2). `FilmPlayer.test.tsx` and `FilmActions.test.tsx` cover the components; no test renders the assembled page. · **Covered by:** `src/modules/Video/FilmPlayer/FilmPlayer.test.tsx`

#### JRN-13 · P1 · e2e — Open a coordinator's profile from a regional page, including a Cyrillic slug

- **Given** the deployed tier. `/profile/*` retired the A6 iframe for the whole family (566 entry visits in 91 days); 121 of the 139 records say more than the card's four fields. WordPress stores Cyrillic slugs percent-encoded and Next hands route params percent-encoded.
- **When** you open `/contacts/amurskaya/` and click a coordinator's name; then request `/profile/дегтярёв-алексей-анатольевич/` directly in the address bar; then request a slug with no published record.
- **Then** the first two land on `/profile/<slug>/` at 200 with a `PersonCard` (name, subtitle, photo, contact rows) and, where the record says more, a body below it. Neither shows the old theme's «Детали» sidebar, its like counter or its comment form. The unpublished slug returns **404**, not the legacy iframe. The Cyrillic case must answer identically to an ASCII one.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}\n' 'https://new.obshee-delo.ru/profile/%D0%B4%D0%B5%D0%B3%D1%82%D1%8F%D1%80%D1%91%D0%B2-%D0%B0%D0%BB%D0%B5%D0%BA%D1%81%D0%B5%D0%B9-%D0%B0%D0%BD%D0%B0%D1%82%D0%BE%D0%BB%D1%8C%D0%B5%D0%B2%D0%B8%D1%87/'`
- **Why:** `src/app/profile/[slug]/page.tsx:51-70` (what the route retires, and the deliberate 404 at `:75`); commit d8bcada 404'd **every** Cyrillic URL and survived 515 unit tests plus a 172-page sweep because no fixture anywhere in the suite is non-ASCII — `pnpm url:check` was the only thing that found it. · **Covered by:** `src/shared/api/fetchProfile.test.ts`

#### JRN-14 · P1 · e2e — Complete the home → film journey on a 390px phone, menu included

- **Given** Playwright project `mobile-390` (390×844, `hasTouch: true`) — it exists in `playwright.config.ts` but only `home.spec.ts` runs in it, and that spec never navigates.
- **When** you open `/`, open the burger menu, close it, swipe the film row, open a film, activate the player.
- **Then** the row shows 1.1 slides (the `0:` breakpoint) and a swipe advances it. The burger opens a menu containing «Оказать помощь» and, once closed, leaves `document.body.style.overflow` empty rather than `hidden`. `document.documentElement.scrollWidth === 390` on both `/` and the film page — the journey never requires horizontal scrolling. The player is visible and tappable without zooming.
- **Verify:** `pnpm test:e2e --project=mobile-390`
- **Why:** `playwright.config.ts:20-25` defines the viewport; `src/modules/Home/sections/FilmsCarousel.tsx:33` sets `0: { slidesPerView: 1.1 }`; `src/modules/Header/HeaderClient.tsx:60` sets `document.body.style.overflow = 'hidden'` when the menu opens, so a mis-cleaned close locks the page. Runbook §5 gate 10 asks for 375px and 1440px on `/video/` and one film page by hand. · **Covered by:** `e2e/home.spec.ts`

#### JRN-16 · P2 · e2e — Leave a way out when a page number is past the last page

- **Given** `/video/filmy/` (od-dev: 23 films, 10 per page → 3 pages) and `/news/` (15 per page). WordPress answers a 400 for an out-of-range page, which both fetchers turn into `{ items: [], totalPages: 0 }`.
- **When** you request the last page, then one page over it, then `?page=abc`.
- **Then** the last page renders its remaining cards with pagination present. One over answers **200** with «Фильмов не найдено.» / «Новостей не найдено.», and the filter tabs, breadcrumbs and header/footer are still rendered so the visitor is not stranded; the pagination control is absent (`totalPages <= 1`). `?page=abc` renders page 1 and is byte-identical in card set to the bare URL.
- **Verify:** `curl -s -w '\n%{http_code}\n' 'https://new.obshee-delo.ru/video/filmy/?page=4' | grep -c 'Фильмов не найдено.'`; `curl -s 'https://new.obshee-delo.ru/news/?page=999' | grep -c 'Новостей не найдено.'`
- **Why:** `src/shared/api/fetchVideoList.ts:179` and `src/shared/api/fetchNewsList.ts:49` swallow WP's 400; `src/shared/ui/components/Pagination/Pagination.tsx:19-20` returns `null` at `totalPages <= 1`; the empty copy lives at `VideoCatalogue.tsx:158` («Фильмов не найдено.») and `modules/News/NewsGrid/NewsGrid.tsx:18` («Новостей не найдено.»). `VideoCatalogue.test.ts:11` covers `cataloguePage`'s clamp only — nothing renders either empty state. · **Covered by:** `src/modules/Video/VideoCatalogue/VideoCatalogue.test.ts`

#### JRN-17 · P2 · manual — Keep the dead donation link out of the footer while /sp/ itself stays reachable

- **Given** both tiers. The «ССЫЛКИ» footer widget lost its `<li><a href="/sp/">Благотворительная акция</a></li>` at the source on 2026-08-15 — 9 `<li>` → 8 on prod, 8 → 7 on od-dev — and the frontend guard that briefly hid it (`HIDDEN_HREFS`) was deleted with it.
- **When** you load any page and read the footer, then request `/sp/` directly, then read the hero and header donation CTAs.
- **Then** «Благотворительная акция» appears **nowhere** in the rendered footer, while the footer still has its six widget columns. `/sp/` itself answers **200** as a passthrough WP page — the removal was the link, not the page. Both «Оказать помощь» CTAs point at the live external donation host, never at `/sp/`, whose leyka form has taken no money since 2022-01-05 and fails silently inside the iframe.
- **Verify:** `curl -s https://new.obshee-delo.ru/ | grep -c 'Благотворительная акция'` (expect 0); `curl -s https://new.obshee-delo.ru/ | grep -c '<aside id="block-'` (expect 6); `curl -s -o /dev/null -w '%{http_code}\n' https://new.obshee-delo.ru/sp/` (expect 200)
- **Why:** `docs/next-steps.md:56` §«Footer link «Благотворительная акция» (`/sp/`) — deleted 2026-08-15» — 65 pageviews / 1 entry visit in 91 days, i.e. the pageviews _were_ the footer clicks; the same silent-failure shape as the newsletter form (#54). The six-`<aside>` count is runbook §5 gate 13. `renderFooterWidget.test.tsx` tests widget mapping, not what the deployed footer contains. · **Covered by:** **gap**

#### GAP-10 · P1 · manual — Render a film whose kinescope_id is wrong or revoked without a 200 full of nothing

- **Given** `FilmPlayer.tsx:25-40` renders `https://kinescope.io/embed/<id>` whenever `kinescope_id` is non-empty, with no verification that the id resolves — 74 of the 85 catalogue films have one, and the ids arrive from an ACF field an editor types (or from `film:kinescope`'s CSV import). A wrong, deleted or unpublished id yields a Kinescope error page inside the frame; the surrounding page answers 200 with an `<h1>`, breadcrumbs and no playable video.
- **When** you take a film with a valid id and mutate it: a well-formed id that does not exist, an id whose video was unpublished, an empty-after-trim value (`" "`), and an id containing a slash or a query. Load each film page and read the frame's own response, plus the page's `og:video`/poster fallback.
- **Then** the page still offers a route to the content: either the «Смотреть онлайн» / poster branch takes over, or the frame is accompanied by the download pills so the visitor is not left with a grey rectangle. `encodeURIComponent` keeps a slash-bearing id inside the path (verified in source at `FilmPlayer.tsx:34`). A batch check over the catalogue reports how many ids currently 404 at Kinescope — that number belongs in the runbook next to gate 4's 70-of-99.
- **Verify:** `node --env-file=.env.stage scripts/export-film-worksheet.mjs`, then over the worksheet's `kinescope_id` column: `while read id; do printf '%s ' "$id"; curl -s -o /dev/null -w '%{http_code}\n' "https://kinescope.io/embed/$id"; done | grep -v ' 200$'`
- **Why:** DATA-08 and JRN-12 cover the _empty_ ACF group — no id, no poster, no downloads — and assert the null guards return null. Nothing covers a populated-but-wrong id, which is the likelier state: the field is hand-populated across 74 films, `film:import` writes it from a CSV, and the frontend treats any non-empty string as a working stream. The film pages carry 46 % of site entries via `/<id>/`. · **Covered by:** **gap**
