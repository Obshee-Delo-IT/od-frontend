import { notFound } from 'next/navigation';
import { cachedFetchProfile } from '@/shared/api/fetchProfile';
import { canonicalUrl, OG_DEFAULT_IMAGE } from '@/shared/config/site';
import { parsePost, resolveContentHtml, stripProfileCardFields } from '@/shared/lib/wpContent';
import { Box } from '@/shared/ui/components/Box';
import { ImagePreviewClient } from '@/shared/ui/components/ImagePreview';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import { PersonCard } from '@/shared/ui/components/PersonCard';
import { GutenbergProvider } from '@/shared/ui/theme';
import type { Metadata } from 'next';

export const revalidate = 3600;

interface ProfilePageProps {
  params: Promise<{ slug: string }>;
}

/**
 * No `generateStaticParams`. There are 139 published records and this page is
 * reached from search rather than from a listing, so seeding all of them would
 * spend 139 WordPress round trips per build to prerender pages that ISR fills in
 * on first request anyway.
 */
export const generateMetadata = async ({ params }: ProfilePageProps): Promise<Metadata> => {
  const { slug } = await params;
  const profile = await cachedFetchProfile(slug);

  if (!profile) {
    return {};
  }

  const url = canonicalUrl(`/profile/${slug}/`);
  const description = profile.subtitle ?? undefined;

  return {
    title: `${profile.name} — ОБЩЕЕ ДЕЛО`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'profile',
      url,
      locale: 'ru_RU',
      title: profile.name,
      description,
      images: [profile.photo?.src ?? OG_DEFAULT_IMAGE],
    },
  };
};

/**
 * `/profile/<slug>/` — one `profile` record: the same `PersonCard` the team page
 * embeds, and then whatever else the record says.
 *
 * **This retires the A6 iframe for the whole `/profile/*` family**, which is what
 * it was serving until now — the old theme's page, complete with a «Детали»
 * sidebar of WordPress internals («Categories: Центральный Аппарат»), a like
 * counter, prev/next links through the CPT and a comment form nobody can post to.
 * 566 entry visits in 91 days landed on that.
 *
 * **Card first, then the rest, and the rest is not decoration.** 121 of the 139
 * records say something the card's four fields do not — a second and third role,
 * education, a bio, a phone still typed as plain text and therefore never a
 * contact row. `stripProfileCardFields()` takes back out only what the card
 * already draws, so nothing is printed twice and nothing is dropped.
 *
 * A slug with no published record **404s** rather than falling back to the iframe:
 * this route outranks `/[...slug]`, and a 404 is the right answer for a
 * coordinator who is no longer published.
 */
const Page = async ({ params }: ProfilePageProps) => {
  const { slug } = await params;
  const profile = await cachedFetchProfile(slug);

  if (!profile) {
    notFound();
  }

  const rest = stripProfileCardFields(profile.contentHtml);
  const body = rest ? parsePost(await resolveContentHtml(rest, false), { liftHeader: false }).body : null;

  return (
    <Box display="flex" flexDirection="column" gap={40} pt={20} pb={48}>
      <PageHeader title={profile.name} breadcrumbs={[{ label: 'Главная', href: '/' }, { label: profile.name }]} />

      <PersonCard name={profile.name} subtitle={profile.subtitle} photo={profile.photo} contacts={profile.contacts} />

      {body ? (
        <ImagePreviewClient>
          <GutenbergProvider as="section">
            {/* A global class, not a module one: the rule that unstacks the
                record's two-column block lives in `gutenberg.css`, which is
                nested under `.gutenberg` and cannot see a hashed name. */}
            <div className="od-profile-body">{body}</div>
          </GutenbergProvider>
        </ImagePreviewClient>
      ) : null}
    </Box>
  );
};

export default Page;
