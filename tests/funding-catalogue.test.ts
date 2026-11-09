import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Store } from '../server/store.ts';
import { action } from '../server/actions.ts';
import { buildFundingChanges } from '../server/funding-catalogue.ts';
import { discoverableFunding, effectiveFundingState } from '../shared/funding.ts';

test('funding library archives original IDs and preserves saved references, facts and source metadata', () => {
  const store = new Store(':memory:');
  try {
    const session = store.createSession();
    if (!store.rows(session, 'saved_items').some((item) => item.target_id === 'FUND-D01'))
      action(store, session, { type: 'saved', target_type: 'funding', target_id: 'FUND-D01' });
    const saved = store.rows(session, 'saved_items');
    const original = store.rows('catalog', 'funding_calls');
    const changes = buildFundingChanges((collection, id) => store.get('catalog', collection, id));
    assert.equal(store.batch('catalog', changes, 'funding-preview', true).preview, true);
    assert.deepEqual(store.rows('catalog', 'funding_calls'), original);
    store.batch('catalog', changes, 'funding-library-test');
    for (const before of original) {
      const after = store.get('catalog', 'funding_calls', before.id)!;
      assert.equal(after.catalog_hidden, true);
      for (const key of Object.keys(before))
        if (key !== '_rev') assert.deepEqual(after[key], before[key], `${before.id}.${key}`);
    }
    assert.equal(store.rows('catalog', 'funding_calls').length, 25);
    const visible = discoverableFunding(store.rows('catalog', 'funding_calls'));
    assert.equal(visible.length, 12);
    for (const row of visible) {
      assert.equal(row.record_type, 'programa');
      assert.equal(row.demo, false);
      assert.equal(row.body_sections.length, 4);
      assert(row.summary.length > 50);
      assert(row.thumbnail_alt.length > 20);
      assert(existsSync(new URL('../public' + row.thumbnail_url, import.meta.url)));
      assert.match(row.official_url, /^https:\/\//);
      assert(row.reference_source_ids.length > 0);
      for (const id of row.reference_source_ids) assert(store.get('catalog', 'sources', id));
      if (row.id !== 'FUND-R20') {
        assert.equal(row.state, 'por_confirmar');
        assert.equal(row.closing_date, null);
        assert.equal(row.closing_at, null);
        assert.equal(row.provenance.verified_current, false);
      }
    }
    assert.deepEqual(store.rows(session, 'saved_items'), saved);
    assert(
      store.get(
        'catalog',
        'funding_calls',
        saved.find((item) => item.target_id === 'FUND-D01')!.target_id,
      ),
    );
    const row = store.get('catalog', 'funding_calls', 'FUND-R20')!;
    for (const value of [
      { ...row, reference_source_ids: ['MISSING'] },
      { ...row, closing_at: '2026-11-24T13:00:00' },
      { ...row, catalog_hidden: 'yes' },
    ])
      assert.throws(() =>
        store.batch('catalog', [
          { collection: 'funding_calls', id: row.id, expectedRevision: row._rev, value },
        ]),
      );
    assert.deepEqual(store.get('catalog', 'funding_calls', row.id), row);
  } finally {
    store.close();
  }
});

test('verified funding expiry uses the real Chilean deadline independently of the visitor clock', (t) => {
  const store = new Store(':memory:');
  try {
    store.batch(
      'catalog',
      buildFundingChanges((collection, id) => store.get('catalog', collection, id)),
      'funding-clock-test',
    );
    const session = store.createSession();
    const row = store.get('catalog', 'funding_calls', 'FUND-R20')!;
    const deadline = Date.parse('2026-11-24T16:00:00Z');
    assert.equal(Date.parse(row.closing_at), deadline);
    assert.equal(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Santiago',
        hour: '2-digit',
        minute: '2-digit',
      }).format(deadline),
      '13:00',
    );
    for (const demoDay of ['2000-01-01', '2099-12-31']) {
      assert.equal(effectiveFundingState(row, demoDay, deadline - 1), 'abierto');
      assert.equal(effectiveFundingState(row, demoDay, deadline), 'cerrado');
    }
    const legacy = store.get('catalog', 'funding_calls', 'FUND-D01')!;
    assert.equal(effectiveFundingState(legacy, '2099-12-31', 0), 'cerrado');
    assert.equal(effectiveFundingState(legacy, '2000-01-01', deadline), 'abierto');
    const clock = t.mock.method(Date, 'now', () => deadline - 1);
    assert.equal(
      store.data(session).funding_calls.find((r: any) => r.id === row.id).state,
      'abierto',
    );
    clock.mock.mockImplementation(() => deadline);
    assert.equal(
      store.data(session).funding_calls.find((r: any) => r.id === row.id).state,
      'cerrado',
    );
    assert.deepEqual(store.get('catalog', 'funding_calls', row.id), row);
    assert.equal(effectiveFundingState({ ...row, state: 'cerrado' }, '2000-01-01', 0), 'cerrado');
  } finally {
    store.close();
  }
});
