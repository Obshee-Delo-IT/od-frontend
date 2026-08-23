import { expect, test } from '@playwright/test';

import { NEWSLETTER_SIGNUP_ENABLED } from '../src/shared/config/features';

test.describe('Home page (D1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders all seven sections', async ({ page }) => {
    await expect(page).toHaveTitle(/ОБЩЕЕ ДЕЛО/);

    await expect(page.getByRole('heading', { level: 1, name: 'Здоровая Россия — общее дело' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Статистика организации' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Наши фильмы, мультфильмы и ролики' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Прими участие в международном/ })).toBeVisible();
    // Two carousels as Figma draws them. They fold into one «Программы и
    // направления деятельности» whenever the directions thin out to fewer than
    // three — see SPLIT_HOME_SECTIONS in shared/config/programSections.ts.
    await expect(page.getByRole('heading', { name: 'Программы', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Направления деятельности' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Наши дела' })).toBeVisible();

    // The seventh section is behind NEWSLETTER_SIGNUP_ENABLED: with the flag
    // off the form renders nowhere, and asserting it is how this suite went red
    // at HEAD without CI noticing (e2e is deliberately out of CI).
    const newsletter = page.getByRole('heading', { name: 'Подписаться на новости' });
    if (NEWSLETTER_SIGNUP_ENABLED) {
      await expect(newsletter).toBeVisible();
    } else {
      await expect(newsletter).toHaveCount(0);
    }
  });

  test('hero CTAs are reachable', async ({ page }) => {
    // Links, not buttons: both CTAs are `<Button asChild>` around an anchor.
    // Scoped to the hero — the header carries a second «Оказать помощь».
    const hero = page.getByRole('region', { name: 'Здоровая Россия — общее дело' });

    await expect(hero.getByRole('link', { name: 'Оказать помощь' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Прими участие' })).toBeVisible();
  });

  test('newsletter submit is disabled until email + consent are provided', async ({ page }) => {
    test.skip(!NEWSLETTER_SIGNUP_ENABLED, 'NEWSLETTER_SIGNUP_ENABLED is off — the form renders nowhere.');

    const submit = page.getByRole('button', { name: 'Подписаться' });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder('Адрес электронной почты').fill('test@example.com');
    await expect(submit).toBeDisabled();

    await page.getByRole('checkbox', { name: /обработку персональных данных/ }).click();
    await expect(submit).toBeEnabled();
  });

  test('stats row shows all four cards', async ({ page }) => {
    await expect(page.getByText('лет работы')).toBeVisible();
    await expect(page.getByText('волонтеров')).toBeVisible();
    await expect(page.getByText('регионов')).toBeVisible();
    await expect(page.getByText('фильмов')).toBeVisible();
  });
});
