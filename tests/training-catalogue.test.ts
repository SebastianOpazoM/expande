import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.ts';
import { action } from '../server/actions.ts';
import { buildFormacionChanges } from '../server/training-catalogue.ts';

test('training enrichment preserves existing recap, saved records and progress; validates source references', () => {
  const s = new Store(':memory:');
  try {
    const session = s.createSession();
    action(s, session, { type: 'progress', learning_id: 'LEARN-D01', progress: 60 });
    action(s, session, { type: 'saved', target_type: 'learning', target_id: 'LEARN-D02' });
    const beforeProgress = s.rows(session, 'learning_progress');
    const beforeSaved = s.rows(session, 'saved_items');
    const originalRecap = s.get('catalog', 'learning', 'LEARN-R01')!;
    const changes = buildFormacionChanges((collection, id) => s.get('catalog', collection, id));
    assert.equal(s.batch('catalog', changes, 'test-preview', true).preview, true);
    assert.equal(s.rows('catalog', 'learning').length, 3);
    s.batch('catalog', changes, 'test-apply');
    const lessons = s.rows('catalog', 'learning');
    assert.equal(lessons.length, 12);
    assert.equal(lessons.filter((r) => r.format === 'capsula').length, 8);
    assert.equal(lessons.filter((r) => r.format === 'masterclass').length, 3);
    assert.equal(lessons.filter((r) => r.format === 'resumen_audiovisual').length, 1);
    const recap = s.get('catalog', 'learning', 'LEARN-R01')!;
    for (const key of ['duration_seconds', 'provenance', 'author', 'title'])
      assert.deepEqual(recap[key], originalRecap[key]);
    assert.equal(recap.media_url, '/videos/expande-masterclass-resumen-jornada.mp4');
    assert.equal(recap.duration_status, 'medida_archivo_local');
    assert.deepEqual(s.rows(session, 'learning_progress'), beforeProgress);
    assert.deepEqual(s.rows(session, 'saved_items'), beforeSaved);
    for (const lesson of lessons) {
      assert.match(lesson.thumbnail_url, /^\/images\/formacion\/learn-[dr]\d+\.jpg$/);
      assert(lesson.thumbnail_alt.length > 20);
      assert(s.get('catalog', 'sources', lesson.provenance.source_id));
      if (lesson.demo) {
        assert.equal(lesson.chapters.length, 3);
        assert.equal(lesson.media_url, null);
        assert.equal(lesson.author, 'Equipo editorial de la demo');
      }
    }
    const course = s.get('catalog', 'learning', 'LEARN-D11')!;
    assert.throws(() =>
      s.batch('catalog', [
        {
          collection: 'learning',
          id: course.id,
          expectedRevision: course._rev,
          value: { ...course, reference_source_ids: ['MISSING-SOURCE'] },
        },
      ]),
    );
    assert.deepEqual(s.get('catalog', 'learning', course.id), course);
  } finally {
    s.close();
  }
});
