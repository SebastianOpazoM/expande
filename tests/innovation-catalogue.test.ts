import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Store } from '../server/store.ts';
import { action } from '../server/actions.ts';
import { buildInnovationChanges } from '../server/innovation-catalogue.ts';

test('innovation enrichment preserves documentary facts and saved IDs; validates articles and references', () => {
  const store = new Store(':memory:');
  try {
    const session = store.createSession();
    action(store, session, { type: 'saved', target_type: 'case', target_id: 'CASE-02' });
    const saved = store.rows(session, 'saved_items');
    const originals = ['cases', 'news', 'trends'].flatMap((collection) =>
      store.rows('catalog', collection).map((row) => ({ collection, row })),
    );
    const changes = buildInnovationChanges((collection, id) =>
      store.get('catalog', collection, id),
    );
    assert.equal(store.batch('catalog', changes, 'innovation-preview', true).preview, true);
    assert.equal(store.rows('catalog', 'cases').length, 3);
    store.batch('catalog', changes, 'innovation-test');
    const editable = new Set([
      '_rev',
      'title',
      'thumbnail_url',
      'thumbnail_alt',
      'body_sections',
      'reference_source_ids',
    ]);
    for (const { collection, row } of originals) {
      const updated = store.get('catalog', collection, row.id)!;
      for (const key of Object.keys(row)) {
        if (
          !editable.has(key) &&
          !(collection === 'trends' && ['summary', 'implication'].includes(key))
        )
          assert.deepEqual(updated[key], row[key], `${row.id}.${key}`);
      }
    }
    for (const collection of ['cases', 'news', 'trends']) {
      const rows = store.rows('catalog', collection);
      assert.equal(rows.length, 5);
      for (const row of rows) {
        assert.equal(row.body_sections.length, 3);
        assert(row.body_sections.every((section: any) => section.body.length > 180));
        assert(row.thumbnail_alt.length > 30);
        assert(existsSync(new URL('../public' + row.thumbnail_url, import.meta.url)));
        assert(!JSON.stringify(row.body_sections).includes('Ejemplo ficticio'));
        for (const id of row.reference_source_ids) assert(store.get('catalog', 'sources', id));
      }
    }
    assert.match(store.get('catalog', 'cases', 'CASE-02')!.results, /preliminares/);
    for (const id of ['CASE-04', 'CASE-05']) {
      const row = store.get('catalog', 'cases', id)!;
      assert.equal(row.demo, true);
      assert.equal(row.provenance.verified_current, false);
      assert.match(row.results_status, /sin resultados medidos/);
      assert.equal(row.published_on, '');
    }
    assert.deepEqual(store.rows(session, 'saved_items'), saved);
    const row = store.get('catalog', 'trends', 'TREND-04')!;
    for (const value of [
      { ...row, reference_source_ids: ['MISSING'] },
      { ...row, body_sections: [{ heading: 'Incomplete' }] },
    ])
      assert.throws(() =>
        store.batch('catalog', [
          { collection: 'trends', id: row.id, expectedRevision: row._rev, value },
        ]),
      );
    assert.deepEqual(store.get('catalog', 'trends', row.id), row);
  } finally {
    store.close();
  }
});
