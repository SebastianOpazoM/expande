import manifest from '../content/calendario-thumbnails.json' with { type: 'json' };
import type { Row } from '../shared/model.ts';
import type { Change } from './store.ts';

export { manifest as calendarThumbnailManifest };

export function buildCalendarThumbnailChanges(
  read: (collection: string, id: string) => Row | null | undefined,
): Change[] {
  return Object.entries(manifest.events).map(([id, theme]) => {
    const previous = read('events', id);
    if (!previous) throw new Error(`Missing original event ${id}`);
    const { _rev, ...original } = previous;
    return {
      collection: 'events',
      id,
      expectedRevision: _rev,
      value: {
        ...original,
        thumbnail_url: `/images/calendario/${theme}.jpg`,
        thumbnail_alt: manifest.themes[theme as keyof typeof manifest.themes],
      },
    };
  });
}
