import '@/shared/ui/styles/global.css';
/* Radix's stylesheet and our token overrides are imported **here**, ahead of
   every component, and not in `radix-provider.tsx` where they used to live.
   They set the cascade order for the whole app, and in a production build that
   order is the order modules first enter the graph — so with them inside the
   provider, `import/order`'s alphabetising put `@/modules/Footer` and
   `@/modules/Header` (which chain in every shared CSS module) *before*
   `@/shared/ui/theme`, and Radix's own rules then won every tie against a
   module class. `next dev` loads CSS differently and looked right, which is what
   hid it: the H1 rendered 48px in dev and 24px in `next start`. See
   `docs/next-steps.md`. */
import '@radix-ui/themes/styles.css';
import '@/shared/ui/theme/radix/theme-override.css';
import { PT_Sans as PTSans, PT_Sans_Narrow as PtSansNarrow } from 'next/font/google';
import { Footer } from '@/modules/Footer';
import { HeaderServer } from '@/modules/Header';
import { SITE_NAME, siteUrl } from '@/shared/config/site';
import { RadixProvider } from '@/shared/ui/theme';
import css from './layout.module.css';
import type { Metadata } from 'next';

// TODO: install local fonts
const ptSans = PTSans({
  variable: '--font-pt-sans',
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '700'],
});

const ptSansNarrow = PtSansNarrow({
  variable: '--font-pt-sans-narrow',
  subsets: ['cyrillic', 'latin'],
  weight: ['700'],
});

const SITE_DESCRIPTION = 'Общероссийская общественная организация';

export const metadata: Metadata = {
  /**
   * Without this, a relative `alternates.canonical` is emitted relative *and*
   * slashless — pointing every crawler at a 308 — and relative OG images fall
   * back to `http://localhost:3000`. It is inherited by every segment.
   */
  metadataBase: new URL(siteUrl),
  // No `title.template`: the page titles already carry the « — ОБЩЕЕ ДЕЛО»
  // suffix, and a template would double it.
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    // Open Graph wants the underscore form; `ru-RU` is silently ignored.
    locale: 'ru_RU',
    countryName: 'Russia',
  },
  /**
   * Carried over from the live WP template (confirmed against the production
   * host, not the dev copy) — Yandex Webmaster ownership is verified by this
   * meta tag and would be lost the moment the frontend takes the domain.
   */
  verification: { yandex: '5970d7ec7d8e8b0b' },
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html lang="ru" className="rt-reset">
    <body className={`${ptSansNarrow.variable} ${ptSans.variable}`}>
      <RadixProvider>
        <HeaderServer />
        <main className={css.main}>{children}</main>
        <Footer />
      </RadixProvider>
    </body>
  </html>
);

export default RootLayout;
