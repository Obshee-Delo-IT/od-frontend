import { describe, expect, it } from 'vitest';
import { buildNewsPreview, stripHtml } from './newsPreview';

describe('stripHtml', () => {
  it('strips tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello   <strong>world</strong></p>\n')).toBe('Hello world');
  });

  it('drops <style> and <script> blocks with their inner content', () => {
    expect(stripHtml('<style>.x{width:100%}</style><p>Text</p>')).toBe('Text');
    expect(stripHtml('<script>alert(1)</script>Body')).toBe('Body');
  });

  it('decodes named and numeric entities', () => {
    expect(stripHtml('&laquo;Word&raquo; &amp; more&hellip;')).toBe('«Word» & more…');
    expect(stripHtml('a&#8230; b&#8212;c')).toBe('a… b—c');
  });

  it('returns an empty string for nullish input', () => {
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml(null)).toBe('');
    expect(stripHtml('')).toBe('');
  });
});

describe('buildNewsPreview', () => {
  it('prefers the excerpt when present', () => {
    expect(buildNewsPreview('<p>Real excerpt</p>', '<p>Full content</p>')).toBe('Real excerpt');
  });

  it('falls back to content when the excerpt is empty', () => {
    expect(buildNewsPreview('', '<style>.x{}</style><p>Content body</p>')).toBe('Content body');
    expect(buildNewsPreview(undefined, '<p>Body only</p>')).toBe('Body only');
  });

  it('returns null when neither excerpt nor content has text', () => {
    expect(buildNewsPreview('', '')).toBeNull();
    expect(buildNewsPreview(undefined, undefined)).toBeNull();
  });

  it('truncates a long content fallback at a word boundary with an ellipsis', () => {
    const long = `<p>${'word '.repeat(100).trim()}</p>`;
    const preview = buildNewsPreview('', long);

    expect(preview).not.toBeNull();
    expect(preview!.length).toBeLessThanOrEqual(301);
    expect(preview!.endsWith('…')).toBe(true);
    expect(preview).not.toContain('wor…'); // cut on whitespace, not mid-word
  });
});

describe('buildNewsPreview, against the excerpts WordPress really sends', () => {
  it("drops WP's own read-more link, which repeats the whole title", () => {
    const excerpt =
      '<p>Научно-познавательный мультфильм про сахар&hellip; ' +
      '<a class="more-link" href="https://wp.test/74794/">Читать далее ' +
      '<span class="screen-reader-text">САХАР АТАКУЕТ</span></a></p>';

    expect(buildNewsPreview(excerpt, null)).toBe('Научно-познавательный мультфильм про сахар…');
  });

  it('bounds the excerpt at the same length as the content fallback', () => {
    const preview = buildNewsPreview(`<p>${'слово '.repeat(120)}</p>`, null);

    expect(preview?.length).toBeLessThanOrEqual(301);
    expect(preview?.endsWith('…')).toBe(true);
  });
});

/**
 * Editors paste the headline as the post's first line and leave the manual
 * excerpt empty, so WordPress builds `excerpt.rendered` out of a body that opens
 * with the title — and the card printed the headline twice. Measured on
 * production: 16 of the newest 20 posts, and 0 of 40 sampled across 2011-2022.
 */
