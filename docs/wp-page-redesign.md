# Redesigning a WordPress page — the working flow

**Start here before touching any page in workstream D that is served from WordPress.** This is the procedure: where each kind of fix goes, what to check, and what "done" means. How a page *reaches* the browser is [`wp-page-passthrough.md`](./wp-page-passthrough.md); what a page should *look like* is [`page-mocks.md`](./page-mocks.md); this file is how the two are brought together.

Agreed with Alexey 2026-08-17. The shape of the work: **the design system's CSS lives in this repo, the content stays fully editable in WordPress, and every WordPress-side change is a script in this repo — never a click in the admin.**

## 1. Why a script and not the admin

Production still holds CMSMasters shortcodes and is converted by `cmsms-gutenberg-upgrade` **as part of the cutover** ([`wp-page-passthrough.md` §6](./wp-page-passthrough.md#6-running-the-migrator)). od-dev's database does not travel to production — od-dev is a stale copy, production is authoritative for content. So a page fixed by hand in od-dev's admin is fixed nowhere: the cutover re-converts production from its own shortcodes and the hand work is gone.

Therefore every content change is expressed as code, and applying the whole of workstream D to production is **running one script**.

Two files, split by lifetime:

| file | what | when it runs | PHP floor |
| --- | --- | --- | --- |
| `wp/scripts/od-pages.php` | one-shot content fixes — strip a page's `<style>`, rewrite blocks, set a `className` | by hand, `wp eval-file` | CLI PHP (8.2 on prod) — modern syntax fine |
| `wp/mu-plugins/od-design.php` | runtime registration — block styles, patterns, editor palette | every request, forever | **PHP 7.0 syntax only** |

**The PHP floor on the second file is not a style preference.** Production's *site* PHP is 7.x (`mod_php7`) while its CLI is 8.2, and 7.4+ syntax in an mu-plugin is a parse error that takes the whole site down the moment it loads. `wp/mu-plugins/od-revalidate.php` is written to that floor for the same reason — read its header before editing either.

**The second file does not exist yet, and should not be created speculatively.** It appears the first time a design variant repeats often enough to earn a dropdown (§2, rung 4). Until then one script is the whole WordPress side.

### What `od-pages.php` must guarantee

- **Idempotent by detection, not by rewriting.** Each fix checks whether the page is already in its target shape and skips it. Re-running must not clobber an editor's later work — this script gets run again on every environment.
- **Dry-run is the default**, as in the `film:*` tooling and the migrator's CLI. Writing takes an explicit `apply` argument — a **positional** one, because `wp eval-file` passes positionals to the script in `$args` and rejects unknown `--flags`.
- **Write through `$wpdb->update`, saving a revision first.** `wp_update_post` fires `cmsms-gutenberg-upgrade`'s `save_post` hook, which deletes the `nvp_content_copy` meta — the copy both a re-run of the migrator and `wp cmsms restore` depend on. The migrator's own CLI does it this way for exactly this reason.
- **Target pages by slug/path, never by post id.** Ids differ per environment (runbook blocker B4).
- **Pure transforms separated from the WordPress calls.** Everything that is "content string in → content string out" is a plain function, so it can be tested without WordPress.

### Tests

`wp/tests/od-pages.test.php`, plain `assert`, no PHPUnit and no composer — run it with `php wp/tests/od-pages.test.php`. It covers the pure transforms only, and **every transform gets the idempotency case**: `f(f(x)) === f(x)`. Fixtures are real `post_content` captured from od-dev.

## 2. Where a fix goes — the ladder

Stop at the first rung that holds.

1. **CSS on the core block class**, in `src/shared/ui/theme/gutenberg/gutenberg.css`. Nothing on the WordPress side at all, and it applies to every page that uses that block — the ~80 regional `/contacts/*` pages pick up the news-list styling for free because they all use `wp:query`. **This is where most of the design system lands.** The stylesheet is pulled in through `gutenberg-provider.css` with `@nested-import`, so everything is nested under `.gutenberg` and cannot leak.
2. **A `className` on the block + a rule in `gutenberg.css`.** The editor's «Дополнительные CSS-классы» field, no registration, no PHP. This is the default for anything section-specific. The class name is content, so it goes in the script, not in the admin.
3. **An inline `<style>` on the page**, for one or two genuinely page-local cases. Cheaper than a dropdown nobody else will use — *but scope it*: prefix every selector with a class on the page's own wrapper. Unscoped author CSS from the old theme is what threw the `/materials/` captions onto the site header ([`wp-page-passthrough.md` §4](./wp-page-passthrough.md#4-bugs-and-where-each-was-fixed)); a page's CSS competes with ours on ordinary specificity and it is not layered.
4. **`register_block_style()` / `register_block_pattern()`** in `od-design.php`. Both are PHP-only, no JS and no build step. Reach for them when a variant repeats often enough that hand-typing a class becomes a typo risk, or when an editor needs to insert a whole prefab section themselves. A registered style appears in the editor's Стиль panel and lands in the markup as `is-style-<slug>`.
5. **A custom block.** Last resort — it needs JS in the editor and therefore a build step on the WordPress side. No case for one is known today.

**Colour and spacing controls in the editor** were considered as `theme.json` (injected by the `wp_theme_json_data_theme` filter) and dropped as too much machinery. If editors ever need to pick a brand colour rather than have it, the simple form is the classic-theme API — `add_theme_support('editor-color-palette', …)` plus `add_theme_support('disable-custom-colors')` in `od-design.php`, which is a few lines and emits `has-<slug>-color` classes we already control.

## 3. The per-page flow

1. **Find the mock.** [`page-mocks.md`](./page-mocks.md) maps the Figma `design` page to routes and carries node ids. Read it with `figma-mcp-go` by **frame name**, navigating to a small sub-frame (`search_nodes` → `get_node` → `save_screenshots`); reading a whole page frame times out.
2. **Look at what renders now.** `pnpm dev`, open the path. Confirm it is native and not the iframe — a native page has a `PageHeader`; check `src/shared/config/legacyEmbedPages.ts`. **If the page is on that list, removing it is part of the change.**
3. **Read the page's `post_content`**, not just the rendered HTML: `wp post get <id> --field=post_content`, or `?slug=` over REST. Everything in §4 is visible there and invisible in the browser.
4. **Classify every difference** against the ladder in §2 before writing anything. A difference that is really a missing parity rule (something the old theme supplied and Gutenberg does not) belongs in `gutenberg.css` — the same content arrives on production through the same migrator, so a page-by-page rebuild leaves the next page to break identically.
5. **Implement** — CSS in the repo, content in `od-pages.php`, tests for each new transform.
6. **Apply to od-dev** — dry-run, read it, then `--apply`.
7. **Check in a browser at 1440 and 375**, against the mock.
8. **Commit the block** — CSS, script, tests and the doc change together, one commit, per `CLAUDE.md`.

## 4. What to look for in a page's content

Measured over od-dev's 170 published pages, 2026-08-17:

| | count | why it matters |
| --- | --- | --- |
| pages with an inline `<style>` | 30 | old-theme author CSS, unscoped; usually the cause when a page renders wrong |
| pages with a `className` | 89 | migrator residue (`cmsms_*`) and real hooks mixed together |
| pages with `wp:html` | 34 | an escape hatch that bypasses the whole design system — convert to real blocks |
| pages with `wp:query` | 86 | ~80 of them are the regional `/contacts/*` template |
| pages with `wp:details` | 79 | core accordion, already the right block for D4/D5 |

Block usage across the same set, most-used first: `column` 1212 · `paragraph` 857 · `group` 843 · `columns` 748 · `image` 295 · `separator` 253 · `button` 234 · `heading` 151 · `details` 129 · `html` 101 · `embed` 51 · `gallery` 2.

Two known traps in the rendered output:

- **Dynamic blocks emit absolute links to the WordPress origin.** `wp:query` output carries `href="https://od-dev.tmweb.ru/<id>/"` and a WP-origin `srcset`. Images are handled by `resolveContentImages`; **links are not**, so they navigate the visitor off the site. Tracked as **D6c** in [`implementation-plan.md`](./implementation-plan.md) — fix it in the pipeline, not in the content.
- **`parsePost`'s hero lift is off for pages** — `WpPage` passes `liftHeader: false`, since 2026-08-17. It is not a "leading block" rule as it reads: it matches the **first** carousel or gallery anywhere in the document and removes **its whole parent**, so a gallery an editor drops into a column takes that column's text with it. On a post the parent is the wrapper the migrator put there; on a page it is arbitrary. Measured over od-dev's 170 pages: 2 carry a gallery, **neither** as a leading top-level block, and **both** would lose a sibling (`/sp/` a heading). Nothing to lift, everything to lose. Posts and films keep the lift.

## 5. Prerequisites and things that break outside this file

- **Production's WordPress core must be upgraded before any of this reaches it.** Prod is pinned to 5.5.5 by `wp-downgrade`; the migrator emits `wp:query`, `wp:details` and `wp:group`, and the layout classes our CSS keys on (`is-layout-flex`) are emitted by core 5.9+. On 5.5.5 query blocks render empty and columns stack. Runbook blocker **B10**.
- **Re-run the migrator on a page before designing it** if it still carries shortcodes — `wp cmsms migrate --post=<id>`. The full od-dev sweep was completed 2026-08-17.
- **Adding a native Next route for a path retires its WordPress passthrough**, with no other edit: App Router gives a real route precedence over `[...slug]`.
- **After any routing or redirect change, run `pnpm url:check`.**
- **The WordPress editor is not WYSIWYG here** — the admin shows default Gutenberg, not this site. Tracked in [`next-steps.md`](./next-steps.md).

## 6. Done means

- The page matches the mock at 1440 and 375.
- No `<style>` left on the page except a scoped, deliberate one.
- Every WordPress-side change is in `wp/scripts/od-pages.php`, idempotent, with a test.
- `php wp/tests/od-pages.test.php` passes, and `pnpm lint · type-check · test` are green.
- If the page was on the legacy-embed list, it is off it.
- Committed as one block, with the doc updates in the same commit.
