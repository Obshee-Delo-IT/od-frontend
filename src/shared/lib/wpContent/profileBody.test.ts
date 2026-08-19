import { describe, expect, it } from 'vitest';
import { stripProfileCardFields } from './profileBody';

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
});
