const IMG_TAG = /<img\b[^>]*\bsrc=["']([^"']+)["']/i;

export const extractFirstImage = (html: string | undefined | null, baseUrl?: string): string | null => {
  if (!html) {
    return null;
  }
  const match = html.match(IMG_TAG);
  const src = match?.[1];
  if (!src) {
    return null;
  }
  if (!baseUrl || /^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
    return src;
  }
  return new URL(src, baseUrl).toString();
};
