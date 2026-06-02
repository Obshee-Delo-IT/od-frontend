/**
 * WordPress stores resized variants of an upload as `name-WIDTHxHEIGHT.ext`
 * (e.g. `photo-150x150.jpg`, `cover-300x169.jpg`); the un-suffixed file is the
 * full-resolution original. Card thumbnails were resolving to those small
 * variants — blurry once upscaled into the larger card slots, and on this site
 * the resized files aren't present on the media CDN at all (they 500). Stripping
 * the size suffix yields the full-size original, which the Next image optimizer
 * then downscales cleanly to the size each card actually needs.
 *
 * WordPress's `-scaled` original (its 2560px cap for very large uploads) has no
 * `WIDTHxHEIGHT` and is intentionally left untouched.
 */
export const toFullSizeImageUrl = (url: string | null | undefined): string | null => {
  if (!url) {
    return null;
  }
  return url.replace(/-\d+x\d+(?=\.[a-z0-9]+(?:\?|#|$))/i, '');
};
