import manifest from '../content/formacion-library.json' with { type: 'json' };
import type { Row } from '../shared/model.ts';
import type { Change } from './store.ts';

export { manifest as trainingManifest };

export function buildFormacionChanges(
  read: (collection: string, id: string) => Row | null | undefined,
): Change[] {
  const changes: Change[] = manifest.sources.map((source) => ({
    collection: 'sources',
    id: source.id,
    expectedRevision: read('sources', source.id)?._rev || 0,
    value: source,
  }));
  for (const lesson of manifest.lessons as Row[]) {
    const previous = read('learning', lesson.id);
    const { _rev, ...original } = previous || { id: lesson.id, _rev: 0 };
    const { preserveExisting, minutes, source_id, ...fields } = lesson;
    if (preserveExisting && !previous) throw new Error(`Missing original record ${lesson.id}`);
    const value: Row = preserveExisting
      ? { ...original, ...fields }
      : {
          ...original,
          ...fields,
          duration_seconds: minutes * 60,
          duration_status: 'demo',
          author: 'Equipo editorial de la demo',
          media_url: null,
          access: 'incluido',
          demo: true,
          provenance: {
            kind: 'sintetico_con_referencias',
            source_id,
            locator:
              'Lección editorial ilustrativa con referencias públicas; no es un curso impartido ni avalado por la institución citada.',
            derived_fields: [
              'title',
              'description',
              'chapters',
              'duration_seconds',
              'level',
              'thumbnail_url',
              'thumbnail_alt',
            ],
            verified_current: false,
          },
        };
    changes.push({ collection: 'learning', id: lesson.id, expectedRevision: _rev || 0, value });
  }
  return changes;
}
