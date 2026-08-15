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

export const parsePost = (data = ''): PostContent => {
  let header: string | JSX.Element | JSX.Element[] = '';

  const body = parse(data, {
    replace: (domNode) => {
      if (domNode instanceof Comment) {
        return <></>;
      }

      if (!isElement(domNode)) {
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
