import { describe, expect, it } from 'vitest';
import { resolveHeadingCase } from './resolveHeadingCase';

describe('resolveHeadingCase', () => {
  it('sentence-cases a heading typed in capitals', () => {
    expect(resolveHeadingCase('<h2 class="wp-block-heading">ЗДОРОВАЯ РОССИЯ</h2>')).toBe(
      '<h2 class="wp-block-heading">Здоровая россия</h2>'
    );
  });

  it('leaves a heading that carries its own casing alone', () => {
    // The 26 headings on 16 pages the CSS rule used to lowercase.
    const html = '<h2>Здоровая Россия — ОБЩЕЕ ДЕЛО!</h2>';

    expect(resolveHeadingCase(html)).toBe(html);
  });

  it('keeps markup and its attributes out of it', () => {
    expect(resolveHeadingCase('<h3><a href="/MATERIALS/">СМОТРЕТЬ <strong>ФИЛЬМ</strong></a></h3>')).toBe(
      '<h3><a href="/MATERIALS/">Смотреть <strong>фильм</strong></a></h3>'
    );
  });

  it('does not lower an entity, and does not read one as lowercase prose', () => {
    // `&laquo;` would otherwise both break on lowering and make the heading
    // look like it already has casing of its own.
    expect(resolveHeadingCase('<h2>&laquo;ОБЩЕЕ ДЕЛО&raquo;</h2>')).toBe('<h2>&laquo;Общее дело&raquo;</h2>');
  });

  it('capitalises the first letter, not the first character', () => {
    expect(resolveHeadingCase('<h2>«ЗДОРОВЫЕ ДЕТИ»</h2>')).toBe('<h2>«Здоровые дети»</h2>');
  });

  it('leaves a heading with no letters in it alone', () => {
    expect(resolveHeadingCase('<h2>2025 — 2026</h2>')).toBe('<h2>2025 — 2026</h2>');
  });

  it('applies at every level and leaves the rest of the body untouched', () => {
    expect(resolveHeadingCase('<p>ТЕКСТ</p><h4>ЗАГОЛОВОК</h4><p>ЕЩЁ ТЕКСТ</p>')).toBe(
      '<p>ТЕКСТ</p><h4>Заголовок</h4><p>ЕЩЁ ТЕКСТ</p>'
    );
  });

  it('handles an empty body', () => {
    expect(resolveHeadingCase()).toBe('');
    expect(resolveHeadingCase(null)).toBe('');
  });
});