describe('buildNewsPreview, dropping the headline echo', () => {
  const TITLE = 'ЗДОРОВЬЕ — ВАЖНЕЙШИЙ РЕСУРС В ПОВСЕДНЕВНОЙ ЖИЗНИ';
  /* The real shape, and the one the cut is keyed on: the editor pastes the
     headline as the body's first line, leaves the manual excerpt empty, and
     `wp_trim_excerpt` flattens both into one paragraph. So the excerpt alone
     cannot tell an echo from a sentence — the body is what says which it is. */
  const body = (title: string, rest: string): string => `<p>${title}</p>\n<p>${rest}</p>`;

  it('cuts a leading verbatim copy of the title', () => {
    const rest = '21 апреля в МАОУ «Башкирская гимназия» состоялось занятие.';

    expect(buildNewsPreview(`<p>${TITLE} ${rest}</p>`, body(TITLE, rest), TITLE)).toBe(rest);
  });

  it('matches across case, ё and quote glyphs, and emits the original text', () => {
    const title = 'Всё об опыте «Общего дела» в Якутии';
    const rest = 'В Якутске состоялся форум по общественному здоровью.';
    const excerpt = '<p>ВСЕ ОБ ОПЫТЕ "ОБЩЕГО ДЕЛА" В ЯКУТИИ. В Якутске состоялся форум по общественному здоровью.</p>';

    expect(buildNewsPreview(excerpt, body('ВСЕ ОБ ОПЫТЕ "ОБЩЕГО ДЕЛА" В ЯКУТИИ', rest), title)).toBe(rest);
  });

  it('reads past the block wrappers and the gallery a Gutenberg body opens with', () => {
    /* #74417's real shape: `<div class="wp-block-group">` twice, then a gallery,
       then the pasted headline. The first *block* closes several levels in and
       carries no text, so the signal has to be the first line that does. */
    const rest = '21 апреля в МАОУ «Башкирская гимназия» состоялось занятие по профилактике.';
    const content = `<div class="wp-block-group"><div class="wp-block-group__inner-container"><figure class="wp-block-gallery"><img src="a.jpg" alt="фото"/></figure><p>${TITLE}</p><p>${rest}</p></div></div>`;

    expect(buildNewsPreview(`<p>${TITLE} ${rest}</p>`, content, TITLE)).toBe(rest);
  });

  it('cuts a title that is itself the whole first sentence of the lede', () => {
    // #74524. The copy ends in a full stop, so what follows is another sentence.
    const title = '20 апреля в рамках конкурса «Общее дело-ПРО» прошёл форум «Про-Защита».';
    const rest = 'Участники представили свои проекты и обсудили профилактическую работу в школах.';

    expect(buildNewsPreview(`<p>${title} ${rest}</p>`, `<p>${title} ${rest}</p>`, title)).toBe(rest);
  });

  it('leaves a title that is only the opening of a longer sentence', () => {
    // #74234. No full stop, so the line runs on and the cut would start mid-clause.
    const title = '3 февраля 2026 года в Москве прошёл «ПРО-форум» для команд-добровольцев';
    const line = `${title}, участвующих в конкурсе социальных проектов в сфере здоровьесбережения.`;

    expect(buildNewsPreview(`<p>${line}</p>`, `<p>${line}</p>`, title)).toBe(line);
  });

  it("leaves the title alone when it is the first sentence's subject, not a line of its own", () => {
    // The body's first block is a whole sentence that merely starts with the
    // title. Cutting it leaves «продолжает работу…» with nothing to agree with.
    const text = 'Общее дело в Республике Саха продолжает работу в школах региона и провело двенадцать занятий.';

    expect(buildNewsPreview(`<p>${text}</p>`, `<p>${text}</p>`, 'Общее дело в Республике Саха')).toBe(text);
  });

  it('leaves a description that merely opens with the same word', () => {
    // The whole title has to be the line — a shared first word or two is how
    // most Russian ledes legitimately start.
    const text = 'Общее дело провело в Люберцах профилактические встречи-беседы со школьниками.';

    expect(buildNewsPreview(`<p>${text}</p>`, `<p>${text}</p>`, 'Общее дело в школе №2 города Люберцы')).toBe(text);
  });

  it('leaves a title that only appears mid-text', () => {
    // «САХАР АТАКУЕТ» inside a sentence is part of the sentence.
    const text = 'ОПИСАНИЕ МУЛЬТФИЛЬМА «САХАР АТАКУЕТ» Ребенок снова требует конфету. Что делать родителям?';

    expect(buildNewsPreview(`<p>${text}</p>`, `<p>${text}</p>`, 'САХАР АТАКУЕТ')).toBe(text);
  });

  it('falls through to the body when the whole excerpt is the title', () => {
    const title = 'Профилактическое занятие в гимназии';
    const rest = 'На занятии говорили о проблеме наркотизации общества и её последствиях.';

    expect(buildNewsPreview(`<p>${title}</p>`, body(title, rest), title)).toBe(rest);
  });

  it('keeps the echo when the post has nothing else to say', () => {
    // #19891 in full. A description that repeats the title beats none at all.
    const post = '<p>Письмо Путину. Откровение.</p>';

    expect(buildNewsPreview(post, post, 'Письмо Путину')).toBe('Письмо Путину. Откровение.');
  });

  it('ignores a title too short to be a signal', () => {
    const text = 'Дети и подростки на занятии слушали о вреде табака и алкоголя.';

    expect(buildNewsPreview(`<p>${text}</p>`, `<p>Дети</p><p>${text}</p>`, 'Дети')).toBe(text);
  });

  it('spends the whole budget on text the reader has not just read', () => {
    // Truncation runs after the cut: the echo used to eat up to 170 of 300 chars.
    const title = 'Форум добровольческих команд «Общее дело ПРО. Защита» в школах Якутии';
    const rest = 'слово '.repeat(120);
    const preview = buildNewsPreview(`<p>${title} ${rest}</p>`, body(title, rest), title)!;

    expect(preview.startsWith('слово')).toBe(true);
    expect(preview.length).toBeGreaterThan(290);
  });

  it('behaves exactly as before when no title is passed', () => {
    const text = 'ЗАГОЛОВОК ЦЕЛИКОМ И ПОЛНОСТЬЮ А дальше текст новости про занятие.';

    expect(buildNewsPreview(`<p>${text}</p>`, null)).toBe(text);
  });
});
