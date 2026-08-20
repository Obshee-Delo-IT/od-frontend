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
 * The href of the link this **paragraph** exists only to hold, when that link
 * has an embed waiting — otherwise `null`.
 *
 * Matching the **wrapper** rather than the anchor is not a detail: an embed put
 * in the anchor's place would leave `<article>` inside the `<p>` WordPress wrote,
 * which the browser's parser splits back apart and hydration then fails on.
 * Requiring the wrapper to hold nothing else is what keeps a link written
 * mid-sentence a link.
 *
 * **And the wrapper has to be a `<p>`, not "any element".** It was any element
 * for one commit, which is a bug WordPress hands you for free: a `wp:query`
 * teaser renders the *same* post link twice, once wrapped in the featured
 * image's `<figure>` and once in the title's `<h3>`, and each of those is a
 * sole-child anchor. Swept over all 169 published od-dev pages there are exactly
 * five sole-child profile links — one `<p>` (the marker `od-pages.php` writes)
 * and two `<figure>`/`<h3>` pairs on `/contacts/kalmykiya/` and
 * `/contacts/novosibirskaya/`, which would each have drawn the coordinator's
 * card **twice** in place of a teaser. A paragraph is what the convention says
 * and what the content actually means.
 */
const soleEmbedHref = (node: Element, embeds: Map<string, ReactNode>): string | null => {
  if (node.tagName !== 'p') {
    return null;
  }
  const children = (node.children as DOMNode[]).filter((child) => !isBlank(child));
  const [only] = children;
  if (children.length !== 1 || !isElement(only) || only.tagName !== 'a') {
    return null;
  }
  const { href } = only.attribs;
  return href && embeds.has(href) ? href : null;
};

/** Every descendant href, in document order — a query card wraps its link twice. */
const hrefsIn = (node: Element): string[] =>
  (node.children as DOMNode[]).flatMap((child) => {
    if (!isElement(child)) {
      return [];
    }
    const own = child.tagName === 'a' && child.attribs.href ? [child.attribs.href] : [];
    return [...own, ...hrefsIn(child)];
  });

/**
 * The href a **query card** addresses, when an embed is waiting for it.
 *
 * The card, not the anchor: a `wp:query` teaser renders the same link twice (the
 * featured image's `<figure>` and the title), so swapping anchors would draw the
 * person twice and leave the other half of the teaser behind. `<li>` in,
 * `<li>` out — the list markup stays valid.
 *
 * This is what draws the coordinators on the 74 regional `/contacts/<region>/`
 * pages, whose list is a query over `pl-categs` and therefore names nobody in
 * the body. Figma `contact-page` (754:675) draws each of them as the card.
 */
const cardEmbedHref = (node: Element, embeds: Map<string, ReactNode>): string | null => {
  if (node.tagName !== 'li' || !(node.attribs.class ?? '').split(/\s+/).includes('wp-block-post')) {
    return null;
  }

  return hrefsIn(node).find((href) => embeds.has(href)) ?? null;
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
   * Two shapes are swapped and no others: a link **alone in its own `<p>`** (see
   * {@link soleEmbedHref} for why the paragraph is part of the contract and not
   * an implementation detail), and a **query card** whose link points at one
   * (see {@link cardEmbedHref}) — the case a page cannot express in its own
   * body, because the loop picks the records at render time.
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

        const card = cardEmbedHref(domNode, embeds);
        if (card) {
          // `od-person` is what tells the loop's own grid to stand down — see
          // `gutenberg.css`. A `<li>` because the parent is still a `<ul>`.
          return <li className="od-person">{embeds.get(card)}</li>;
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
