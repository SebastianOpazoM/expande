import manifest from '../content/innovacion-library.json' with { type: 'json' };
import type { Row } from '../shared/model.ts';
import type { Change } from './store.ts';

export { manifest as innovationManifest };

export function buildInnovationChanges(
  read: (collection: string, id: string) => Row | null | undefined,
): Change[] {
  const changes: Change[] = manifest.sources.map((source) => {
    const previous = read('sources', source.id);
    const { _rev, ...original } = previous || { id: source.id, _rev: 0 };
    return {
      collection: 'sources',
      id: source.id,
      expectedRevision: _rev || 0,
      value: { ...original, ...source },
    };
  });
  for (const article of manifest.articles as Row[]) {
    const { collection, preserveExisting, ...fields } = article;
    const previous = read(collection, article.id);
    if (preserveExisting && !previous) throw new Error(`Missing original record ${article.id}`);
    const { _rev, ...original } = previous || { id: article.id, _rev: 0 };
    const value: Row = {
      ...original,
      ...fields,
      thumbnail_url: `/images/innovacion/${article.id.toLowerCase()}.jpg`,
      reference_source_ids: [
        ...new Set([...(original.reference_source_ids || []), ...fields.reference_source_ids]),
      ],
    };
    if (!preserveExisting) {
      value.demo = true;
      value.provenance = {
        kind: 'sintetico_con_referencias',
        source_id: collection === 'cases' ? 'SRC-INNOV-CNP' : null,
        locator:
          collection === 'cases'
            ? 'Escenario editorial de diseño de piloto; no describe una implementación real.'
            : null,
        derived_fields: Object.keys(fields).filter((key) => key !== 'id'),
        verified_current: false,
      };
    }
    changes.push({ collection, id: article.id, expectedRevision: _rev || 0, value });
  }
  return changes;
}
