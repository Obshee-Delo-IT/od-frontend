import { cache } from 'react';
import { PersonContact } from '@/shared/ui/components/PersonCard';
import { WP_TAGS, wpCache } from './cacheTags';
import { wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';
import { stripHtml } from './newsPreview';
import { parseProfileBody } from './profileCard';

/**
 * One `profile` record, reduced to what a {@link PersonCard} draws.
 *
 * The CPT is registered by `wp/mu-plugins/od-profile.php` (ours since B8a — the
 * plugin that used to own it is gone) and holds the 139 published regional
 * coordinators and team members ([`wp-backend.md`
 * §3.5](../../../docs/wp-backend.md)). Its bodies are already clean Gutenberg,
 * so this is a read, not a migration — the only work is that the contact fields
 * are prose, which {@link parseProfileBody} narrows to "the anchors, by scheme".
 *
 * A raw `wpFetch` rather than the typed client: a page can link a profile that
 * has since been unpublished, and a miss has to be an answer (the link is left
 * as a link) rather than a throw that takes the whole page down.
 */
export interface ProfileCard {
  id: number;
  /** Plain text — WP renders titles with entities. */
  name: string;
  /** The bolded role from the body, falling back to the record's region meta. */
  subtitle: string | null;
  photo: { src: string; alt: string } | null;
  contacts: PersonContact[];
  /**
   * The record's rendered body, as WordPress returns it.
   *
   * The card is built from four fields above; `/profile/[slug]` also draws what
   * the body says *beyond* them — a second role, education, a bio, a phone still
   * typed as plain text. `stripProfileCardFields()` is what takes the card's own
   * lines back out before it renders.
   */
  contentHtml: string;
}

interface RawProfile {
  id?: number;
  title?: { rendered?: string };
  content?: { rendered?: string };
  meta?: { cmsms_profile_subtitle?: string };
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string; alt_text?: string }> };
}

/**
 * The record whose slug is `slug`, or `null` when WordPress has none published.
 *
 * Pass the slug **as it appears in the URL**. 67 of the 139 are percent-encoded
 * Cyrillic up to 194 characters long, and WP's `?slug=` matches every spelling
 * of them — stored, re-encoded, decoded, or decoded then re-encoded — so no
 * lookup table and no normalisation is needed here (verified 2026-08-13,
 * `wp-backend.md` §3.5).
 *
 * `_embed` rather than a second request for the featured image, and no `_fields`
 * with it: WordPress only populates `_embedded` when `_links` survives the field
 * filter, and the payload is under a kilobyte either way.
 */
export const fetchProfile = async (slug: string): Promise<ProfileCard | null> => {
  if (!slug) {
    return null;
  }

  const query = new URLSearchParams({ slug, per_page: '1', _embed: '1' });
  const res = await wpFetch(`/wp/v2/profile?${query}`, wpCache([WP_TAGS.profiles]));
  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as RawProfile[] | null;
  const profile = (Array.isArray(body) ? body : [])[0];
  if (!profile?.id) {
    return null;
  }

  const name = stripHtml(profile.title?.rendered);
  const { role, contacts } = parseProfileBody(profile.content?.rendered);
  const media = profile._embedded?.['wp:featuredmedia']?.[0];
  const src = await resolveMediaUrl(media?.source_url);

  return {
    id: profile.id,
    name,
    // The region meta is filled on 130 of 139 but is a free-text place name, so
    // it reads as a second line and not as a role — which is why the body's own
    // role line wins when there is one.
    subtitle: role ?? (profile.meta?.cmsms_profile_subtitle || null),
    // `alt_text` is empty on every record sampled, so the name is the fallback:
    // a photo of a person labelled with that person's name.
    photo: src ? { src, alt: stripHtml(media?.alt_text) || name } : null,
    contacts,
    contentHtml: profile.content?.rendered ?? '',
  };
};

/** Per-render dedup, same pattern as `cachedFetchWpPage` — a page may link one profile twice. */
export const cachedFetchProfile = cache(fetchProfile);
