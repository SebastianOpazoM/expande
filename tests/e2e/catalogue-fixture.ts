import { Store } from '../../server/store.ts';
import { buildFundingChanges } from '../../server/funding-catalogue.ts';
import { buildFormacionChanges } from '../../server/training-catalogue.ts';
import { buildInnovationChanges } from '../../server/innovation-catalogue.ts';
import { buildCalendarThumbnailChanges } from '../../server/calendar-thumbnails.ts';

export function setupCatalogue() {
  const store = new Store('./.local/e2e.sqlite');
  try {
    for (const build of [
      buildFormacionChanges,
      buildInnovationChanges,
      buildCalendarThumbnailChanges,
      buildFundingChanges,
    ])
      store.batch(
        'catalog',
        build((collection, id) => store.get('catalog', collection, id)),
        'browser-catalogue-fixture',
      );
  } finally {
    store.close();
  }
}
