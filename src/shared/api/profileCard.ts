import { PersonContact, PersonContactKind } from '@/shared/ui/components/PersonCard';
import { stripHtml } from './newsPreview';

/**
 * What a `profile` record's body yields for a card — the pure half of
 * `fetchProfile`, so it can be tested against real captured bodies without a
 * network.
 *
 * **Why parse at all.** The 139 published `profile` records are clean Gutenberg,
 * but the useful fields are prose: a bolded role, then phone / e-mail / social
 * lines, with no wrapper, no class and no ordering contract
 * ([`wp-backend.md` §3.5](../../../docs/wp-backend.md)). The plan's open D3
 * question was whether to parse them, backfill them into ACF, or drop the
 * contact row from the mock.
 *
 * The answer here is narrower than "parse the prose": **only the anchors are
 * read, and only by URL scheme.** `tel:`, `mailto:`, `t.me` and `vk.com` are
 * facts about the markup, not guesses about the wording — an editor who links a
 * number gets a row, one who types it as plain text does not, and nothing
 * depends on word order, punctuation or a label like «Телефон:». Free text is
 * touched in exactly one place, the role line, and that has a structural
 * fallback (`meta.cmsms_profile_subtitle`).
 */

/** `<a …>text</a>`, non-greedy so adjacent links don't merge into one match. */
const ANCHOR = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF = /\bhref=["']([^"']*)["']/i;
/** The role: whatever the body bolds first. `<b>` too — editors use both. */
const FIRST_BOLD = /<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/i;

const HOST_KINDS: Array<[RegExp, PersonContactKind]> = [
  [/^(?:www\.)?(?:t|telegram)\.me$/i, 'telegram'],
  [/^(?:m\.|www\.)?vk\.(?:com|ru)$/i, 'vk'],
];

/**
 * The kind of contact a href is, or `null` when it is an ordinary link.
 *
 * Scheme first, because `tel:`/`mailto:` are unambiguous. Then the host, which
 * has to be parsed rather than matched as a substring: a body linking to an
 * article *about* VK on some other domain must not become a VK contact row.
 */
const contactKind = (href: string): PersonContactKind | null => {
  if (/^tel:/i.test(href)) {
    return 'phone';
  }
  if (/^mailto:/i.test(href)) {
    return 'email';
  }
  let host: string;
  try {
    host = new URL(href).hostname;
  } catch {
    return null;
  }
  return HOST_KINDS.find(([pattern]) => pattern.test(host))?.[1] ?? null;
};

/** `tel:+7(904)818-08-69` → `+7(904)818-08-69`, for an anchor with no text. */
const fallbackLabel = (href: string, kind: PersonContactKind): string =>
  kind === 'phone' || kind === 'email' ? href.replace(/^[a-z]+:/i, '') : href;

export interface ProfileBodyFields {
  /** The bolded first line — the role, e.g. «Координатор по городу Магнитогорску». */
  role: string | null;
  contacts: PersonContact[];
}

/**
 * Read the card's fields out of a `profile` body.
 *
 * Contacts come back in document order and deduplicated by href, since a body
 * that repeats a number (a few do) should not repeat the row.
 */
export const parseProfileBody = (html?: string | null): ProfileBodyFields => {
  if (!html) {
    return { role: null, contacts: [] };
  }

  const contacts: PersonContact[] = [];
  const seen = new Set<string>();

  for (const [, attrs, inner] of html.matchAll(ANCHOR)) {
    const href = attrs.match(HREF)?.[1];
    if (!href) {
      continue;
    }
    const kind = contactKind(href);
    if (!kind || seen.has(href)) {
      continue;
    }
    seen.add(href);
    contacts.push({ kind, href, label: stripHtml(inner).trim() || fallbackLabel(href, kind) });
  }

  const role = stripHtml(html.match(FIRST_BOLD)?.[2]).trim();

  return { role: role || null, contacts };
};
