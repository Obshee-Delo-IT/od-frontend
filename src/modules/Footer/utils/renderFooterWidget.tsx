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
 * Render one footer widget's `rendered` HTML, with the social anchors replaced
 * by real icons. Everything else — headings, link lists, the legal copy — is
 * WordPress's markup, unchanged, and styled by `Footer.module.css`.
 */
export const renderFooterWidget = (html: string, linkClassName?: string): ReactNode =>
  parse(html, {
    replace: (domNode) => {
      if (!isElement(domNode) || domNode.name !== 'a') {
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
