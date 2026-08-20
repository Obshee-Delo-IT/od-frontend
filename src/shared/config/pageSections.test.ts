import { describe, expect, it } from 'vitest';
import { PAGE_SECTIONS, resolvePageSection } from './pageSections';

describe('PAGE_SECTIONS', () => {
  it("gives /team/ the mock's heading, not the WP title the tab carries", () => {
    expect(resolvePageSection('/team/')?.title).toBe('Команда');
  });

  it('gives both halves of «Устав и документы» the section heading, not their own', () => {
    expect(resolvePageSection('/about/ustav/')?.title).toBe('Устав и документы');
    expect(resolvePageSection('/about/docs/')?.title).toBe('Устав и документы');
    expect(resolvePageSection('/about/docs/')?.activeValue).toBe('docs');
  });

  it('leaves every other page exactly as it was', () => {
    expect(resolvePageSection('/materials/metodichki/')).toBeNull();
    expect(resolvePageSection('/team')).toBeNull();
  });

  it('every tab points at a page that is in the table — a strip with a dead end is the bug', () => {
    const keys = Object.keys(PAGE_SECTIONS);

    for (const section of Object.values(PAGE_SECTIONS)) {
      for (const tab of section.tabs) {
        expect(keys).toContain(tab.href);
      }
    }
  });

  it('each page owns one of the tabs it draws', () => {
    for (const [path, section] of Object.entries(PAGE_SECTIONS)) {
      const active = section.tabs.find((tab) => tab.value === section.activeValue);
      expect(active?.href).toBe(path);
    }
  });

  it('the trail ends on the page itself, unlinked', () => {
    for (const section of Object.values(PAGE_SECTIONS)) {
      const last = section.breadcrumbs.at(-1);
      expect(last?.href).toBeUndefined();
      expect(last?.label).toBe(section.title);
    }
  });
});
