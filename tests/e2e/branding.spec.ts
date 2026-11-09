import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { setupCatalogue } from './catalogue-fixture';

test.beforeAll(setupCatalogue);
const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));

async function enter(page: Page) {
  await page.goto('/bienvenida');
  await page.getByRole('link', { name: 'Explorar demo', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByText('Hola, Andrea', { exact: true })).toBeVisible();
}

async function checkContrast(page: Page) {
  const failures = await page.evaluate(() => {
    type Color = [number, number, number, number];
    const color = (text: string): Color => {
      const n = text.match(/[\d.]+/g)!.map(Number);
      return [n[0], n[1], n[2], n[3] ?? 1];
    };
    const luminance = (c: Color) =>
      c.slice(0, 3).reduce((sum, value, i) => {
        const n = value / 255;
        return (
          sum +
          [0.2126, 0.7152, 0.0722][i] * (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
        );
      }, 0);
    const contrast = (a: Color, b: Color) =>
      (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
    const background = (node: Element | null): Color => {
      if (!node) return [255, 255, 255, 1];
      const own = color(getComputedStyle(node).backgroundColor);
      if (own[3] === 1) return own;
      const under = background(node.parentElement);
      return [0, 1, 2].map((i) => own[i] * own[3] + under[i] * (1 - own[3])).concat(1) as Color;
    };
    const problems: string[] = [];
    for (const element of document.querySelectorAll(
      'h1,h2,h3,p,small,strong,label,button,a,summary,legend,span,input,select,textarea',
    )) {
      if (element.closest('.welcome-hero,fieldset:disabled,[disabled],[aria-hidden="true"]'))
        continue;
      const directText = [...element.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim();
      if (!directText && !element.matches('input,select,textarea')) continue;
      const rect = element.getBoundingClientRect();
      const clip = element.closest('.viewport')?.getBoundingClientRect();
      if (
        !rect.width ||
        !rect.height ||
        rect.top >= (clip?.bottom ?? innerHeight) ||
        rect.bottom <= (clip?.top ?? 0)
      )
        continue;
      const style = getComputedStyle(element);
      if (element.matches('input:not([type="checkbox"]),select,textarea')) {
        const border = color(style.borderTopColor);
        const inside = contrast(border, background(element));
        const outside = contrast(border, background(element.parentElement));
        if (parseFloat(style.borderTopWidth) > 0 && Math.max(inside, outside) < 3)
          problems.push(
            `Control boundary ${element.tagName}: ${Math.max(inside, outside).toFixed(2)}`,
          );
      }
      if (
        element.matches(':focus-visible') &&
        parseFloat(style.outlineWidth) > 0 &&
        contrast(color(style.outlineColor), background(element.parentElement)) < 3
      )
        problems.push(`Focus outline ${element.tagName}: below 3:1`);
      const ratio = contrast(color(style.color), background(element));
      if (ratio < 4.5)
        problems.push(`${element.tagName} ${directText.slice(0, 55)}: ${ratio.toFixed(2)}`);
    }
    return problems;
  });
  expect(failures).toEqual([]);
}

const brandPaths = [
  '/inicio',
  '/explorar',
  '/cuenta',
  '/empresa',
  '/perfil',
  '/equipo',
  '/desafios',
  '/desafios/CH-R01',
  '/innovacion',
  '/innovacion/cases/CASE-02',
  '/formacion',
  '/formacion/LEARN-D01',
  '/calendario',
  '/calendario/EV-R01',
  '/financiamiento',
  '/financiamiento/FUND-R20',
  '/alianzas',
  '/alianzas/ALL-D01',
  '/postulaciones',
  '/preferencias',
];

for (const width of [360, 390, 430])
  test(`brand ${width}: logo, Rubik, contrast and all screen families`, async ({ page }) => {
    mkdirSync('.local/screenshots', { recursive: true });
    await page.setViewportSize({ width, height: 844 });
    const fonts: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('.woff2')) fonts.push(response.url());
    });
    await page.goto('/bienvenida');
    const welcomeLogo = page.locator('.welcome-logo');
    await expect(welcomeLogo).toHaveAttribute('src', '/brands/expande/logo-white.svg');
    await expect(welcomeLogo).toHaveAttribute('alt', 'Expande, somos FCh');
    await expect
      .poll(() =>
        welcomeLogo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
      )
      .toBe(true);
    expect((await welcomeLogo.boundingBox())!.width).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    for (const weight of [300, 400, 500, 600]) {
      expect(
        await page.evaluate(
          async (w) =>
            (
              await document.fonts.load(
                `${w} 16px "Rubik Variable"`,
                'Innovación, Ñuble, región y minería',
              )
            ).length,
          weight,
        ),
      ).toBeGreaterThan(0);
    }
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
    await checkContrast(page);
    await page.screenshot({ path: `.local/screenshots/brand-bienvenida-${width}.png` });
    await page.getByRole('link', { name: 'Explorar demo', exact: true }).click();
    await checkContrast(page);
    await page.screenshot({ path: `.local/screenshots/brand-acceso-${width}.png` });
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    for (const path of brandPaths) {
      await page.goto(path);
      await expect(page.locator('.viewport')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
        'Rubik Variable',
      );
      if (['/inicio', '/explorar', '/cuenta'].includes(path)) {
        const logo = page.locator('.topbar .brand-logo');
        await expect(logo).toHaveAttribute('src', '/brands/expande/logo-color.svg');
        expect((await logo.boundingBox())!.width).toBe(120);
      }
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('.viewport,.page,.topbar,.card,.modal')]
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => el.className),
      );
      expect(overflow, path).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await checkContrast(page);
      await page.screenshot({
        path: `.local/screenshots/brand-${path.slice(1).replaceAll('/', '-')}-${width}.png`,
      });
    }
    await page.goto('/empresa');
    const field = page.getByRole('combobox', { name: 'País', exact: true });
    await field.focus();
    expect(await field.evaluate((el) => getComputedStyle(el).outlineWidth)).toBe('3px');
    await checkContrast(page);
    await page.goto('/equipo');
    await page.getByRole('button', { name: 'Invitar Integrante', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await checkContrast(page);
    expect(await page.locator('.modal').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.local/screenshots/brand-modal-${width}.png` });
  });

test('dark mode keeps route families accessible and free of overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/cuenta');
  await page.getByRole('switch', { name: 'Modo oscuro', exact: true }).click();

  for (const path of ['/bienvenida', '/acceso', ...brandPaths]) {
    await page.goto(path);
    await expect(page.locator('.phone')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('.viewport,.page,.topbar,.card,.modal')]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.className),
    );
    expect(overflow, path).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await checkContrast(page);
  }

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('brand desktop framing, approved vector variants and favicon load', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await enter(page);
  await expect(page.locator('.desktop-caption .brand-logo')).toHaveCount(0);
  expect((await page.locator('.phone').boundingBox())!.width).toBe(393);
  await page.screenshot({ path: '.local/screenshots/brand-desktop.png' });
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/brands/expande/mark-x.svg',
  );
  for (const name of [
    'logo-color',
    'logo-white',
    'logo-black',
    'mark-x',
    'plus-magenta',
    'plus-yellow',
    'plus-mint',
  ]) {
    const response = await page.request.get(`/brands/expande/${name}.svg`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<path ');
  }
  await page.setContent(
    `<body style="margin:24px;background:#E7EEF1;display:grid;gap:24px">${['color', 'white', 'black'].map((v) => `<div style="padding:24px;background:${v === 'white' ? '#053349' : '#fff'}"><img src="http://127.0.0.1:3099/brands/expande/logo-${v}.svg" style="width:618px;height:auto"/></div>`).join('')}</body>`,
  );
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: '.local/screenshots/brand-logo-variants.png', fullPage: true });
});
