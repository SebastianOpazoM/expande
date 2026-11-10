import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { Store } from '../../server/store.ts';
import { fundingManifest } from '../../server/funding-catalogue.ts';
import { trainingManifest } from '../../server/training-catalogue.ts';
import { innovationManifest } from '../../server/innovation-catalogue.ts';
import { calendarThumbnailManifest } from '../../server/calendar-thumbnails.ts';
import { setupCatalogue } from './catalogue-fixture';
test.beforeAll(setupCatalogue);
for (const width of [360, 390, 430])
  test(`innovation ${width}: illustrated tabs, filters, navigation and clearing`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await enter(page);
    await page.goto('/innovacion');
    for (const [tab, value, imagePrefix] of [
      ['Casos', 'cases', 'case'],
      ['Noticias', 'news', 'news'],
      ['Tendencias', 'trends', 'trend'],
    ]) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`[?&]tab=${value}(?:&|$)`));
      await expect(page.locator('article.card')).toHaveCount(5);
      await expect(page.getByText('5 contenidos', { exact: true })).toBeVisible();
      const images = page.locator('article.card .learning-thumbnail img');
      await expect(images.first()).toHaveAttribute('src', new RegExp(`/${imagePrefix}-`));
      await images.last().scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          images.evaluateAll(
            (elements) =>
              elements.length === 5 &&
              elements.every(
                (element) =>
                  (element as HTMLImageElement).complete &&
                  (element as HTMLImageElement).naturalWidth > 0,
              ),
          ),
        )
        .toBe(true);
      await expect(page.locator('.provenance')).toHaveCount(0);
      await expect(page.getByText('Ejemplo ficticio', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByLabel('Buscar innovación').fill('ciberseguridad');
    await chooseSelect(page, 'Categoría / tema', 'seguridad');
    await expect(page.locator('article.card')).toHaveCount(1);
    const filtered = page.url();
    await page.locator('article.card .learning-cover-link').click();
    await expect(page).toHaveURL(/\/innovacion\/trends\/TREND-05$/);
    await expect(page.locator('.learning-detail-cover img')).toBeVisible();
    await page.screenshot({
      path: `.local/screenshots/innovacion-detail-${width}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(page).toHaveURL(filtered);
    await expect(page.getByLabel('Buscar innovación')).toHaveValue('ciberseguridad');
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(page.locator('article.card')).toHaveCount(5);
    await page.getByRole('button', { name: 'Casos', exact: true }).click();
    await chooseSelect(page, 'País', 'PE');
    await page.getByLabel('Buscar innovación').fill('asistente');
    await expect(page.locator('article.card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(page.locator('article.card')).toHaveCount(5);
    await page.screenshot({ path: `.local/screenshots/innovacion-${width}.png` });
  });

test('innovation details match all fifteen articles, preserve qualifiers and saved items', async ({
  page,
}) => {
  await enter(page);
  const data = await (await page.request.get('/api/v1/bootstrap')).json();
  for (const article of innovationManifest.articles) {
    const record = data[article.collection].find((row: any) => row.id === article.id);
    await page.goto(`/innovacion/${article.collection}/${article.id}`);
    await expect(page.getByRole('heading', { name: record.title, exact: true })).toBeVisible();
    const img = page.locator('.learning-detail-cover img');
    await expect(img).toHaveAttribute('src', record.thumbnail_url);
    await expect(img).toHaveAttribute('alt', record.thumbnail_alt);
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    for (const section of record.body_sections) {
      await expect(
        page.getByRole('heading', { name: section.heading, exact: true }).first(),
      ).toBeVisible();
      await expect(page.getByText(section.body, { exact: true })).toBeVisible();
    }
    await expect(page.locator('.provenance')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Fuente y documentos', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Ejemplo ficticio|Sin evidencia adicional en esta demostración/),
    ).toHaveCount(0);
    if (article.collection === 'cases' && !record.demo)
      await expect(page.getByText(record.results_status, { exact: true })).toBeVisible();
    if (article.id === 'CASE-02')
      await expect(page.getByText(record.results, { exact: true })).toContainText('preliminares');
    if (article.collection === 'cases' && record.demo) {
      await expect(
        page.getByRole('heading', { name: 'Indicadores propuestos', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Resultados reportados', exact: true }),
      ).toHaveCount(0);
    }
  }
  await page.goto('/innovacion/cases/CASE-02');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Quitar de guardados', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Quitar de guardados', exact: true }).click();
});

test('innovation broken cover keeps accessible reserved fallback on list and detail', async ({
  page,
}) => {
  await enter(page);
  await page.route('**/images/innovacion/case-04.jpg', (route) => route.abort());
  for (const path of ['/innovacion?q=Monitoreo', '/innovacion/cases/CASE-04']) {
    await page.goto(path);
    const fallback = page.locator('.learning-thumbnail-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('aria-label', /Bomba de proceso/);
    const box = await fallback.boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(16 / 9, 1);
  }
});

for (const width of [360, 390, 430])
  test(`calendar thumbnails ${width}: agenda, grid, tentative and unknown events`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await enter(page);
    await page.goto('/calendario?month=2027-11');
    for (const view of ['Agenda', 'Calendario']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.getByText(/^Fecha por confirmar \(/).click();
      const images = page.locator('article.card .learning-thumbnail img');
      expect(await images.count()).toBeGreaterThan(3);
      for (const img of await images.all()) {
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
          .toBe(true);
      }
      await expect(
        page.locator('.provenance').filter({ hasText: 'Antecedente documental' }),
      ).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.getByText(/^Fecha por confirmar \(/).click();
    }
    await page.goto('/calendario?month=2027-11');
    const first = page.locator('article.card .learning-cover-link').first();
    const href = await first.getAttribute('href');
    await first.click();
    await expect(page).toHaveURL(new RegExp(href! + '$'));
    await expect(page.locator('.learning-detail-cover img')).toBeVisible();
    await page.screenshot({ path: `.local/screenshots/calendario-detail-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(page).toHaveURL(/calendario\?month=2027-11$/);
    await page.screenshot({ path: `.local/screenshots/calendario-${width}.png` });
  });

test('all event details have matching covers and no source section; broken images have fallback', async ({
  page,
}) => {
  await enter(page);
  const data = await (await page.request.get('/api/v1/bootstrap')).json();
  for (const id of Object.keys(calendarThumbnailManifest.events)) {
    const row = data.events.find((event: any) => event.id === id);
    await page.goto('/calendario/' + id);
    const image = page.locator('.learning-detail-cover img');
    await expect(image).toHaveAttribute('src', row.thumbnail_url);
    await expect(image).toHaveAttribute('alt', row.thumbnail_alt);
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    await expect(page.getByRole('heading', { name: row.title, exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Fuente y documentos', exact: true }),
    ).toHaveCount(0);
    if (!row.demo) await expect(page.locator('.provenance')).toHaveCount(0);
    if (!row.start_date)
      await expect(page.getByRole('button', { name: 'Recordarme', exact: true })).toBeDisabled();
  }
  await page.route('**/images/calendario/energia.jpg', (route) => route.abort());
  await page.goto('/calendario/EV-R34');
  await expect(page.locator('.learning-thumbnail-fallback')).toBeVisible();
  await expect(page.locator('.learning-thumbnail-fallback')).toHaveAttribute(
    'aria-label',
    /Subestación/,
  );
});

for (const width of [360, 390, 430])
  test(`funding programmes ${width}: twelve covers, filters, clearing and return navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await enter(page);
    await page.goto('/financiamiento');
    await expect(page.locator('article.card')).toHaveCount(12);
    await expect(page.getByText('12 registros', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hitos y resultados', exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole('combobox', { name: 'Tipo de registro', exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.locator('article.card').filter({ hasText: 'Piloto de agua Demo' }),
    ).toHaveCount(0);
    for (const image of await page.locator('article.card .learning-thumbnail img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
    }
    await expect(page.locator('.provenance')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByLabel('Buscar Concursos y financiamiento').fill('Capital Humano');
    await expect(page.locator('article.card')).toHaveCount(1);
    await page.getByText('Filtros de financiamiento', { exact: true }).click();
    const queryKeyByLabel: Record<string, string> = {
      Segmento: 'segment',
      Región: 'region',
      Estado: 'state',
      Moneda: 'currency',
    };
    for (const [name, value] of [
      ['Segmento', 'pyme'],
      ['Región', 'Antofagasta'],
      ['Estado', 'por_confirmar'],
      ['Moneda', 'CLP'],
    ]) {
      await chooseSelect(page, name, value);
      await expect
        .poll(() => new URL(page.url()).searchParams.get(queryKeyByLabel[name]))
        .toBe(value);
    }
    await chooseSelect(page, 'Orden', 'monto');
    await expect(page.locator('article.card')).toHaveCount(1);
    const filtered = page.url();
    await page.locator('article.card .learning-cover-link').click();
    await expect(page).toHaveURL(/\/financiamiento\/FUND-R15$/);
    await expect(page.locator('.learning-detail-cover img')).toBeVisible();
    await page.screenshot({ path: `.local/screenshots/financiamiento-detail-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(page).toHaveURL(filtered);
    await expect(page.getByLabel('Buscar Concursos y financiamiento')).toHaveValue(
      'Capital Humano',
    );
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(page.locator('article.card')).toHaveCount(12);
    await page.locator('article.card').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.local/screenshots/financiamiento-${width}.png` });
  });

test('funding details match official programme data and archived saved links remain readable', async ({
  page,
}) => {
  await enter(page);
  const data = await (await page.request.get('/api/v1/bootstrap')).json();
  for (const programme of fundingManifest.programmes) {
    const row = data.funding_calls.find((record: any) => record.id === programme.id);
    await page.goto('/financiamiento/' + programme.id);
    await expect(page.getByRole('heading', { name: row.title, exact: true })).toBeVisible();
    await expect(page.locator('.learning-detail-cover img')).toHaveAttribute(
      'src',
      row.thumbnail_url,
    );
    for (const section of row.body_sections)
      await expect(page.getByText(section.body, { exact: true })).toBeVisible();
    await expect(page.getByText(row.eligibility, { exact: true })).toBeVisible();
    await expect(page.getByText(/Información revisada el/)).toBeVisible();
    await expect(page.locator('.provenance')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Fuente y documentos', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/Antecedente documental|Ejemplo ficticio/)).toHaveCount(0);
    await page.getByRole('button', { name: /Ver programa oficial/ }).click();
    await expect(page.getByRole('link', { name: /Abrir fuente externa/ })).toHaveAttribute(
      'href',
      row.official_url,
    );
  }
  await page.goto('/financiamiento/FUND-D01');
  await expect(page.getByText(/Registro archivado/)).toBeVisible();
  if (await page.getByRole('button', { name: 'Guardar', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.goto('/guardados');
  await page.getByRole('link', { name: 'Piloto de agua Demo', exact: true }).click();
  await expect(page.getByText(/Registro archivado/)).toBeVisible();
});

test('funding sorting keeps unknown amounts last and retired currency out of filter choices', async ({
  page,
}) => {
  await enter(page);
  await page.goto('/financiamiento?order=monto');
  await expect(
    page.getByText('Selecciona una moneda para ordenar por monto. No comparamos CLP con USD.'),
  ).toBeVisible();
  await page.goto('/financiamiento?currency=CLP&order=monto');
  await expect(page.locator('article.card').first().locator('.card-title')).toHaveText(
    'Start-Up Chile: Build, Ignite y Growth',
  );
  await expect(page.locator('article.card').last().locator('.card-title')).toHaveText(
    'Semilla Expande',
  );
  await page.getByText('Filtros de financiamiento', { exact: true }).click();
  const currencyOptions = await openSelect(page, 'Moneda');
  await expect(currencyOptions.locator('[role="option"][data-value="USD"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.goto('/financiamiento?currency=USD');
  await expect(page.locator('article.card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(page.locator('article.card')).toHaveCount(12);
  await page.route('**/images/financiamiento/fund-r13.jpg', (route) => route.abort());
  for (const path of ['/financiamiento?q=Innova%20Regi%C3%B3n', '/financiamiento/FUND-R13']) {
    await page.goto(path);
    await expect(page.locator('.learning-thumbnail-fallback')).toBeVisible();
    await expect(page.locator('.learning-thumbnail-fallback')).toHaveAttribute(
      'aria-label',
      /Centro industrial regional/,
    );
  }
});

test('funding verified deadline updates at Chile time without a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-24T15:59:00Z') });
  await enter(page);
  await page.goto('/financiamiento/FUND-R20');
  await expect(
    page
      .locator('.data-field')
      .filter({ has: page.getByRole('heading', { name: 'Estado de convocatoria', exact: true }) }),
  ).toContainText('Abierto');
  await expect(
    page.locator('.data-field').filter({
      has: page.getByRole('heading', { name: 'Cierre de convocatoria vigente', exact: true }),
    }),
  ).toContainText('13:00');
  await page.clock.fastForward(61000);
  await expect(
    page
      .locator('.data-field')
      .filter({ has: page.getByRole('heading', { name: 'Estado de convocatoria', exact: true }) }),
  ).toContainText('Cerrado');
});

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function enter(page: Page) {
  await page.goto('/bienvenida');
  await page.getByRole('link', { name: 'Explorar demo', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByText('Hola, Andrea')).toBeVisible();
}
const selectControl = (page: Page, name: string) =>
  page.getByRole('combobox', { name, exact: true });
async function openSelect(page: Page, name: string) {
  await selectControl(page, name).click();
  return page.getByRole('listbox', { name, exact: true });
}
async function chooseSelect(
  page: Page,
  name: string,
  selection: string | { label: string },
) {
  const listbox = await openSelect(page, name);
  const option =
    typeof selection === 'string'
      ? listbox.locator(`[role="option"][data-value=${JSON.stringify(selection)}]`)
      : listbox.getByRole('option', { name: selection.label, exact: true });
  await option.click();
}
async function expectSelectValue(page: Page, name: string, value: string) {
  await expect(selectControl(page, name)).toHaveAttribute('data-value', value);
}
for (const width of [360, 390, 430])
  test(`mobile ${width}: main routes, no overflow, controls and screenshots`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await enter(page);
    await page.getByRole('link', { name: 'Desafíos', exact: true }).last().click();
    await expect(page.getByText('12 desafíos · Todos los estados')).toBeVisible();
    await page.getByLabel('Buscar desafíos').fill('rastras');
    await expect(page.getByText('2 desafíos · Todos los estados')).toBeVisible();
    await page
      .locator('article')
      .filter({ hasText: 'Sensores para anticipar desgaste en rastras' })
      .getByRole('link', { name: 'Ver desafío', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Sensores para anticipar desgaste en rastras',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('Requisitos obligatorios')).toBeVisible();
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(page.getByLabel('Buscar desafíos')).toHaveValue('rastras');
    await page.getByLabel('Buscar desafíos').fill('');
    mkdirSync('.local/screenshots', { recursive: true });
    await page.screenshot({ path: `.local/screenshots/catalogue-${width}.png`, fullPage: true });
    for (const path of ['/inicio', '/desafios', '/postulaciones', '/explorar', '/cuenta']) {
      await page.goto(path);
      await expect(page.locator('.topbar')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBeTruthy();
      const nav = page.locator('.bottom-nav');
      await expect(nav).toBeVisible();
      const box = await nav.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(845);
      if (path === '/inicio') {
        const companyName = page.locator('.home-company-name');
        await expect(companyName).toHaveText('SensorAndes Demo');
        await expect(companyName).toHaveCSS('color', 'rgb(171, 18, 84)');
        const sizes = await companyName.evaluate((element) => ({
          company: parseFloat(getComputedStyle(element).fontSize),
          heading: parseFloat(getComputedStyle(element.parentElement!).fontSize),
        }));
        expect(sizes.company).toBeGreaterThan(sizes.heading);
        expect(sizes.company).toBeLessThanOrEqual(sizes.heading * 1.1);
      }
      if (path === '/explorar') {
        const viewport = page.locator('.viewport');
        expect(await viewport.evaluate((element) => element.scrollHeight)).toBeLessThanOrEqual(
          await viewport.evaluate((element) => element.clientHeight),
        );
      }
      if (path === '/cuenta') {
        const role = page.locator('.account-role');
        await expect(role).toHaveText('Administrador');
        await expect(role).toHaveCSS('background-color', 'rgb(171, 18, 84)');
        await expect(role).toHaveCSS('color', 'rgb(255, 255, 255)');
        const completion = page.getByRole('progressbar', {
          name: 'Progreso del perfil de organización',
          exact: true,
        });
        await expect(completion).toHaveAttribute('aria-valuenow', '100');
        await expect(page.locator('.profile-completion-medal')).toHaveText('100% · Completo');
      }
    }
    mkdirSync('.local/screenshots', { recursive: true });
    await page.goto('/bienvenida');
    await page.screenshot({ path: `.local/screenshots/welcome-${width}.png` });
    await page.goto('/inicio');
    await page.screenshot({ path: `.local/screenshots/home-${width}.png` });
  });

test('Explore uses shared card colors and readable supporting text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/explorar');

  const cards = page.locator('.explore-grid > a');
  await expect(cards).toHaveCount(5);
  for (const card of await cards.all()) {
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(card).toHaveCSS('border-color', 'rgb(217, 227, 229)');
    await expect(card.locator('.explore-icon')).toHaveCSS('color', 'rgb(171, 18, 84)');
    await expect(card.locator('strong')).toHaveCSS('font-size', '14px');
    await expect(card.locator('small')).toHaveCSS('font-size', '12px');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('challenge sorting matches the filter control treatment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/desafios');

  const filter = page.getByRole('button', { name: 'Filtros', exact: true });
  const sort = page.locator('.challenge-catalog-sort');
  const trigger = page.getByRole('combobox', { name: 'Ordenar', exact: true });
  await expect(trigger).toHaveCSS('background-color', 'rgb(171, 18, 84)');
  await expect(trigger).toHaveCSS('border-radius', '13px');
  await expect(trigger).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(trigger).toHaveCSS('text-align', 'center');
  const filterBox = await filter.boundingBox();
  const sortBox = await sort.boundingBox();
  expect(Math.abs(filterBox!.height - sortBox!.height)).toBeLessThanOrEqual(1);
  expect(sortBox!.width).toBeLessThanOrEqual(190);

  await trigger.click();
  const listbox = page.getByRole('listbox', { name: 'Ordenar', exact: true });
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole('option')).toHaveCount(3);
  await expect(
    listbox.getByRole('option', { name: 'Próximos a cerrar', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await listbox.getByRole('option', { name: 'Más recientes', exact: true }).click();
  await expect(page).toHaveURL(/order=recientes/);
  await expectSelectValue(page, 'Ordenar', 'recientes');
  await expect(trigger).toContainText('Más recientes');

  await trigger.press('ArrowDown');
  await page.getByRole('option', { name: 'Afinidad con mi solución', exact: true }).press('End');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/order=afinidad/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shared custom dropdown styling replaces native selects across the app', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/empresa');

  await expect(page.locator('select')).toHaveCount(0);
  const region = selectControl(page, 'Región de origen');
  await expect(region).toHaveClass(/custom-select-trigger/);
  await expect(region).toHaveCSS('text-align', 'center');
  await region.click();
  const options = page.getByRole('listbox', { name: 'Región de origen', exact: true });
  await expect(options).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(options.getByRole('option')).toHaveCount(17);
  await options.getByRole('option', { name: 'Atacama', exact: true }).click();
  await expectSelectValue(page, 'Región de origen', 'Atacama');

  await page.goto('/postulaciones');
  await expect(page.locator('select')).toHaveCount(0);
  await expect(selectControl(page, 'Estado')).toHaveCSS('text-align', 'center');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('Expande challenge badges use the purple brand treatment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/desafios');
  const badges = page.locator('.tags .tag-expande');
  expect(await badges.count()).toBeGreaterThan(0);
  await expect(badges.first()).toHaveText('Expande');
  await expect(badges.first()).toHaveCSS('background-color', 'rgb(171, 18, 84)');
  await expect(badges.first()).toHaveCSS('color', 'rgb(255, 255, 255)');

  await page.goto('/desafios/CH-D01');
  const detailBadge = page.locator('.tags .tag-expande');
  await expect(detailBadge).toHaveText('Expande');
  await expect(detailBadge).toHaveCSS('background-color', 'rgb(171, 18, 84)');
  await expect(detailBadge).toHaveCSS('color', 'rgb(255, 255, 255)');
});
test('challenge affinity uses distinct visual badges for matches and mismatches', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/desafios/CH-D01');

  const affinity = page.getByRole('list', { name: 'Resultado de afinidad', exact: true });
  await expect(affinity.getByRole('listitem')).toHaveCount(4);
  const match = affinity.locator('.affinity-badge.match').first();
  await expect(match).toContainText('Coincide');
  await expect(match).toHaveCSS('background-color', 'rgb(33, 101, 71)');
  await expect(match).toHaveCSS('color', 'rgb(255, 255, 255)');

  await chooseSelect(page, 'Evaluar con', 'SOL-02');
  const mismatch = affinity.locator('.affinity-badge.no-match').first();
  await expect(mismatch).toContainText('Sin coincidencia');
  await expect(mismatch).toHaveCSS('background-color', 'rgb(253, 197, 0)');
  await expect(mismatch).toHaveCSS('color', 'rgb(5, 51, 73)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('closed challenge uses a prominent closed-call badge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/desafios/CH-R04');

  const closed = page.locator('.challenge-availability-badge.closed');
  await expect(closed).toHaveText('Convocatoria cerrada');
  await expect(closed.locator('svg')).toBeVisible();
  await expect(closed).toHaveCSS('background-color', 'rgb(255, 240, 241)');
  await expect(closed).toHaveCSS('color', 'rgb(157, 43, 50)');
  await expect(page.getByRole('link', { name: 'Preparar antecedentes' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('upcoming challenge uses a prominent upcoming-call badge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/desafios/CH-D05');

  const upcoming = page.locator('.challenge-availability-badge.upcoming');
  await expect(upcoming).toHaveText('Próxima convocatoria');
  await expect(upcoming.locator('svg')).toBeVisible();
  await expect(upcoming).toHaveCSS('background-color', 'rgb(255, 244, 204)');
  await expect(upcoming).toHaveCSS('color', 'rgb(115, 81, 0)');
  await expect(page.getByRole('link', { name: 'Preparar antecedentes' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unconfirmed challenge uses a prominent unconfirmed-state badge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/desafios/CH-R03');

  const unconfirmed = page.locator('.challenge-availability-badge.unconfirmed');
  await expect(unconfirmed).toHaveText('Estado por confirmar');
  await expect(unconfirmed.locator('svg')).toBeVisible();
  await expect(unconfirmed).toHaveCSS('background-color', 'rgb(231, 238, 241)');
  await expect(unconfirmed).toHaveCSS('color', 'rgb(5, 51, 73)');
  await expect(page.getByRole('link', { name: 'Preparar antecedentes' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('challenge application action explains the external flow and returns home', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/desafios/CH-D01');

  await expect(page.getByText('Ir al portal de demostración', { exact: false })).toHaveCount(0);
  const apply = page.getByRole('button', { name: 'Postular a este desafío', exact: true });
  await apply.click();

  const dialog = page.getByRole('dialog', { name: 'Postular a este desafío', exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(
      'El flujo de postulación continuará en otro portal, donde podrás completar el proceso correspondiente.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    dialog.getByText('Esta demostración no envía antecedentes ni registra una postulación.', {
      exact: true,
    }),
  ).toBeVisible();

  await dialog.locator('.button-row').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await apply.click();
  await dialog.getByRole('link', { name: 'Volver al inicio', exact: true }).click();
  await expect(page).toHaveURL('/inicio');
  await expect(page.getByText('Hola, Andrea', { exact: true })).toBeVisible();
});

test('challenge tracking is automatic only for Expande and manual for market opportunities', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/desafios');

  await expect(page.locator('.challenge-tracking-summary.automatic')).toHaveCount(9);
  await expect(page.locator('.challenge-tracking-summary.manual')).toHaveCount(3);
  await expect(
    page.getByText(
      'Expande actualiza automáticamente el seguimiento de sus desafíos. En oportunidades de mercado, tu empresa mantiene el estado manualmente para conservar todo en un solo lugar.',
      { exact: true },
    ),
  ).toBeVisible();

  await page.goto('/desafios/CH-D01');
  await expect(
    page.getByRole('heading', { name: 'Automático con Expande', exact: true }),
  ).toBeVisible();
  const automatic = page.getByRole('button', {
    name: 'Activar seguimiento automático',
    exact: true,
  });
  await automatic.click();
  await expect(
    page.getByRole('button', { name: 'Desactivar seguimiento automático', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registrar seguimiento manual' })).toHaveCount(0);

  await page.goto('/desafios/CH-D05');
  await expect(
    page.getByRole('heading', { name: 'Actualizado manualmente por tu empresa', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Próxima convocatoria', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /seguimiento automático/i })).toHaveCount(0);
  await page.getByRole('link', { name: 'Registrar seguimiento manual', exact: true }).click();

  await expect(page).toHaveURL('/postulaciones/nueva?challenge=CH-D05');
  await expectSelectValue(page, 'Desafío de mercado', 'CH-D05');
  const challengeOptions = await openSelect(page, 'Desafío de mercado');
  await expect(challengeOptions.getByRole('option')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await page.getByLabel('Nota', { exact: true }).fill('Seguimiento consolidado por la empresa');
  await page.getByRole('button', { name: 'Guardar seguimiento manual', exact: true }).click();

  const application = page
    .locator('a.card')
    .filter({ has: page.getByRole('heading', { name: 'Optimización energética de molienda' }) });
  await expect(application).toContainText('Actualizado por tu empresa');
  await application.click();
  await expect(
    page.getByText(
      'Seguimiento manual actualizado por tu empresa. Sin sincronización externa.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar estado manual', exact: true }).click();
  await chooseSelect(page, 'Estado', 'en_revision');
  await chooseSelect(page, 'Etapa de negocio', 'pertinencia');
  await page
    .getByRole('textbox', { name: 'Nota de actualización', exact: true })
    .fill('Revisión registrada');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Estado e historial actualizados por tu empresa')).toBeVisible();
  await expect(page.locator('.pill')).toHaveText('En revisión');
  await expect(
    page.locator('.timeline').getByText('Revisión registrada', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('account completion fills progressively and awards a completed profile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/cuenta');
  const completion = page.getByRole('progressbar', {
    name: 'Progreso del perfil de organización',
    exact: true,
  });
  await expect(completion).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('.profile-completion-medal')).toHaveText('100% · Completo');

  await page.goto('/empresa');
  await page.getByRole('textbox', { name: 'Descripción', exact: true }).fill('');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Perfil guardado', { exact: true })).toBeVisible();
  await page.goto('/cuenta');

  await expect(completion).toHaveAttribute('aria-valuenow', '89');
  await expect(page.locator('.profile-completion-value')).toHaveText('89%');
  await expect(page.locator('.profile-completion-medal')).toHaveCount(0);
  const trackBox = await completion.boundingBox();
  const fillBox = await completion.locator('.profile-completion-fill').boundingBox();
  expect(fillBox!.width / trackBox!.width).toBeCloseTo(0.89, 2);
  await expect(
    page.getByText('11% restante para completar tu perfil', { exact: true }),
  ).toBeVisible();
});

test('account shows the generated portrait for every demo profile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);

  for (const [id, name, file] of [
    ['USR-01', 'Andrea Demo', 'andrea.jpg'],
    ['USR-02', 'Diego Demo', 'diego.jpg'],
    ['USR-03', 'Lucía Demo', 'lucia.jpg'],
    ['USR-04', 'Pablo Demo', 'pablo.jpg'],
  ]) {
    if (id !== 'USR-01') {
      await page.goto('/escenarios');
      await chooseSelect(page, 'Perfil y organización', id);
      await page.getByRole('button', { name: 'Cambiar perfil', exact: true }).click();
    }
    await page.goto('/cuenta');
    const portrait = page.getByRole('img', {
      name: `Retrato de perfil de ${name}`,
      exact: true,
    });
    await expect(portrait).toHaveAttribute('src', `/images/profiles/${file}`);
    await expect
      .poll(() =>
        portrait.evaluate(
          (image) =>
            (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth,
        ),
      )
      .toBeGreaterThan(0);
  }
});
test('account dark mode applies across routes and persists after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/cuenta');

  const toggle = page.getByRole('switch', { name: 'Modo oscuro', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.phone')).toHaveCSS('background-color', 'rgb(13, 27, 34)');
  await expect(page.locator('.topbar')).toHaveCSS('background-color', 'rgb(23, 42, 51)');
  await expect(page.locator('.profile-head h1')).toHaveCSS('color', 'rgb(244, 247, 248)');

  await page.goto('/empresa');
  await expect(page.getByRole('textbox', { name: 'Nombre de empresa', exact: true })).toHaveCSS(
    'background-color',
    'rgb(23, 42, 51)',
  );
  await page.goto('/desafios');
  await expect(page.locator('article.card').first()).toHaveCSS(
    'background-color',
    'rgb(23, 42, 51)',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.topbar')).toHaveCSS('background-color', 'rgb(23, 42, 51)');
  await page.goto('/cuenta');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
test('preference rule actions use distinct semantic colors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/preferencias');

  const edit = page.locator('.rule-edit-action').first();
  const pause = page.locator('.rule-pause-action').first();
  await expect(edit).toHaveCSS('background-color', 'rgb(5, 51, 73)');
  await expect(edit).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(pause).toHaveCSS('background-color', 'rgb(253, 197, 0)');
  await expect(pause).toHaveCSS('color', 'rgb(5, 51, 73)');

  await pause.click();
  await page.mouse.move(0, 0);
  const activate = page.getByRole('button', { name: 'Activar', exact: true });
  await expect(activate).toHaveCSS('background-color', 'rgb(33, 101, 71)');
  await expect(activate).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.getByText(/Pausada/).first()).toBeVisible();
});
test('long forms keep vertical scrolling on the page or modal only', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);

  for (const path of ['/intereses', '/empresa', '/soluciones/SOL-01']) {
    await page.goto(path);
    if (path === '/intereses') {
      await expect(
        page.getByRole('button', { name: 'Simular permiso de avisos push', exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('dialog', { name: 'Permiso push simulado', exact: true }),
      ).toHaveCount(0);
    }
    const viewport = page.locator('.viewport');
    const nestedScrollers = await viewport.evaluate((root) =>
      [...root.querySelectorAll('*')]
        .filter((element) => {
          const style = getComputedStyle(element);
          return (
            ['auto', 'scroll'].includes(style.overflowY) &&
            element.scrollHeight > element.clientHeight + 1
          );
        })
        .map((element) => element.className || element.tagName),
    );
    expect(nestedScrollers, path).toEqual([]);
    await viewport.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    expect(await viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  }

  await page.goto('/preferencias');
  await page.locator('.rule-edit-action').first().click();
  const modal = page.getByRole('dialog');
  const nestedModalScrollers = await modal.evaluate((root) =>
    [...root.querySelectorAll('.modal-content *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          ['auto', 'scroll'].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 1
        );
      })
      .map((element) => element.className || element.tagName),
  );
  expect(nestedModalScrollers).toEqual([]);
  const modalContent = modal.locator('.modal-content');
  expect(await modalContent.evaluate((element) => element.scrollHeight)).toBeGreaterThan(
    await modalContent.evaluate((element) => element.clientHeight),
  );
});
test('catalogue defaults to all states, preserves explicit filters and clears to all', async ({
  page,
}) => {
  await enter(page);
  await page.goto('/desafios');
  await expect(page.getByText('12 desafíos · Todos los estados')).toBeVisible();
  for (const id of ['CH-R01', 'CH-R02', 'CH-R03', 'CH-R04', 'CH-R05']) {
    await expect(page.locator(`a.card-title[href="/desafios/${id}"]`)).toBeVisible();
  }
  await expect(page.getByText('ABC Dust', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Aplicar (12)', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Abierto', exact: true }).check();
  await page.getByRole('button', { name: 'Aplicar (4)', exact: true }).click();
  await expect(page.getByText('4 desafíos · Abierto')).toBeVisible();
  await page.getByLabel('Buscar desafíos').fill('rastras');
  await expect(page.getByText('1 desafíos · Abierto')).toBeVisible();
  await page.getByRole('link', { name: 'Ver desafío', exact: true }).click();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page.getByLabel('Buscar desafíos')).toHaveValue('rastras');
  await expect(page.getByText('1 desafíos · Abierto')).toBeVisible();
  await page.getByRole('button', { name: /Filtros/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Abierto', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar (12)', exact: true }).click();
  await expect(page.getByText('12 desafíos · Todos los estados')).toBeVisible();
  await page.getByLabel('Buscar desafíos').fill('noexisteunresultado');
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(page.getByText('12 desafíos · Todos los estados')).toBeVisible();
  await page.goto('/inicio');
  await expect(page.locator('a[href="/desafios/CH-R01"]')).toHaveCount(0);
});

test('documentary challenges retain status, PDF sources and external exit confirmation', async ({
  page,
}) => {
  await enter(page);
  const sources = [
    ['CH-R01', '1Gc17d-oj_O7uYCzfJULxnnXaetwtmKJr', 'Estado por confirmar'],
    ['CH-R02', '16ywBwpRJu2g3gNIgB00W7twFzSGgaxYU', 'Estado por confirmar'],
    ['CH-R03', '1-0q0_C-LoN3Y-495CBgsQ4YunyW7EHL-', 'Estado por confirmar'],
    ['CH-R04', '1CGShCn82nqKW_d8XFr-QuwTC7HQPBoef', 'Convocatoria cerrada'],
    ['CH-R05', '1YUGWGr_bZpRv5p21BIxO-RyT0-GpCJSE', 'Convocatoria cerrada'],
  ];
  for (const [id, fileId, status] of sources) {
    await page.goto(`/desafios/${id}`);
    await expect(page.getByText(status, { exact: true })).toBeVisible();
    await expect(page.getByText('Antecedente documental · Vigencia no verificada')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Preparar antecedentes' })).toHaveCount(0);
    const source = page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Fuente y documentos' }) });
    await expect(source.getByText(/\.pdf$/)).toBeVisible();
    await source.getByRole('button', { name: /Consultar fuente/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Vas a salir de la demo')).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Abrir fuente externa/ })).toHaveAttribute(
      'href',
      `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`,
    );
    await page.keyboard.press('Escape');
  }
});

test('company country autocomplete searches names and codes and persists selected country', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const initialData = await (await page.request.get('/api/v1/bootstrap')).json();
  const locationStore = new Store('./.local/e2e.sqlite');
  try {
    const company = locationStore.get(initialData.context.sessionId, 'companies', 'EMP-D01')!;
    locationStore.batch(
      initialData.context.sessionId,
      [
        {
          collection: 'companies',
          id: company.id,
          expectedRevision: company._rev,
          value: { ...company, city: 'Providencia' },
        },
      ],
      'legacy-city-test',
    );
  } finally {
    locationStore.close();
  }
  await page.goto('/empresa');
  const country = page.getByRole('combobox', { name: 'País', exact: true });
  await expect(country).toHaveValue('Chile');
  const region = page.getByRole('combobox', { name: 'Región de origen', exact: true });
  await expectSelectValue(page, 'Región de origen', 'Metropolitana');
  const regionOptions = await openSelect(page, 'Región de origen');
  await expect(regionOptions.getByRole('option')).toHaveCount(17);
  await expect(regionOptions).toContainText('Ñuble');
  await page.keyboard.press('Escape');
  const city = page.getByRole('combobox', { name: 'Ciudad', exact: true });
  await expectSelectValue(page, 'Ciudad', 'Santiago');
  const cityOptions = await openSelect(page, 'Ciudad');
  for (const commune of [
    'Providencia',
    'Las Condes',
    'Ñuñoa',
    'Maipú',
    'Puente Alto',
    'Vitacura',
  ])
    await expect(cityOptions.getByRole('option', { name: commune, exact: true })).toBeVisible();
  await expect(
    cityOptions.getByRole('option', { name: 'Melipilla', exact: true }),
  ).toBeVisible();
  await expect(
    cityOptions.getByRole('option', { name: 'Talagante', exact: true }),
  ).toBeVisible();
  await expect(
    cityOptions.getByRole('option', { name: 'Valparaíso', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await chooseSelect(page, 'Región de origen', { label: 'Valparaíso' });
  await expectSelectValue(page, 'Ciudad', '');
  const valparaisoCities = await openSelect(page, 'Ciudad');
  await expect(
    valparaisoCities.getByRole('option', { name: 'Santiago', exact: true }),
  ).toHaveCount(0);
  await valparaisoCities.getByRole('option', { name: 'Viña del Mar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Perfil guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expectSelectValue(page, 'Región de origen', 'Valparaíso');
  await expectSelectValue(page, 'Ciudad', 'Viña del Mar');
  await country.fill('espana');
  await page.getByRole('option', { name: 'España ES', exact: true }).click();
  await expect(country).toHaveValue('España');
  await expect(region).toHaveCount(0);
  await expect(city).toHaveCount(0);
  await country.fill('noexisteunpais');
  await expect(page.getByRole('status')).toHaveText('No se encontraron países.');
  await country.press('Escape');
  await expect(country).toHaveValue('España');
  await country.fill('PE');
  await expect(page.getByRole('option', { name: 'Perú PE', exact: true })).toBeVisible();
  await country.fill('argentina');
  await country.press('ArrowDown');
  await country.press('Enter');
  await expect(country).toHaveValue('Argentina');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Perfil guardado', { exact: true })).toBeVisible();
  const data = await (await page.request.get('/api/v1/bootstrap')).json();
  expect(data.companies.find((c: any) => c.id === 'EMP-D01').country).toBe('AR');
  expect(data.companies.find((c: any) => c.id === 'EMP-D01').region).toBe('');
  expect(data.companies.find((c: any) => c.id === 'EMP-D01').city).toBe('');
  await page.reload();
  await expect(country).toHaveValue('Argentina');
  await expect(region).toHaveCount(0);
  await country.fill('chile');
  mkdirSync('.local/screenshots', { recursive: true });
  await page.screenshot({ path: '.local/screenshots/company-country-autocomplete.png' });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await country.press('Escape');
  await page.goto('/onboarding/empresa');
  await expect(page.getByRole('combobox', { name: 'País', exact: true })).toHaveValue('Argentina');
  await expect(region).toHaveCount(0);
  await country.fill('chile');
  await page.getByRole('option', { name: 'Chile CL', exact: true }).click();
  await expect(region).toBeVisible();
  await expectSelectValue(page, 'Región de origen', '');
  await expect(city).toHaveCount(0);
  await chooseSelect(page, 'Región de origen', { label: 'Ñuble' });
  await expect(city).toBeVisible();
  await chooseSelect(page, 'Ciudad', { label: 'Chillán' });
  await chooseSelect(page, 'Región de origen', { label: 'Atacama' });
  await expectSelectValue(page, 'Ciudad', '');
  const atacamaCities = await openSelect(page, 'Ciudad');
  await expect(
    atacamaCities.getByRole('option', { name: 'Chillán', exact: true }),
  ).toHaveCount(0);
  await atacamaCities.getByRole('option', { name: 'Copiapó', exact: true }).click();
  await chooseSelect(page, 'Región de origen', '');
  await expect(city).toHaveCount(0);
});

test('coverage regions support autocomplete, multiple selections, removal and persistence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.goto('/empresa');
  await expect(page.getByText(/Países de cobertura/)).toHaveCount(0);
  const initial = await (await page.request.get('/api/v1/bootstrap')).json();
  const countryCoverage = initial.companies.find((c: any) => c.id === 'EMP-D01').service_countries;
  const coverage = page.getByRole('combobox', { name: 'Regiones de cobertura', exact: true });
  const coverageList = page.getByRole('listbox', { name: 'Regiones de cobertura', exact: true });
  await expect(page.getByRole('button', { name: 'Quitar Coquimbo', exact: true })).toBeVisible();
  await coverage.fill('valparaiso');
  await coverageList.getByRole('option', { name: 'Valparaíso', exact: true }).click();
  await coverage.fill('nuble');
  await coverage.press('ArrowDown');
  await coverage.press('Enter');
  await expect(page.getByRole('button', { name: 'Quitar Ñuble', exact: true })).toBeVisible();
  await coverage.fill('antofagasta');
  await expect(
    coverageList.getByRole('option', { name: 'Antofagasta', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await coverage.press('Escape');
  await page.getByRole('button', { name: 'Quitar Coquimbo', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Perfil guardado', { exact: true })).toBeVisible();
  const saved = await (await page.request.get('/api/v1/bootstrap')).json();
  const company = saved.companies.find((c: any) => c.id === 'EMP-D01');
  expect(company.service_regions.sort()).toEqual(['Antofagasta', 'Valparaíso', 'Ñuble'].sort());
  expect(company.service_countries).toEqual(countryCoverage);
  expect(company.region).toBe('Metropolitana');
  await page.reload();
  for (const name of ['Antofagasta', 'Valparaíso', 'Ñuble']) {
    await expect(page.getByRole('button', { name: 'Quitar ' + name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Quitar Coquimbo', exact: true })).toHaveCount(0);
  await coverage.fill('valparaiso');
  await coverage.scrollIntoViewIfNeeded();
  mkdirSync('.local/screenshots', { recursive: true });
  await page.screenshot({ path: '.local/screenshots/coverage-region-multiselect.png' });
  await coverage.press('Escape');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  for (const name of ['Antofagasta', 'Valparaíso', 'Ñuble']) {
    await page.getByRole('button', { name: 'Quitar ' + name, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Perfil guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('group', { name: 'Regiones seleccionadas', exact: true }).getByRole('button'),
  ).toHaveCount(0);
  await page.goto('/onboarding/empresa');
  await expect(coverage).toBeVisible();
  await expect(page.getByText(/Países de cobertura/)).toHaveCount(0);
  await page.goto('/escenarios');
  await chooseSelect(page, 'Perfil y organización', 'USR-02');
  await page.getByRole('button', { name: 'Cambiar perfil', exact: true }).click();
  await page.goto('/empresa');
  await expect(coverage).toBeDisabled();
});

test('personal last name saves and reloads without modifying another user', async ({ page }) => {
  await enter(page);
  await page.goto('/perfil');
  await expect(page.getByLabel('Apellidos', { exact: true })).toHaveValue('');
  await page.getByLabel('Apellidos', { exact: true }).fill('González Pérez');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Perfil personal guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Apellidos', { exact: true })).toHaveValue('González Pérez');
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Andrea Demo');
  await page.goto('/equipo');
  await expect(
    page.getByRole('heading', { name: 'Andrea Demo González Pérez', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Rol de Andrea Demo González Pérez', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Diego Demo', exact: true })).toBeVisible();
  await page.goto('/escenarios');
  await chooseSelect(page, 'Perfil y organización', 'USR-02');
  await page.getByRole('button', { name: 'Cambiar perfil', exact: true }).click();
  await page.goto('/perfil');
  await expect(page.getByLabel('Apellidos', { exact: true })).toHaveValue('');
});

test('training format tabs filter content and preserve other filters and URL state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await enter(page);
  await page.goto('/formacion');
  const formats = page.getByRole('group', { name: 'Formato', exact: true });
  await expect(page.getByRole('combobox', { name: 'Formato', exact: true })).toHaveCount(0);
  await expect(formats.getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('article.card')).toHaveCount(12);
  await formats.getByRole('button', { name: 'Cápsula', exact: true }).click();
  await expect(page.locator('article.card')).toHaveCount(8);
  await expect(
    page.getByRole('link', { name: 'Preparar una propuesta técnica de piloto', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(formats.getByRole('button', { name: 'Cápsula', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await chooseSelect(page, 'Nivel', 'intermedio');
  await formats.getByRole('button', { name: 'Masterclass', exact: true }).click();
  await expectSelectValue(page, 'Nivel', 'intermedio');
  await expect(
    page.getByRole('link', { name: 'Diseñar evidencia para escalar en minería', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Buscar Formación').fill('propuesta técnica');
  await expect(page.locator('article.card')).toHaveCount(0);
  await formats.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(formats.getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await chooseSelect(page, 'Nivel', 'inicial');
  await expect(page.getByLabel('Buscar Formación')).toHaveValue('propuesta técnica');
  await expect(page.locator('article.card')).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

for (const width of [360, 390, 430])
  test(`training library ${width}: images, format counts and mobile layout`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await enter(page);
    await page.goto('/formacion');
    await expect(page.locator('article.card')).toHaveCount(12);
    await expect(page.locator('article.card .provenance')).toHaveCount(0);
    const thumbnails = page.locator('article.card .learning-thumbnail img');
    await expect(thumbnails).toHaveCount(12);
    for (const thumbnail of await thumbnails.all()) {
      await thumbnail.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          thumbnail.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        )
        .toBeTruthy();
      await expect(thumbnail).toHaveAttribute('alt', /.+/);
    }
    await page.locator('article.card').first().scrollIntoViewIfNeeded();
    mkdirSync('.local/screenshots', { recursive: true });
    await page
      .locator('article.card')
      .first()
      .screenshot({ path: `.local/screenshots/formacion-card-${width}.png` });
    await page.screenshot({ path: `.local/screenshots/formacion-${width}.png` });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    const formats = page.getByRole('group', { name: 'Formato', exact: true });
    const colors = [];
    for (const [name, count] of [
      ['Cápsula', 8],
      ['Masterclass', 3],
      ['Resumen audiovisual', 1],
    ] as const) {
      await formats.getByRole('button', { name, exact: true }).click();
      await expect(page.locator('article.card')).toHaveCount(count);
      colors.push(
        await page
          .locator('article.card .pill')
          .first()
          .evaluate((pill) => getComputedStyle(pill).backgroundColor),
      );
    }
    expect(new Set(colors).size).toBe(3);
  });

test('enriched learning details hide source sections and retain simulated progress and documentary recap', async ({
  page,
}) => {
  await enter(page);
  const data = await (await page.request.get('/api/v1/bootstrap')).json();
  for (const lesson of trainingManifest.lessons) {
    const record = data.learning.find((r: any) => r.id === lesson.id);
    await page.goto('/formacion/' + lesson.id);
    if (record.media_url?.startsWith('/videos/')) {
      await expect(page.locator('.learning-detail-cover video')).toHaveAttribute(
        'poster',
        record.thumbnail_url,
      );
      await expect(page.locator('video source')).toHaveAttribute('src', record.media_url);
    } else {
      await expect(page.locator('.learning-detail-cover img')).toHaveAttribute(
        'src',
        record.thumbnail_url,
      );
    }
    await expect(page.getByRole('heading', { name: record.title, exact: true })).toBeVisible();
    await expect(page.locator('.provenance')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Fuente y documentos', exact: true }),
    ).toHaveCount(0);
    if (record.demo) {
      await expect(page.getByText('Equipo editorial de la demo', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Reproducción', exact: true })).toBeVisible();
      for (const chapter of record.chapters)
        await expect(page.getByText(chapter, { exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Avanzar lección', exact: true })).toHaveCount(
        0,
      );
      await expect(page.locator('video')).toBeVisible();
      await expect(page.getByRole('button', { name: /Abrir video de referencia/ })).toHaveCount(0);
    }
  }
});

test('supplied recap video plays, seeks and serves byte ranges', async ({ page }) => {
  await enter(page);
  await page.goto('/formacion/LEARN-R01');
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('controls', '');
  await expect(video).toHaveAttribute('playsinline', '');
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15000 })
    .toBeGreaterThanOrEqual(1);
  const metadata = await video.evaluate((v: HTMLVideoElement) => ({
    duration: v.duration,
    width: v.videoWidth,
    error: v.error?.message,
  }));
  expect(metadata.duration).toBeCloseTo(47.76, 1);
  expect(metadata.width).toBeGreaterThan(0);
  expect(metadata.error).toBeUndefined();
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.1);
  await video.evaluate((v: HTMLVideoElement) => {
    v.pause();
    v.currentTime = 10;
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking), { timeout: 15000 })
    .toBeFalsy();
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(10, 0);
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    mkdirSync('.local/screenshots', { recursive: true });
    await page.screenshot({ path: `.local/screenshots/recap-video-${width}.png` });
  }
  const range = await page.request.get('/videos/expande-masterclass-resumen-jornada.mp4', {
    headers: { Range: 'bytes=0-1023' },
  });
  expect(range.status()).toBe(206);
  expect(range.headers()['content-type']).toContain('video/mp4');
  expect(range.headers()['content-range']).toBe('bytes 0-1023/74235676');
  expect((await range.body()).length).toBe(1024);
});

test('training thumbnail failure preserves a neutral accessible placeholder', async ({ page }) => {
  await enter(page);
  await page.route('**/images/formacion/learn-d01.jpg', (route) => route.abort());
  await page.goto('/formacion?format=capsula&q=Preparar%20una%20propuesta');
  await expect(page.locator('article.card')).toHaveCount(1);
  const fallback = page.locator('.learning-thumbnail-fallback');
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute('aria-label', /Equipo de prueba/);
  const box = await fallback.boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(16 / 9, 1);
});

test('all mapped routes render without React errors', async ({ page }) => {
  await enter(page);
  const paths = [
    '/registro',
    '/onboarding/empresa',
    '/onboarding/intereses',
    '/empresa',
    '/perfil',
    '/soluciones',
    '/soluciones/SOL-01',
    '/soluciones/nueva',
    '/equipo',
    '/intereses',
    '/preferencias',
    '/delegaciones',
    '/guardados',
    '/plan',
    '/escenarios',
    '/avisos',
    '/fuentes',
    '/desafios/CH-D01',
    '/desafios/CH-D01/preparar',
    '/desafios/CH-D01/preguntas',
    '/desafios/CH-R04',
    '/portal/CH-D01',
    '/postulaciones/nueva',
    '/postulaciones/APP-01',
    '/postulaciones/APP-02/documentos',
    '/alianzas',
    '/alianzas/ALL-D01',
    '/financiamiento',
    '/financiamiento/FUND-D01',
    '/calendario',
    '/calendario/EV-D01',
    '/calendario/EV-R01',
    '/innovacion',
    '/innovacion/cases/CASE-02',
    '/innovacion/news/NEWS-01',
    '/innovacion/trends/TREND-01',
    '/formacion',
    '/formacion/LEARN-D01',
    '/conceptos/socios',
    '/conceptos/senales',
  ];
  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator('.viewport')).toBeVisible();
    await expect(page.locator('.viewport')).not.toBeEmpty();
    await expect(page.getByText('No se pudo conectar', { exact: true })).toHaveCount(0);
  }
});
test('draft, question, documents, notifications and persisted saved items', async ({ page }) => {
  await enter(page);
  await page.goto('/desafios/CH-D03');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Quitar de guardados' })).toBeVisible();
  await page.getByRole('link', { name: 'Preparar antecedentes', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(
    page.getByText('Borrador local. No se envió al mandante.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Visitar portal de demostración' }).click();
  await expect(
    page.getByText('Salida simulada. No se ha enviado ninguna postulación.'),
  ).toBeVisible();
  await page.goto('/desafios/CH-D01/preguntas');
  await page.getByLabel('Tu pregunta').fill('¿Se puede instalar un sensor de prueba?');
  await page.getByRole('button', { name: 'Guardar pregunta local' }).click();
  await expect(
    page.getByRole('heading', { name: '¿Se puede instalar un sensor de prueba?' }),
  ).toBeVisible();
  await page.goto('/postulaciones/APP-02/documentos');
  await page.getByRole('button', { name: 'Simular adjuntar documento' }).click();
  await expect(page.getByText(/Adjunto local/).first()).toBeVisible();
  await page.goto('/avisos');
  await page.getByRole('button', { name: 'Marcar todos como leídos' }).click();
  await expect(page.getByLabel('Avisos: 0 sin leer')).toBeVisible();
});
test('company edit, rules, invitations, delegation and role permissions', async ({ page }) => {
  await enter(page);
  await page.goto('/empresa');
  await chooseSelect(page, 'Región de origen', 'Atacama');
  await chooseSelect(page, 'Ciudad', 'Copiapó');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Perfil guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expectSelectValue(page, 'Ciudad', 'Copiapó');
  await page.goto('/equipo');
  const selfCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Andrea Demo', exact: true }) });
  await expect(
    selfCard.getByRole('button', { name: 'Retirar integrante', exact: true }),
  ).toHaveCount(0);
  const otherRole = page.getByRole('combobox', { name: 'Rol de Diego Demo', exact: true });
  const selfRole = selfCard.getByRole('combobox', { name: 'Rol de Andrea Demo', exact: true });
  await expect(selfRole).toBeDisabled();
  await expectSelectValue(page, 'Rol de Andrea Demo', 'administrador');
  await chooseSelect(page, 'Rol de Diego Demo', 'administrador');
  await expectSelectValue(page, 'Rol de Diego Demo', 'administrador');
  await expect(selfRole).toBeDisabled();
  await expectSelectValue(page, 'Rol de Andrea Demo', 'administrador');
  await expect(
    selfCard.getByRole('button', { name: 'Retirar integrante', exact: true }),
  ).toHaveCount(0);
  const otherCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Diego Demo', exact: true }) });
  await expect(
    otherCard.getByRole('button', { name: 'Retirar integrante', exact: true }),
  ).toBeVisible();
  await chooseSelect(page, 'Rol de Diego Demo', 'colaborador');
  await expectSelectValue(page, 'Rol de Diego Demo', 'colaborador');
  await page.getByRole('button', { name: 'Invitar Integrante' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Invitada Demo');
  await page.getByLabel('Correo', { exact: true }).fill('invitada@example.com');
  await page.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(page.getByRole('heading', { name: 'Invitada Demo' })).toBeVisible();
  await page.goto('/delegaciones');
  await page.getByRole('button', { name: 'Nueva delegación' }).click();
  await page.getByLabel('Correo destinatario ficticio').fill('relevo@example.com');
  await page.getByLabel('Fecha inicial').fill('2026-11-10');
  await page.getByLabel('Fecha final').fill('2026-11-20');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'relevo@example.com' })).toBeVisible();
  await page.goto('/escenarios');
  await chooseSelect(page, 'Perfil y organización', 'USR-02');
  await page.getByRole('button', { name: 'Cambiar perfil', exact: true }).click();
  await page.goto('/equipo');
  await expect(page.getByRole('button', { name: 'Invitar Integrante' })).toHaveCount(0);
  await page.goto('/plan');
  await expect(page.getByText(/Contacta al administrador/)).toBeVisible();
});
test('calendar precision, funding currency, concepts and training progress', async ({ page }) => {
  await enter(page);
  await page.goto('/calendario/EV-R01');
  await expect(page.getByRole('button', { name: 'Recordarme', exact: true })).toBeDisabled();
  await page.goto('/calendario?month=2027-02');
  await expect(page.getByText('Sin eventos registrados para los filtros elegidos')).toBeVisible();
  await page.goto('/financiamiento?currency=CLP&order=monto');
  await expect(page.getByRole('link', { name: 'Innova Región', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Piloto de agua Demo', exact: true })).toHaveCount(0);
  await page.goto('/conceptos/socios');
  await page.getByRole('button', { name: 'Me interesa esta idea' }).click();
  await expect(page.getByRole('button', { name: 'Interés registrado' })).toBeVisible();
  await page.goto('/formacion/LEARN-D01');
  await page.getByRole('button', { name: 'Avanzar lección', exact: true }).click();
  await expect(page.getByText('60% completado')).toBeVisible();
  await page.reload();
  await expect(page.getByText('60% completado')).toBeVisible();
});
test('agent edits refresh live UI while dirty forms retain data and reject stale saves', async ({
  page,
}) => {
  await enter(page);
  const s = new Store('./.local/e2e.sqlite');
  let batch: string | undefined;
  try {
    await page.goto('/desafios/CH-D01');
    const r = s.get('catalog', 'challenges', 'CH-D01')!;
    batch = s.batch(
      'catalog',
      [
        {
          collection: 'challenges',
          id: r.id,
          expectedRevision: r._rev,
          value: { ...r, title: 'Título actualizado por agente' },
        },
      ],
      'browser-agent-test',
    ).batchId;
    await expect(
      page.getByRole('heading', { name: 'Título actualizado por agente', exact: true }),
    ).toBeVisible({ timeout: 8000 });
    await page.goto('/empresa');
    await chooseSelect(page, 'Ciudad', 'Buin');
    const data = await (await page.request.get('/api/v1/bootstrap')).json();
    const company = s.get(data.context.sessionId, 'companies', 'EMP-D01')!;
    s.batch(
      data.context.sessionId,
      [
        {
          collection: 'companies',
          id: company.id,
          expectedRevision: company._rev,
          value: { ...company, city: 'Colina' },
        },
      ],
      'browser-agent-test',
    );
    await page.waitForTimeout(3600);
    await expectSelectValue(page, 'Ciudad', 'Buin');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(page.locator('.error')).toContainText('El registro cambió');
    await page.reload();
    await expectSelectValue(page, 'Ciudad', 'Colina');
  } finally {
    if (batch) s.restoreBatch(batch, 'browser-test-cleanup');
    s.close();
  }
});
test('editable draft snapshot, notification rules, simulated requests and reset', async ({
  page,
}) => {
  await enter(page);
  await page.goto('/desafios/CH-D03/preparar');
  await page.getByLabel('Empresa en esta preparación (copia)').fill('Nombre para esta propuesta');
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page.getByText('Nombre para esta propuesta', { exact: true })).toBeVisible();
  const draftUrl = page.url();
  await page.getByRole('link', { name: 'Editar borrador', exact: true }).click();
  await page.getByLabel('Resumen de propuesta').fill('Propuesta revisada y persistente.');
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page).toHaveURL(draftUrl);
  await expect(page.getByText('Propuesta revisada y persistente.')).toBeVisible();
  await page.goto('/preferencias');
  await page.getByRole('button', { name: 'Agregar regla', exact: true }).click();
  const preferenceDialog = page.getByRole('dialog');
  await preferenceDialog.getByRole('combobox', { name: 'Frecuencia', exact: true }).click();
  await preferenceDialog
    .getByRole('listbox', { name: 'Frecuencia', exact: true })
    .locator('[role="option"][data-value="semanal"]')
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Guardar cambios', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Semanal/).first()).toBeVisible();
  await page.goto('/alianzas/ALL-D01');
  await page.getByRole('button', { name: 'Solicitar acceso', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar solicitud demo' }).click();
  await expect(page.getByRole('button', { name: 'Solicitud demo registrada' })).toBeVisible();
  await page.goto('/calendario/EV-D01');
  await page.getByRole('button', { name: 'Recordarme', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recordatorio guardado' })).toBeVisible();
  await page.getByRole('button', { name: 'Inscripción demo', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar inscripción demo' }).click();
  await expect(page.getByRole('button', { name: 'Inscripción demo registrada' })).toBeVisible();
  await page.goto('/escenarios');
  await page.getByRole('button', { name: 'Reiniciar mi demostración' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Hola, Andrea')).toBeVisible();
  await page.goto('/empresa');
  await expect(page.getByLabel('Nombre de empresa', { exact: true })).toHaveValue(
    'SensorAndes Demo',
  );
});
