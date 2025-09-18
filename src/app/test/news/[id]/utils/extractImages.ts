import parse, { Element } from 'html-react-parser';

export function extractImages(html: string): string[] {
  const images: string[] = [];

  parse(html, {
    replace: (domNode) => {
      if (domNode instanceof Element && domNode.name === 'img') {
        const src = domNode.attribs?.src;
        if (src) {
          images.push(src);
        }
      }
    },
  });

  return images;
}
