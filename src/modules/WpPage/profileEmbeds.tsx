import { ReactNode } from 'react';
import { cachedFetchProfile } from '@/shared/api/fetchProfile';
import { collectProfileHrefs, collectQueryCardProfileHrefs, profileSlug } from '@/shared/lib/wpContent';
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

/**
 * The class `od_pages_team()` writes on the roster's wrapper, and the one thing
 * that tells the two card layouts apart.
 *
 * The photo is what selects the layout (see `PersonCardProps.photo`), and the
 * choice is per *page*, not per record: `/materials/metodichki/` draws its
 * coordinator as a full-width banner with no portrait even though his record has
 * one, while `/team/` draws the `team-1` card. Nothing about a `profile` says
 * which — so the marker is the content's own, exactly as `.od-covers` is
 * (`gutenberg.css`), and it is already in the body to lay the grid out. One class,
 * read twice.
 */
const TEAM_GRID = /\bclass="[^"]*\bod-team\b/;

export const resolveProfileEmbeds = async (html: string): Promise<Map<string, ReactNode>> => {
  const hrefs = collectProfileHrefs(html);
  if (hrefs.length === 0) {
    return new Map();
  }

  const teamGrid = TEAM_GRID.test(html);
  /* A query card asked for the portrait by rendering a featured image — there is
     no marker class to read on the 74 regional pages, and none is needed. */
  const fromCard = collectQueryCardProfileHrefs(html);

  const resolved = await Promise.all(
    hrefs.map(async (href) => ({ href, profile: await cachedFetchProfile(profileSlug(href)) }))
  );

  const entries: Array<[string, ReactNode]> = [];
  for (const { href, profile } of resolved) {
    // A record with no title has nothing to head the card with, so it takes the
    // same route as a missing one: the link stays a link.
    if (profile?.name) {
      entries.push([
        href,
        <PersonCard
          key={href}
          name={profile.name}
          subtitle={profile.subtitle}
          photo={teamGrid || fromCard.has(href) ? profile.photo : null}
          contacts={profile.contacts}
        />,
      ]);
    }
  }

  return new Map(entries);
};
