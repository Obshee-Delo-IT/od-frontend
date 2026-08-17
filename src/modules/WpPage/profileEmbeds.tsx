import { ReactNode } from 'react';
import { cachedFetchProfile } from '@/shared/api/fetchProfile';
import { collectProfileHrefs, profileSlug } from '@/shared/lib/wpContent';
import { PersonCard } from '@/shared/ui/components/PersonCard';

/**
 * Turn the `/profile/…` links a page body carries into rendered cards, for
 * `parsePost`'s `embeds` option.
 *
 * **Why the page and not the content holds the design.** The coordinator on
 * `/materials/metodichki/` used to be five hand-typed paragraphs inside a
 * collapsed `<details>` — a name, a role and three contact lines pasted out of
 * Telegram — while the same person's `profile` record held the same details
 * again, and neither copy was a superset of the other. Any layout built on the
 * prose would have been built on one page's punctuation. So the page keeps a
 * link, the record keeps the data, and the card is ours.
 *
 * A record that is missing or unpublished drops out of the map, and `parsePost`
 * then leaves the link exactly as WordPress wrote it. Failing back to a working
 * link is the whole reason the marker is a link.
 */
export const resolveProfileEmbeds = async (html: string): Promise<Map<string, ReactNode>> => {
  const hrefs = collectProfileHrefs(html);
  if (hrefs.length === 0) {
    return new Map();
  }

  const resolved = await Promise.all(
    hrefs.map(async (href) => ({ href, profile: await cachedFetchProfile(profileSlug(href)) }))
  );

  const entries: Array<[string, ReactNode]> = [];
  for (const { href, profile } of resolved) {
    if (profile) {
      entries.push([
        href,
        /* The mock draws the banner without a portrait even where the record has
           one (46651 does). Pass `photo` here to get the `team-1` layout. */
        <PersonCard key={href} name={profile.name} subtitle={profile.subtitle} contacts={profile.contacts} />,
      ]);
    }
  }

  return new Map(entries);
};
