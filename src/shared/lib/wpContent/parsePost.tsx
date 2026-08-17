import parse, { DOMNode, Element, Text, domToReact, Comment } from 'html-react-parser';
import { Children, JSX, ReactElement, ReactNode } from 'react';

type PostContent = {
  body?: string | JSX.Element | JSX.Element[];
  header?: string | JSX.Element | JSX.Element[];
};

const isElement = (node: unknown): node is Element => node instanceof Element;

/** Whitespace-only text — the newlines WordPress leaves between blocks. */
const isBlank = (node: DOMNode): boolean => node instanceof Text && !node.data.trim();

/**
 * The href of the link `node` exists only to hold, when that link has an embed
 * waiting — otherwise `null`.
 *
 * Matching the **wrapper** rather than the anchor is not a detail: an embed put
 * in the anchor's place would leave `<article>` inside the `<p>` WordPress wrote,
 * which the browser's parser splits back apart and hydration then fails on. So
 * only a paragraph (or any element) whose sole content is the link qualifies,
 * which is also what makes this safe for links written mid-sentence — those keep
 * being links.
 */
const soleEmbedHref = (node: Element, embeds: Map<string, ReactNode>): string | null => {
  const children = (node.children as DOMNode[]).filter((child) => !isBlank(child));
  const [only] = children;
  if (children.length !== 1 || !isElement(only) || only.tagName !== 'a') {
    return null;
  }
  const { href } = only.attribs;
  return href && embeds.has(href) ? href : null;
};

const findCarouselOrGallery = (children: DOMNode[]) => {
  const carousel = children.find(
    (child) => isElement(child) && child.attribs.class?.includes('wp-block-cb-carousel-v2')
  );
  const gallery = children.find((child) => isElement(child) && child.attribs.class?.includes('wp-block-gallery'));
  return { carousel: isElement(carousel) ? carousel : null, gallery: isElement(gallery) ? gallery : null };
};

interface ParsePostOptions {
  /**
   * Lift the first carousel or gallery out of the body and return it as `header`.
   *
   * On by default, because that is the news and film layout: the hero sits above
   * the date and the article text. **It removes the block's whole parent**, not
   * just the block — on a post that parent is the wrapper the migrator put
   * around it, but on an arbitrary page it is whatever column the editor
   * happened to drop the gallery into, siblings included. Measured over od-dev
   * 2026-08-17: of the 170 published pages exactly 2 carry a gallery, **neither**
   * as a leading top-level block, and **both** would lose sibling content
   * (`/sp/` a heading). So `WpPage` passes `false` — see `wp-page-redesign.md`.
   */
  liftHeader?: boolean;
  /**
   * Components to render in place of the links that point at them, keyed by
   * href exactly as the body spells it.
   *
   * This is how a WordPress body reaches a React component with data of its own:
   * the content holds a plain link, the page fetches whatever that link names,
   * and the link is swapped for the rendered result. `WpPage` uses it for the
   * `profile` records a page links (see `profileLinks.ts`); a body with
   * no such link, or a page that passes nothing, parses exactly as before.
   *
   * A `Map`, not an object: the keys are content, and `'__proto__' in {}` is
   * `true`.
   */
  embeds?: Map<string, ReactNode>;
}

export const parsePost = (data = '', { liftHeader = true, embeds }: ParsePostOptions = {}): PostContent => {
  let header: string | JSX.Element | JSX.Element[] = '';

  const body = parse(data, {
    replace: (domNode) => {
      if (domNode instanceof Comment) {
        return <></>;
      }

      if (!isElement(domNode)) {
        return domNode;
      }

      if (embeds?.size) {
        const embedded = soleEmbedHref(domNode, embeds);
        if (embedded) {
          return <>{embeds.get(embedded)}</>;
        }
      }

      if (!liftHeader) {
        return domNode;
      }

      const { carousel, gallery } = findCarouselOrGallery(domNode.children as DOMNode[]);
      const targetNode = carousel ?? gallery;

      if (!header && targetNode) {
        header = domToReact([targetNode]);
        return <></>;
      }

      const isCarousel = domNode.attribs.class?.includes('wp-block-cb-carousel-v2');
      const isGallery = domNode.attribs.class?.includes('wp-block-gallery');

      if (!header && (isCarousel || isGallery)) {
        header = domToReact([domNode]);
        return <></>;
      }

      return domNode;
    },
    transform: (reactNode): string | void | ReactElement | null =>
      Children.count(reactNode) > 0 ? (reactNode as ReactElement) : null,
  });

  return {
    body,
    header,
  };
};
