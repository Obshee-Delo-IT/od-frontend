# Next steps

Small follow-ups left behind by shipped work: something was hidden, stubbed or
postponed, and someone has to come back to it. Each entry says what was done,
why, and what has to happen next.

Bigger workstreams live in [`implementation-plan.md`](./implementation-plan.md);
this file is for the loose ends that don't deserve a workstream item.

---

## Footer link «Благотворительная акция» (`/sp/`) — hidden 2026-08-15

**Done, in two places.**

1. **At the source on od-dev** — the `wp:list-item` block was deleted from
   widget `block-32` (`sidebar_bottom`) over the REST API. Seven links left.
   To restore it, paste this back into the list, at the end:

   ```html
   <!-- wp:list-item -->
   <li><a href="/sp/">Благотворительная акция</a></li>
   <!-- /wp:list-item -->
   ```

2. **In the frontend**, as the guard for the tier whose WordPress still lists
   it: `HIDDEN_HREFS` in
   [`src/modules/Footer/utils/renderFooterWidget.tsx`](../src/modules/Footer/utils/renderFooterWidget.tsx)
   drops the anchor and the `<li>` around it. **Prod can't be edited yet** —
   its REST is off (runbook blocker B1) — so runbook §2.6 carries the same
   deletion, and this entry goes away once that has run.

`/sp/` itself stays reachable by URL through the A6 legacy fallback; only the
link goes.

**Why.** `/sp/` carries a leyka donation form posting to this WordPress's
`/leyka-process-donation`, and that path has taken no money since 2022-01-05;
donations run on `donation.obshee-delo.ru` and `поддержи.общее-дело.рф` (both
live). Inside the A6 iframe the form is doubly dead — the visitor gets no
error, just nothing, the same failure mode as the newsletter form (#54).

**Measured 2026-08-15:** 1 of 172 legacy pages carries a leyka form (only
`/sp/`) · 1 link to it in all WP menus and widgets (`sidebar_bottom`,
`block-32`) · 65 pageviews / 1 entry visit in 91 days (Metrica,
2026-05-14 → 2026-08-13) — i.e. the pageviews *are* the footer clicks being
removed.

**Next:**

1. Ask the org whether the «ПРАВИЛЬНЫЕ решения» campaign is still running (the
   page has a budget table, so it was time-boxed).
2. Decide which donation destination is canonical — `donation.obshee-delo.ru`
   or `поддержи.общее-дело.рф`. Both answer 200; the legacy page links the
   second.
3. Then pick for `/sp/`: **301** it to that destination and leave the link out
   (cheapest) · **restore the footer link** pointing straight at it · or
   **rebuild the page natively** with an outbound donate CTA, if the campaign
   is live and the content is worth keeping.
4. Then decide leyka — open item 9 under B-PLUGINS in the plan. If donations
   never come back to this WordPress, leyka and its `leyka_donation` /
   `leyka_campaign` CPTs go at plugin cleanup.

**Rule that outlives this entry:** donations must not be routed back through
WordPress — same reasoning as [`newsletter-unisender.md`](./newsletter-unisender.md).
Before assuming `/sp/` is still the only such page, re-scan: pull
`page-sitemap.xml` from the legacy origin and grep each page for
`leyka-pm-form`.
