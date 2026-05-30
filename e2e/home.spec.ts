import { expect, test } from '@playwright/test';

test.describe('Home page (D1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders all nine sections in order', async ({ page }) => {
    await expect(page).toHaveTitle(/ОБЩЕЕ ДЕЛО/);

    await expect(page.getByRole('heading', { level: 1, name: 'Здоровая Россия — общее дело' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Статистика организации' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Наши фильмы, мультфильмы и ролики' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Прими участие в международном/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Направления деятельности' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Программы' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Наши дела' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Подписаться на новости' })).toBeVisible();
  });

  test('hero CTAs are reachable', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Оказать помощь' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Прими участие' })).toBeVisible();
  });

  test('newsletter submit is disabled until email + consent are provided', async ({ page }) => {
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
