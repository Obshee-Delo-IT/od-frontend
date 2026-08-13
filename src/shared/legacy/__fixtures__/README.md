# Legacy-page fixtures (A6)

Three real pages captured from the live WordPress site. They are the **only** legacy HTML the test suite ever
sees — no test in this repo fetches the legacy origin, so the suite runs offline and its numbers cannot drift
under us.

| File                     | Live URL                                    | Why this page                                                                            |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `team.html`              | `https://obshee-delo.ru/team/`              | Profile grid; the page every measured number in the specs was taken from                 |
| `materials-plakati.html` | `https://obshee-delo.ru/materials/plakati/` | The site's #6 entry page; 33 `/wp-content/` download links and the heaviest cmsms markup |
| `faq.html`               | `https://obshee-delo.ru/faq/`               | Accordion; carries the `href="#"` scroll-to-top idiom                                    |

## Capture

Captured **2026-08-13**, with:

```sh
curl -sS --compressed -H 'User-Agent: Mozilla/5.0' https://obshee-delo.ru/team/            -o team.html
curl -sS --compressed -H 'User-Agent: Mozilla/5.0' https://obshee-delo.ru/materials/plakati/ -o materials-plakati.html
curl -sS --compressed -H 'User-Agent: Mozilla/5.0' https://obshee-delo.ru/faq/             -o faq.html
```

```
6f118c3d18bc2b6364f9d7de146e5bd2e4f1b0dce4d96dbb655d0075e6a5b6c5  team.html
f69515fb9adf441c917b61a28a51023e9c3e8b94c89c434cc5c7087cb8738c1f  materials-plakati.html
a6da1654f38179d1753d25eaebe8a3c10b8c61fc5bc684bf020e4db3cb6d5c75  faq.html
```

**Never edit a fixture to make a test pass.** If the live site has changed enough that a fixture no longer
represents it, re-capture all three as a separate, reviewed commit and update the numbers below — that is a
change to what we believe about the legacy site, and it deserves to be visible in a diff on its own.

They are listed in `.prettierignore`: `pnpm format` would otherwise reformat them, which is the same thing as
editing them.

## Measured numbers

`fixtures.test.ts` asserts every row, so a re-capture that changes one fails loudly rather than quietly
invalidating a spec.

|                                                                         | `team` | `materials-plakati` | `faq`   |
| ----------------------------------------------------------------------- | ------ | ------------------- | ------- |
| bytes                                                                   | 85 641 | 128 143             | 110 550 |
| `<script` **occurrences**                                               | 52     | 64                  | 60      |
| `<script>` **elements**                                                 | 46     | 58                  | 54      |
| …of which after `</footer>`                                             | 34     | 46                  | 42      |
| …of which inside a chrome element                                       | **0**  | **0**               | **0**   |
| `rel="stylesheet"` occurrences                                          | 30     | 30                  | 30      |
| …of which live (not in an IE conditional comment)                       | 26     | 26                  | 26      |
| `<style` blocks                                                         | 12     | 12                  | 12      |
| …of which in `<head>`                                                   | 7      | 7                   | 7       |
| `href="/wp-content/…"` (downloads)                                      | 1      | 33                  | 4       |
| …of which outside the chrome                                            | 0      | 32                  | 3       |
| `mc.yandex.ru` references                                               | 2      | 2                   | 2       |
| `header#header` / `section#middle` / `section#bottom` / `footer#footer` | 1 each | 1 each              | 1 each  |
| `<meta name="description">`                                             | absent | absent              | absent  |

The script rows are the load-bearing ones: they are why the transform **removes** the three chrome elements
instead of keeping only `section#middle` (design D14). Keeping only `#middle` would discard 34 of `team`'s 46
scripts — every `wp_footer` bootstrap, i.e. exactly the interactivity the iframe exists to preserve.

**Three numbers in the specs are substring counts, not element counts**, and the difference was measured here
rather than assumed. Both are recorded above, and both are asserted, so neither reading can drift:

- **Scripts.** `52` is `<script` occurrences; six of them are inside a single inline script that does
  `document.write('<script src="…"></scr' + 'ipt>')` for the WordPress polyfills. There are **46** actual
  elements. The transform counts elements, which is also what a browser counts — the HTML spec ends a script
  at the first `</script`, which is precisely why that polyfill splits the closing tag. `40 of 52 after
  </footer>` becomes **34 of 46** the same way.
- **Stylesheets.** Four of the 30 `rel="stylesheet"` links sit inside `<!--[if lte IE 9]>` conditional
  comments and are inert in every browser that still exists. **26** are live. All 30 survive the transform
  either way.
- **`section#bottom` is nested** inside `section#page`, not a top-level sibling. A version of the span finder
  that returned only outermost elements never found it — and every assertion written against that finder
  passed vacuously. Chrome removal now matches nested elements.

A fourth number does not reproduce at all and is asserted nowhere: `decisions.md` D1 cites "159 `cmsms_row` on
`/materials/plakati/`". The capture has **23** `cmsms_row` blocks and 226 occurrences of the substring (the
rest are `cmsms_row_inner`, `_outer`, `_outer_parent`, `_margin`). It was only ever used to argue that prod's
markup is cmsms-shaped where od-dev's is not, which all three counts support equally.
