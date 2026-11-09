import manifest from '../content/financiamiento-library.json' with { type: 'json' };
import type { Row } from '../shared/model.ts';
import type { Change } from './store.ts';

export { manifest as fundingManifest };

export function buildFundingChanges(
  read: (collection: string, id: string) => Row | null | undefined,
): Change[] {
  const changes: Change[] = [];
  for (const programme of manifest.programmes as Row[]) {
    const { source_url, additional_sources = [], ...fields } = programme;
    const sourceId = `SRC-${programme.id}`;
    const sources = [
      { id: sourceId, title: `${programme.entity} — ${programme.title}`, url: source_url },
      ...additional_sources,
    ];
    for (const source of sources) {
      const previous = read('sources', source.id);
      const { _rev, ...original } = previous || { id: source.id, _rev: 0 };
      changes.push({
        collection: 'sources',
        id: source.id,
        expectedRevision: _rev || 0,
        value: {
          ...original,
          ...source,
          type: 'referencia_oficial',
          accessed_on: manifest.reviewed_on,
        },
      });
    }
    const previous = read('funding_calls', programme.id);
    const { _rev, ...original } = previous || { id: programme.id, _rev: 0 };
    changes.push({
      collection: 'funding_calls',
      id: programme.id,
      expectedRevision: _rev || 0,
      value: {
        ...original,
        edition: 'Ficha del programa',
        record_type: 'programa',
        group_key: programme.id,
        opening_date: null,
        closing_date: null,
        closing_at: null,
        milestone_date: null,
        source_opening_text: null,
        country: 'CL',
        state: 'por_confirmar',
        ...fields,
        official_url: source_url,
        catalog_hidden: false,
        reviewed_on: manifest.reviewed_on,
        thumbnail_url: `/images/financiamiento/${programme.id.toLowerCase()}.jpg`,
        reference_source_ids: sources.map((source: Row) => source.id),
        demo: false,
        normalization_status: 'programa_investigado',
        provenance: {
          kind: 'documentado_con_contexto_editorial',
          source_id: sourceId,
          locator:
            'Ficha oficial del programa y contexto editorial para proveedores; las ediciones anteriores se distinguen de la disponibilidad actual.',
          derived_fields: [
            'summary',
            'body_sections',
            'thumbnail_url',
            'thumbnail_alt',
            'eligible_segments',
          ],
          verified_current: programme.state === 'abierto',
        },
      },
    });
  }
  for (const id of manifest.archive_ids) {
    const previous = read('funding_calls', id);
    if (!previous) throw new Error(`Missing original funding record ${id}`);
    const { _rev, ...original } = previous;
    changes.push({
      collection: 'funding_calls',
      id,
      expectedRevision: _rev,
      value: { ...original, catalog_hidden: true },
    });
  }
  return changes;
}
