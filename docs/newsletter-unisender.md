# Newsletter: subscribe via Unisender API

**Status:** not started. Nothing here is built yet — this doc exists so the
decision isn't re-litigated and the measurements aren't re-taken.

**Owner decision, 2026-08-15:** the new frontend collects newsletter
subscriptions through the **Unisender API** (own form, their double
opt-in). WordPress must not be in the sending path at all.

## Why not what's there now

The legacy apex site (`obshee-delo.ru`, WP 5.5.5) carries
`wysija-newsletters` — MailPoet 2, discontinued upstream. Measured on the
production database 2026-08-14/15:

| Fact | Value |
| --- | --- |
| Subscribers collected | **10 922** |
| Of them confirmed (`status=1`) | **5 248** (48 %) |
| Unsubscribes ever (`status=-1`) | **0** |
| Campaigns ever sent (`wp_wysija_email_user_stat`) | **0 rows** |
| Sender configured in the plugin | `info@melafi.ru` — a foreign domain, leftover demo data |
| Its `smtp_login` | `villain218@gmail.com` — likewise |

So: ten years of collecting, not a single campaign. Nobody unsubscribed
because nobody was ever mailed. Double opt-in confirmations *did* go out
(that's how 5 248 confirmed), but intermittently — the shared host
returns `false` from `mail()` when its hourly cap is hit, which surfaces
as PHPMailer's `Could not instantiate mail function`.

**And mail from the host lands in spam.** Verified 2026-08-15: five test
messages sent with plain `mail()` from the BeGet host all arrived in
Gmail's spam folder. The domain publishes DMARC `p=quarantine`, and its
DKIM selectors (`mail._domainkey` → Yandex, `mailru._domainkey` →
Mail.ru) only sign what goes through *those* services. Host-originated
mail is unsigned, and without an explicit `-f` the envelope sender is the
hosting default, so it isn't SPF-aligned either — neither DMARC signal
passes.

That is the whole argument for putting an ESP in the path: it isn't about
features, it's the only way the mail gets delivered.

## The shape to build

Three options were weighed; **B** is the decision.

| | Approach | Verdict |
| --- | --- | --- |
| A | Embed Unisender's own subscribe form | Works, fewest moving parts, but the form is theirs and barely styleable |
| **B** | **Own form → Unisender API `subscribe` with `double_optin`** | **Chosen.** Our markup and validation; their confirmation mail, their list, their reputation |
| C | Keep collecting in WP, sync to Unisender | Rejected: two lists that drift, two confirmation steps, and the confirmation mail still leaves via `mail()` → spam |

Under B the frontend never sends email. It posts the address to Unisender
and shows a "check your inbox" state; Unisender sends the confirmation,
handles the click, and owns the list.

### Implementation notes

- Call the API **server-side** (route handler / server action). The
  Unisender API key is a secret and must never reach the browser.
- `subscribe` with `double_optin=3` — Unisender sends the confirmation
  message and only then adds the contact as confirmed. Don't hand-roll a
  confirmation flow.
- Treat a duplicate subscribe as success in the UI; don't leak whether an
  address is already on the list.
- Rate-limit the endpoint per IP — the form is public and unauthenticated.
- Keep the consent checkbox text and its version with the submission, and
  store *what* the person agreed to, not just that they did. The
  reg-site's `app/config/consent.php` is the pattern to copy.

### Facts that save a round of discovery

- **No ESP plugin exists on any site.** Checked 2026-08-15 across
  `public_html` (apex), `donation.od`, `support_od`: only
  `wysija-newsletters` on the apex. The `include:spf.unisender.com` and
  `include:spf.mailjet.com` entries in the domain's SPF are inherited
  from something external — this integration starts from zero.
- **SPF has room.** The record is at 7 of the 10 allowed DNS lookups and
  already includes Unisender, so nothing needs changing there.
- The other two donation sites already do the right thing for
  transactional mail: `wp-mail-smtp` → `smtp.mail.ru` with
  `return_path=true`. That's the pattern if the new frontend ever needs
  to send mail itself.

## The existing 10 922 addresses — do not bulk-import

Freshness of the confirmed half:

| Confirmed | People |
| --- | --- |
| within the last year | **303** |
| 1–3 years ago | 818 |
| 3–6 years ago | 1 308 |
| older than 6 years | 2 698 |

Loading this into an ESP and mailing it is the reliable way to get the
account suspended: these people have received nothing for up to a decade
and will not recognise the sender. If the list is to be used at all:

1. take only the ~1 121 confirmed within three years;
2. run address validation first;
3. send in waves of 200–500, watching complaints and bounces;
4. state plainly in the first message when and where they subscribed.

The remaining ~4 100 are best left alone — re-permissioning a six-year-old
list costs more than it returns.

⚠ **Open legal question:** we do not have the consent text those people
subscribed under (2016–2020). Belongs in the legal map alongside the
reg-site consent work, before any send.

## Transactional mail is a separate problem

Unisender covers campaigns, not notifications. On the legacy apex the
transactional paths are effectively dormant — leyka takes no payments
there (last funded donation 2022-01-05), login is admin-only — but three
Contact Form 7 forms are live on three published pages, and their
notifications go to real addresses (`web@obshee-delo.ru`,
`dmd_kostroma@mail.ru`; the third, "Интернет волонтёр", still points at
the stray `villain218@gmail.com`). With host mail landing in spam, those
submissions are quietly lost rather than visibly broken.

When the new frontend takes over contact forms, it must decide its own
sending path — authenticated SMTP with DKIM, or a transactional API —
and not inherit `mail()`.

## References

- Migration of the apex site to BeGet, where all of the above was
  measured: `~/Projects/servers-agent/tasks/2026-08-04-apex-on-hosting-ssl-frontend/apex-move-runbook.md`
- WordPress side of the current site: [`wp-backend.md`](./wp-backend.md)
