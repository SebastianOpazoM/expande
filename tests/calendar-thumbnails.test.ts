import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Store } from '../server/store.ts';
import { action } from '../server/actions.ts';
import { buildCalendarThumbnailChanges } from '../server/calendar-thumbnails.ts';

test('calendar thumbnails preserve all event facts, date precision, provenance and visitor saved items', () => {
  const store = new Store(':memory:');
  try {
    const session = store.createSession();
    action(store, session, { type: 'saved', target_type: 'event', target_id: 'EV-R01' });
    const saved = store.rows(session, 'saved_items');
    const original = store.rows('catalog', 'events');
    const changes = buildCalendarThumbnailChanges((collection, id) =>
      store.get('catalog', collection, id),
    );
    assert.equal(changes.length, original.length);
    assert.equal(store.batch('catalog', changes, 'calendar-preview', true).preview, true);
    assert.deepEqual(store.rows('catalog', 'events'), original);
    store.batch('catalog', changes, 'calendar-thumbnails-test');
    for (const before of original) {
      const after = store.get('catalog', 'events', before.id)!;
      for (const key of Object.keys(before))
        if (key !== '_rev') assert.deepEqual(after[key], before[key], `${before.id}.${key}`);
      assert(after.thumbnail_alt.length > 30);
      assert.match(after.thumbnail_url, /^\/images\/calendario\/[a-z]+\.jpg$/);
      assert(existsSync(new URL('../public' + after.thumbnail_url, import.meta.url)));
    }
    assert.deepEqual(store.rows(session, 'saved_items'), saved);
    const row = store.get('catalog', 'events', 'EV-R01')!;
    assert.throws(() =>
      store.batch('catalog', [
        {
          collection: 'events',
          id: row.id,
          expectedRevision: row._rev,
          value: { ...row, thumbnail_url: 42 },
        },
      ]),
    );
    assert.deepEqual(store.get('catalog', 'events', row.id), row);
  } finally {
    store.close();
  }
});
