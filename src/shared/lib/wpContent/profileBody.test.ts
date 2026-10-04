import { describe, expect, it } from 'vitest';
import { profileSummary, stripProfileCardFields } from './profileBody';

/** Profile 71225 as od-dev stores it after `od_pages_profile_team()` has run. */
const RECORD = [
  '<div class="wp-block-columns">',
  '<div class="wp-block-column">',
  '<figure class="wp-block-image size-medium"><a href="/x-243x300.jpg"><img src="/x-243x300.jpg" alt=""/></a></figure>',
  '</div>',
  '<div class="wp-block-column">',
  '<p><strong>Уполномоченный по развитию в ЦФО. Координатор по Тульской области</strong></p>',
  '<p><a href="mailto:SilaOtechestva@mail.ru">SilaOtechestva@mail.ru</a></p>',
  '<p><strong>Координатор по Тульской области </strong>Касатиков Александр Юрьевич</p>',
  '<p>Тел.: <a href="tel:+79030377708">+7 903 037-77-08</a></p>',
  '<p>ВК: <a href="https://vk.com/id44507712">https://vk.com/id44507712</a></p>',
  '<p>Образование: Педагог-психолог</p>',
  '</div>',
  '</div>',
].join('\n');

describe('stripProfileCardFields', () => {
  const rest = stripProfileCardFields(RECORD);

  it('drops the photograph the card shows', () => {
    expect(rest).not.toContain('<figure');
  });

  it('drops the role line — a paragraph that is nothing but a bold run', () => {
    expect(rest).not.toContain('<strong>Уполномоченный по развитию в ЦФО.');
  });

  it("keeps a bold run that is followed by text — the record's own line says more", () => {
    expect(rest).toContain('<strong>Координатор по Тульской области </strong>Касатиков Александр Юрьевич');
  });

  it('drops every contact paragraph, label and all', () => {
    expect(rest).not.toContain('mailto:');
    expect(rest).not.toContain('tel:');
    expect(rest).not.toContain('vk.com');
    expect(rest).not.toContain('Тел.:');
  });

  it('keeps everything else — 121 of 139 records have some', () => {
    expect(rest).toContain('Образование: Педагог-психолог');
  });

  it('answers empty for a record that says nothing beyond its card', () => {
    const cardOnly = [
      '<figure class="wp-block-image"><img src="/a.jpg" alt=""/></figure>',
      '<p><strong>Координатор</strong></p>',
      '<p>E-mail: <a href="mailto:a@b.ru">a@b.ru</a></p>',
      '<p>&nbsp;</p>',
    ].join('\n');

    expect(stripProfileCardFields(cardOnly)).toBe('');
    expect(stripProfileCardFields('')).toBe('');
    expect(stripProfileCardFields(null)).toBe('');
  });

  it('never swallows the paragraphs between two it drops', () => {
    const html = '<p><a href="tel:+70000000000">1</a></p><p>биография</p><p><a href="mailto:a@b.ru">a</a></p>';

    expect(stripProfileCardFields(html)).toContain('биография');
  });

  it('leaves an ordinary link alone', () => {
    const html = '<p>См. <a href="/materials/">материалы</a></p>';

    expect(stripProfileCardFields(html)).toBe(html);
  });

  it('keeps a body whose only content is an image — that is content, not a card field', () => {
    const html = '<figure><img src="/a.jpg" alt=""/></figure><figure><img src="/b.jpg" alt=""/></figure>';

    expect(stripProfileCardFields(html)).toContain('/b.jpg');
  });

  describe('a line that only repeats the card', () => {
    // Shapes from prod records, 2026-10-05 — `kabakov`, `тимашев-…`, `malenkin`, `chagaev`.
    const card = { name: 'Кабаков Павел Дмитриевич', role: 'Координатор проекта' };

    it('drops the role and the name on one line', () => {
      const html = '<p class="wp-block-paragraph"><strong>Координатор проекта</strong> Кабаков Павел Дмитриевич</p>';

      expect(stripProfileCardFields(html, card)).toBe('');
    });

    it('drops the name on a line of its own', () => {
      const html = '<p>Кабаков Павел Дмитриевич</p><p>Руководитель Воронежского отделения</p>';

      expect(stripProfileCardFields(html, card)).toBe('<p>Руководитель Воронежского отделения</p>');
    });

    it('drops the role as a list item, and the list once it is empty', () => {
      const html = '<ul>\n<li><strong>Координатор проекта</strong></li>\n</ul><p>Образование: высшее</p>';

      expect(stripProfileCardFields(html, card)).toBe('<p>Образование: высшее</p>');
    });

    it('ignores case, the way an editor retyped the role', () => {
      expect(stripProfileCardFields('<p>Координатор Проекта</p>', card)).toBe('');
    });

    it('keeps a line that says more than the card', () => {
      const html = '<p>город Воркута Координатор проекта Кабаков Павел Дмитриевич</p>';

      expect(stripProfileCardFields(html, card)).toBe(html);
    });

    it('keeps a line that only contains part of the role', () => {
      const html = '<p>Координатор</p>';

      expect(stripProfileCardFields(html, card)).toBe(html);
    });
  });
});

describe('profileSummary', () => {
  it('is the remainder as plain text, one line per paragraph or item', () => {
    const html = [
      '<p><strong>Координатор</strong></p>',
      '<p>Иванов Иван</p>',
      '<ul><li>Лектор</li><li>Психолог &#8212; педагог</li></ul>',
      '<p>Образование:<br>Юрист</p>',
      '<p><a href="tel:+70000000000">1</a></p>',
    ].join('\n');

    expect(profileSummary(html, { name: 'Иванов Иван', role: 'Координатор' })).toBe(
      'Лектор\nПсихолог — педагог\nОбразование:\nЮрист'
    );
  });

  it('is empty when the card already says everything', () => {
    expect(profileSummary('<p><strong>Координатор</strong></p>', { role: 'Координатор' })).toBe('');
  });
});
