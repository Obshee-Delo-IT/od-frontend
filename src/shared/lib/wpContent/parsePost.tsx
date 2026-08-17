import parse, { DOMNode, Element, domToReact, Comment } from 'html-react-parser';
import { Children, JSX, ReactElement } from 'react';

type PostContent = {
  body?: string | JSX.Element | JSX.Element[];
  header?: string | JSX.Element | JSX.Element[];
};

const isElement = (node: unknown): node is Element => node instanceof Element;

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
}

export const parsePost = (data = '', { liftHeader = true }: ParsePostOptions = {}): PostContent => {
  let header: string | JSX.Element | JSX.Element[] = '';

  const body = parse(data, {
    replace: (domNode) => {
      if (domNode instanceof Comment) {
        return <></>;
      }

      if (!isElement(domNode) || !liftHeader) {
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
