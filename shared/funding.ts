import type { Row } from './model.ts';

export function discoverableFunding(rows: Row[]): Row[] {
  return rows.filter((row) => !row.catalog_hidden);
}

export function effectiveFundingState(row: Row, demoToday: string, realNow = Date.now()): string {
  if (row.state !== 'abierto') return row.state;
  if (
    row.demo &&
    row.record_type === 'convocatoria' &&
    row.closing_date &&
    demoToday > row.closing_date
  )
    return 'cerrado';
  if (
    !row.demo &&
    row.provenance?.verified_current &&
    row.closing_at &&
    Number.isFinite(Date.parse(row.closing_at)) &&
    realNow >= Date.parse(row.closing_at)
  )
    return 'cerrado';
  return row.state;
}
