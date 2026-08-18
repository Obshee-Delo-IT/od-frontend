import { describe, expect, it } from 'vitest';
import { parseProfileBody } from './profileCard';

/**
 * Profile 46651 (Андрей Алексеевич Рязанов), the coordinator embedded on
 * `/materials/metodichki/` — captured from od-dev 2026-08-17, trimmed to the
 * right-hand column. Note the leading empty `<style>`: a site-wide `the_content`
 * filter puts one on every profile and every page.
 */
const LINKED = `<style type="text/css"></style><div class="wp-block-column">
<p><strong>Координатор по городу Магнитогорску, практикующий психолог</strong><br />Образование: Педагог-психолог</p>
<p><a href="tel:+7(904)818-08-69">+7(904)818-08-69</a></p>
<p><a href="tel:+79677302882">+7(967)730-28-82</a></p>
<p>E-mail: <a href="mailto:obshcheedelo@inbox.ru">obshcheedelo@inbox.ru</a></p>
</div>`;

/** Profile 72293 (Романуша Артем Александрович) — the same fields as plain text. */
const UNLINKED = `<style type="text/css"></style><div class="wp-block-column">
<p><strong>Координатор. Новосибирского отделения<br />
общественной организации  «Общее дело».</strong></p>
<p>Романуша Артем Александрович</p>
<p>89185700050</p>
<p>https://vk.com/romanusha</p>
</div>`;

describe('parseProfileBody', () => {
  it('reads the role off the first bold run, entities and <br> flattened', () => {
    expect(parseProfileBody(LINKED).role).toBe('Координатор по городу Магнитогорску, практикующий психолог');
    expect(parseProfileBody(UNLINKED).role).toBe(
      'Координатор. Новосибирского отделения общественной организации «Общее дело».'
    );
  });

  it('reads the linked contacts, in document order, keeping the label the record shows', () => {
    expect(parseProfileBody(LINKED).contacts).toEqual([
      { kind: 'phone', href: 'tel:+7(904)818-08-69', label: '+7(904)818-08-69' },
      { kind: 'phone', href: 'tel:+79677302882', label: '+7(967)730-28-82' },
      { kind: 'email', href: 'mailto:obshcheedelo@inbox.ru', label: 'obshcheedelo@inbox.ru' },
    ]);
  });

  it('classifies telegram and VK by host', () => {
    const html = `<p><a href="https://t.me/paramon1302">@paramon1302</a></p>
      <p><a href="https://vk.com/id39335667">https://vk.com/id39335667</a></p>`;
    expect(parseProfileBody(html).contacts.map((c) => c.kind)).toEqual(['telegram', 'vk']);
  });

  it('is not fooled by a host that merely mentions one — the whole hostname is compared', () => {
    const html = '<a href="https://vk.com.evil.example/x">п</a><a href="https://news.example/about-t.me">н</a>';
    expect(parseProfileBody(html).contacts).toEqual([]);
  });

  it('ignores ordinary links, including the body image WordPress wraps in an <a>', () => {
    const html = '<figure><a href="/wp-content/uploads/2017/09/p-300x169.jpeg"><img src="x" alt=""/></a></figure>';
    expect(parseProfileBody(html).contacts).toEqual([]);
  });

  it('drops a repeated href rather than repeating the row', () => {
    const html = '<a href="tel:+7000">a</a><a href="tel:+7000">a</a>';
    expect(parseProfileBody(html).contacts).toHaveLength(1);
  });

  it('falls back to the href when an anchor has no text — WP link fields do get left empty', () => {
    const html = '<a href="mailto:a@b.ru"></a><a href="https://t.me/x"><span></span></a>';
    expect(parseProfileBody(html).contacts).toEqual([
      { kind: 'email', href: 'mailto:a@b.ru', label: 'a@b.ru' },
      { kind: 'telegram', href: 'https://t.me/x', label: 't.me/x' },
    ]);
  });

  it('shows a URL label without its scheme, and leaves a handle alone', () => {
    const html =
      '<a href="https://vk.com/id39335667">https://vk.com/id39335667</a>' +
      '<a href="https://t.me/paramon1302">@paramon1302</a>' +
      '<a href="https://vk.com/od">https://www.vk.com/od/</a>';
    expect(parseProfileBody(html).contacts.map(({ label }) => label)).toEqual([
      'vk.com/id39335667',
      '@paramon1302',
      'vk.com/od',
    ]);
  });

  it('finds nothing in a record that only types its contacts — the known limit', () => {
    expect(parseProfileBody(UNLINKED).contacts).toEqual([]);
  });

  it('answers for an empty record instead of throwing', () => {
    expect(parseProfileBody(undefined)).toEqual({ role: null, contacts: [] });
    expect(parseProfileBody('')).toEqual({ role: null, contacts: [] });
    expect(parseProfileBody('<p>ничего</p>')).toEqual({ role: null, contacts: [] });
  });
});
