import parse, { Element } from 'html-react-parser';
import { ReactNode } from 'react';
import { OdnoklassnikiIcon, VkIcon, YoutubeIcon } from '@/shared/ui/components/Icons';

const isElement = (node: unknown): node is Element => node instanceof Element;

/**
 * The social row in the `sidebar_bottom` widget is three empty anchors carrying
 * CMSMasters icon classes:
 *
 * ```html
 * <a class="cmsms-icon-vkontakte" title="VK" href="http://vk.com/obsheedelorf"> </a>
 * ```
 *
 * They were being painted with `background-image: url(…/vk.svg)` from the
 * module CSS, which **does not work**: `@svgr/webpack` turns every `.svg`
 * import into a JS module, so the declaration resolved to
 * `…/vk.svg.7e593eb9.js` and the icons rendered as three blank 30px gaps
 * (measured in the browser, 2026-08-13 — they are missing on the live build
 * too). Swapping the anchor for the typed icon component fixes that, gives the
 * link an accessible name, and drops the last thing in the footer that depends
 * on a plugin B8 is going to delete: the href keeps coming from WordPress, only
 * the glyph is ours.
 */
const SOCIAL_ICONS: Record<string, { label: string; icon: ReactNode }> = {
  'cmsms-icon-vkontakte': { label: 'ВКонтакте', icon: <VkIcon color="var(--white)" size={30} /> },
  'cmsms-icon-odnoklassniki': { label: 'Одноклассники', icon: <OdnoklassnikiIcon size={30} /> },
  'cmsms-icon-youtube-2': { label: 'YouTube', icon: <YoutubeIcon size={30} /> },
};

const socialFor = (className = '') =>
  Object.entries(SOCIAL_ICONS).find(([cmsmsClass]) => className.split(/\s+/).includes(cmsmsClass))?.[1];

/**
 * Footer links WordPress still lists but this site must not offer.
 *
 * `/sp/` is the «Благотворительная акция» campaign page, and it carries a
 * **leyka donation form** posting to `/leyka-process-donation`. Donations
 * haven't run through this WordPress since 2022-01-05 — they live on
 * `donation.obshee-delo.ru` / `поддержи.общее-дело.рф` (see
 * `docs/newsletter-unisender.md`) — and under A6 the page is served from the
 * frozen copy inside an iframe, where that form is doubly dead. A visible
 * «дать денег» link that silently takes no money is worse than no link.
 *
 * **The link is already deleted at the source on od-dev** (widget `block-32`,
 * `sidebar_bottom`, 2026-08-15), so this set does nothing there. It stays as
 * the guard for the tier whose WordPress still lists it — **prod**, which
 * can't be edited yet (its REST is off, runbook blocker B1). Delete `/sp/`
 * from here once runbook §2.6 has removed it on prod too.
 *
 * Either way the page stays reachable by its URL through the legacy fallback;
 * only the link goes. Next steps in `docs/next-steps.md`.
 */
const HIDDEN_HREFS = new Set(['/sp/']);

const isHiddenLink = (node: Element) => node.name === 'a' && HIDDEN_HREFS.has(node.attribs.href ?? '');

/**
 * Render one footer widget's `rendered` HTML, with the social anchors replaced
 * by real icons. Everything else — headings, link lists, the legal copy — is
 * WordPress's markup, unchanged, and styled by `Footer.module.css`.
 */
export const renderFooterWidget = (html: string, linkClassName?: string): ReactNode =>
  parse(html, {
    replace: (domNode) => {
      if (!isElement(domNode)) {
        return domNode;
      }

      // Drop the whole list item, or the bare anchor if it isn't in a list —
      // an emptied `<li>` would still take a row.
      if (isHiddenLink(domNode) || domNode.children.some((child) => isElement(child) && isHiddenLink(child))) {
        return <></>;
      }

      if (domNode.name !== 'a') {
        return domNode;
      }

      const social = socialFor(domNode.attribs.class);
      if (!social) {
        return domNode;
      }

      return (
        <a
          href={domNode.attribs.href}
          className={linkClassName}
          aria-label={social.label}
          target={domNode.attribs.target}
          rel={domNode.attribs.target === '_blank' ? 'noopener noreferrer' : undefined}
        >
          {social.icon}
        </a>
      );
    },
  });
