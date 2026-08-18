const RELATIVE_UPLOAD_ATTR = /\b(src|href)=(["'])(\/wp-content\/)/g;

/**
 * Film post bodies reference uploads with root-relative URLs
 * (`src="/wp-content/uploads/…"`), which would resolve against the Next.js
 * origin and 404. Absolutize them against the WP origin so the shared image
 * pipeline (`resolveContentAssets` → `resolveMediaUrl`) can pick them up.
 */
export const absolutizeWpMedia = (html: string, wpOrigin: string): string =>
  html.replace(RELATIVE_UPLOAD_ATTR, (_match, attr, quote, path) => `${attr}=${quote}${wpOrigin}${path}`);
