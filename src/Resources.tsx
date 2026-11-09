import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays } from 'lucide-react';
import { useDemo } from './context';
import { date, eventsInMonth, label, norm, type Row } from '../shared/model';
import { discoverableFunding, effectiveFundingState } from '../shared/funding';
import {
  Empty,
  External,
  Field,
  Form,
  Layout,
  ListState,
  Modal,
  Notice,
  Page,
  Provenance,
  Save,
  Select,
  Source,
  TargetLink,
} from './components';
const info: Record<string, { collection: string; title: string; type: string }> = {
  alianzas: { collection: 'alliances', title: 'Alianzas y convenios', type: 'alliance' },
  financiamiento: {
    collection: 'funding_calls',
    title: 'Concursos y financiamiento',
    type: 'funding',
  },
  calendario: { collection: 'events', title: 'Calendario de eventos', type: 'event' },
  formacion: { collection: 'learning', title: 'Formación', type: 'learning' },
  cases: { collection: 'cases', title: 'Casos de innovación', type: 'case' },
  news: { collection: 'news', title: 'Noticias', type: 'news' },
  trends: { collection: 'trends', title: 'Tendencias', type: 'trend' },
};
const options = (a: any[]) => [
  { id: 'todos', name: 'Todos' },
  ...[...new Set(a.filter(Boolean))].map((v) => ({ id: String(v), name: label(v) })),
];
function useFundingRows(rows: Row[], demoToday: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const current = Date.now();
    const next = Math.min(
      ...rows
        .filter((r) => !r.demo && r.state === 'abierto' && r.provenance?.verified_current)
        .map((r) => Date.parse(r.closing_at))
        .filter((deadline) => deadline > current),
    );
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(next - current + 10, 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [rows, now]);
  return rows.map((r) => ({ ...r, state: effectiveFundingState(r, demoToday, Date.now()) }));
}
function fundingDeadline(r: Row) {
  return r.closing_at
    ? new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Santiago',
        hourCycle: 'h23',
      }).format(new Date(r.closing_at)) + ' (Chile)'
    : r.closing_date
      ? date(r.closing_date)
      : 'Por confirmar';
}
function ContentThumbnail({ r }: { r: Row }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const alt = r.thumbnail_alt || 'Ilustración del contenido';
  return (
    <div className="learning-thumbnail">
      {r.thumbnail_url && failedUrl !== r.thumbnail_url ? (
        <img
          src={r.thumbnail_url}
          alt={alt}
          width={960}
          height={540}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(r.thumbnail_url)}
        />
      ) : (
        <div className="learning-thumbnail-fallback" role="img" aria-label={alt}>
          <BookOpen size={44} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
function ResourceCard({ r, kind }: { r: Row; kind: string }) {
  const i = info[kind];
  const innovation = ['cases', 'news', 'trends'].includes(kind);
  return (
    <article className="card">
      {(kind === 'formacion' ||
        kind === 'calendario' ||
        kind === 'financiamiento' ||
        innovation) && (
        <Link
          className="learning-cover-link"
          to={innovation ? `/innovacion/${kind}/${r.id}` : `/${kind}/${r.id}`}
          aria-label={'Ver ' + r.title}
        >
          <ContentThumbnail r={r} />
        </Link>
      )}
      <div className="between">
        <span className={kind === 'formacion' ? `pill learning-format-${r.format}` : 'pill'}>
          {label(r.record_type || r.format || i.type)}
        </span>
        <Save type={i.type} id={r.id} />
      </div>
      <Link
        className="card-title"
        to={
          kind === 'cases' || kind === 'news' || kind === 'trends'
            ? `/innovacion/${kind}/${r.id}`
            : `/${kind}/${r.id}`
        }
      >
        {r.title}
      </Link>
      <p>{r.summary || r.description || r.entity || r.benefit || r.problem || r.organizer}</p>
      {kind === 'financiamiento' && (
        <>
          <p>
            {r.amount_text ||
              (r.amount == null
                ? 'No informado'
                : r.currency + ' ' + new Intl.NumberFormat('es-CL').format(r.amount))}
          </p>
          <small>Estado de convocatoria: {label(r.state)}</small>
          {r.closing_date && (
            <p>
              <small>Cierre: {fundingDeadline(r)}</small>
            </p>
          )}
        </>
      )}
      {kind === 'calendario' && (
        <p>
          {r.start_date
            ? date(r.start_date) + (r.end_date !== r.start_date ? ' – ' + date(r.end_date) : '')
            : r.month
              ? date(r.month)
              : 'Fecha por confirmar'}{' '}
          · {r.city || 'Ciudad por confirmar'}
        </p>
      )}
      {kind === 'formacion' && (
        <small>
          {label(r.level)} ·{' '}
          {r.duration_seconds
            ? Math.round((r.duration_seconds / 60) * 10) / 10 + ' min'
            : 'Duración por confirmar'}
        </small>
      )}
      <Provenance r={r} />
    </article>
  );
}
export function ContentList({ kind }: { kind: string }) {
  const { d } = useDemo(),
    [p, setP] = useSearchParams();
  const f = Object.fromEntries(p);
  const update = (k: string, v: string) => {
    const n = new URLSearchParams(p);
    n.set(k, v);
    setP(n, { replace: true });
  };
  const i = info[kind];
  const funding = discoverableFunding(
    useFundingRows(d.funding_calls, d.meta.demo_now.slice(0, 10)),
  );
  const catalogue = kind === 'financiamiento' ? funding : d[i.collection];
  let rows = catalogue.filter((r: Row) =>
    norm(JSON.stringify([r.title, r.summary, r.description, r.entity])).includes(norm(f.q || '')),
  );
  const select = (field: string, title: string, values: any[]) => (
    <Select
      label={title}
      key={field}
      value={f[field] || 'todos'}
      options={options(values)}
      onChange={(v) => update(field, v)}
    />
  );
  if (kind === 'alianzas')
    rows = rows.filter(
      (r: Row) =>
        (!f.benefit || f.benefit === 'todos' || r.benefit_type === f.benefit) &&
        (!f.segment || f.segment === 'todos' || r.eligibility?.includes(f.segment)),
    );
  if (kind === 'formacion')
    rows = rows.filter(
      (r: Row) =>
        (!f.format || f.format === 'todos' || r.format === f.format) &&
        (!f.level || f.level === 'todos' || r.level === f.level),
    );
  if (kind === 'financiamiento') {
    rows = rows.filter(
      (r: Row) =>
        (!f.segment || f.segment === 'todos' || r.eligible_segments.includes(f.segment)) &&
        (!f.region ||
          f.region === 'todos' ||
          r.regions.includes(f.region) ||
          r.regions.includes('Todo Chile')) &&
        (!f.state || f.state === 'todos' || r.state === f.state) &&
        (!f.currency || f.currency === 'todos' || r.currency === f.currency),
    );
    rows.sort((a: Row, b: Row) =>
      f.order === 'monto' && f.currency && f.currency !== 'todos'
        ? (b.amount ?? -Infinity) - (a.amount ?? -Infinity)
        : f.order === 'recientes'
          ? (b.opening_date || b.reviewed_on || '').localeCompare(
              a.opening_date || a.reviewed_on || '',
            )
          : (a.state === 'abierto'
              ? a.closing_at || a.closing_date || '9999'
              : '9999'
            ).localeCompare(
              b.state === 'abierto' ? b.closing_at || b.closing_date || '9999' : '9999',
            ),
    );
  }
  return (
    <Layout detail title={i.title}>
      <Page>
        <h1>{i.title}</h1>
        <input
          className="search"
          aria-label={'Buscar ' + i.title}
          placeholder="Buscar contenido"
          value={f.q || ''}
          onChange={(e) => update('q', e.target.value)}
        />
        {kind === 'financiamiento' && (
          <>
            <details>
              <summary>Filtros de financiamiento</summary>
              {select(
                'segment',
                'Segmento',
                funding.flatMap((r: Row) => r.eligible_segments),
              )}
              {select(
                'region',
                'Región',
                funding.flatMap((r: Row) => r.regions),
              )}
              {select(
                'state',
                'Estado',
                funding.map((r: Row) => r.state),
              )}
              {select(
                'currency',
                'Moneda',
                funding.map((r: Row) => r.currency),
              )}
            </details>
            <Select
              label="Orden"
              value={f.order || 'cierre'}
              options={[
                { id: 'cierre', name: 'Próximo cierre' },
                { id: 'recientes', name: 'Más recientes' },
                { id: 'monto', name: 'Monto máximo (elige moneda)' },
              ]}
              onChange={(v) => update('order', v)}
            />
            {f.order === 'monto' && (!f.currency || f.currency === 'todos') && (
              <Notice>
                Selecciona una moneda para ordenar por monto. No comparamos CLP con USD.
              </Notice>
            )}
            {Object.entries(f).some(
              ([key, value]) =>
                ['q', 'segment', 'region', 'state', 'currency', 'order', 'tab', 'type'].includes(
                  key,
                ) &&
                value &&
                value !== 'todos',
            ) && (
              <button className="secondary" onClick={() => setP({}, { replace: true })}>
                Limpiar filtros
              </button>
            )}
          </>
        )}
        {kind === 'alianzas' && (
          <>
            <Select
              label="Tipo de beneficio"
              value={f.benefit || 'todos'}
              options={options(d.alliances.map((r: Row) => r.benefit_type))}
              onChange={(v) => update('benefit', v)}
            />
            {select('segment', 'Segmento', d.enums.segment)}
          </>
        )}
        {kind === 'formacion' && (
          <>
            <div className="tabs saved-tabs" role="group" aria-label="Formato">
              {options(d.learning.map((r: Row) => r.format)).map((format) => (
                <button
                  key={format.id}
                  type="button"
                  className={(f.format || 'todos') === format.id ? 'active' : ''}
                  aria-pressed={(f.format || 'todos') === format.id}
                  onClick={() => update('format', format.id)}
                >
                  {format.name}
                </button>
              ))}
            </div>
            {select(
              'level',
              'Nivel',
              d.learning.map((r: Row) => r.level),
            )}
          </>
        )}
        <p className="small muted">{rows.length} registros</p>
        <ListState empty={!rows.length}>
          {rows.map((r: Row) => (
            <ResourceCard key={r.id} r={r} kind={kind} />
          ))}
        </ListState>
      </Page>
    </Layout>
  );
}
export function Innovation() {
  const { d } = useDemo(),
    [p, setP] = useSearchParams();
  const tab = p.get('tab') || 'cases',
    q = p.get('q') || '',
    country = p.get('country') || 'todos',
    category = p.get('category') || 'todos';
  const kind = ['cases', 'news', 'trends'].includes(tab) ? tab : 'cases';
  const update = (key: string, value: string) => {
    const n = new URLSearchParams(p);
    n.set(key, value);
    setP(n, { replace: true });
  };
  const rows = d[kind].filter(
    (r: Row) =>
      norm([r.title, r.summary, r.problem, r.solution].join(' ')).includes(norm(q)) &&
      (country === 'todos' || r.country === country) &&
      (category === 'todos' || r.category === category || r.topic_ids?.includes(category)),
  );
  return (
    <Layout detail title="Innovación">
      <Page>
        <h1>Noticias, casos y tendencias</h1>
        <div className="tabs">
          {[
            ['cases', 'Casos'],
            ['news', 'Noticias'],
            ['trends', 'Tendencias'],
          ].map(([v, t]) => (
            <button className={kind === v ? 'active' : ''} key={v} onClick={() => update('tab', v)}>
              {t}
            </button>
          ))}
        </div>
        <input
          className="search"
          aria-label="Buscar innovación"
          value={q}
          placeholder="Buscar innovación"
          onChange={(e) => update('q', e.target.value)}
        />
        <Select
          label="País"
          value={country}
          options={options(d[kind].map((r: Row) => r.country))}
          onChange={(v) => update('country', v)}
        />
        <Select
          label="Categoría / tema"
          value={category}
          options={options(d[kind].flatMap((r: Row) => [r.category, ...(r.topic_ids || [])]))}
          onChange={(v) => update('category', v)}
        />
        <p className="muted">{rows.length} contenidos</p>
        {(q || country !== 'todos' || category !== 'todos') && (
          <button className="secondary" onClick={() => setP({ tab: kind }, { replace: true })}>
            Limpiar filtros
          </button>
        )}
        <ListState empty={!rows.length}>
          {rows.map((r: Row) => (
            <ResourceCard key={r.id} r={r} kind={kind} />
          ))}
        </ListState>
      </Page>
    </Layout>
  );
}
export function Calendar() {
  const { d } = useDemo(),
    [p, setP] = useSearchParams();
  const month = p.get('month') || d.meta.demo_now.slice(0, 7),
    view = p.get('view') || 'agenda';
  const update = (k: string, v: string) => {
    const next = new URLSearchParams(p);
    next.set(k, v);
    setP(next, { replace: true });
  };
  const move = (n: number) => {
    const dt = new Date(month + '-15T12:00:00Z');
    dt.setUTCMonth(dt.getUTCMonth() + n);
    update('month', dt.toISOString().slice(0, 7));
  };
  const filter = (r: Row) =>
    ['category', 'country', 'city', 'mode'].every(
      (k) => !p.get(k) || p.get(k) === 'todos' || r[k] === p.get(k),
    );
  const rows = eventsInMonth(d, month).filter(filter);
  const tentative = rows.filter((r: Row) => !r.start_date),
    precise = rows.filter((r: Row) => r.start_date),
    unknown = d.events.filter((r: Row) => !r.month && !r.start_date && filter(r));
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const blank = (new Date(month + '-01T12:00Z').getUTCDay() + 6) % 7;
  return (
    <Layout detail title="Calendario de eventos">
      <Page>
        <h1>Agenda del ecosistema</h1>
        <div className="tabs">
          {['agenda', 'calendario'].map((v) => (
            <button
              key={v}
              className={view === v ? 'active' : ''}
              onClick={() => update('view', v)}
            >
              {label(v)}
            </button>
          ))}
        </div>
        <div className="between">
          <button className="icon" aria-label="Mes anterior" onClick={() => move(-1)}>
            <ArrowLeft size={20} />
          </button>
          <h2>{date(month).replace(' · fecha tentativa', '')}</h2>
          <button className="icon" aria-label="Mes siguiente" onClick={() => move(1)}>
            <ArrowRight size={20} />
          </button>
        </div>
        <Field
          label="Ir a mes"
          name="month"
          type="month"
          value={month}
          onChange={(e: any) => update('month', e.target.value)}
        />
        <details>
          <summary>Filtrar eventos</summary>
          {['category', 'country', 'city', 'mode'].map((k) => (
            <Select
              key={k}
              label={
                { category: 'Categoría', country: 'País', city: 'Ciudad', mode: 'Modalidad' }[k]!
              }
              value={p.get(k) || 'todos'}
              options={options(d.events.map((r: Row) => r[k]))}
              onChange={(v) => update(k, v)}
            />
          ))}
        </details>
        <ListState>
          {view === 'calendario' && (
            <div className="calendar-grid">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => (
                <b key={i}>{day}</b>
              ))}
              {Array.from({ length: blank }, (_, i) => (
                <span key={'blank' + i} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = month + '-' + String(i + 1).padStart(2, '0'),
                  events = precise.filter(
                    (r: Row) => r.start_date <= day && (r.end_date || r.start_date) >= day,
                  );
                return (
                  <div className={'calendar-day ' + (events.length ? 'has-events' : '')} key={day}>
                    <span>{i + 1}</span>
                    {events.map((r: Row) => (
                      <Link title={r.title} to={'/calendario/' + r.id} key={r.id}>
                        {r.title}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {precise.length ? (
            precise.map((r: Row) => <ResourceCard key={r.id} r={r} kind="calendario" />)
          ) : (
            <Empty>Sin eventos registrados para los filtros elegidos</Empty>
          )}
          {tentative.length > 0 && (
            <>
              <h2>Durante este mes, fecha tentativa</h2>
              {tentative.map((r: Row) => (
                <ResourceCard key={r.id} r={r} kind="calendario" />
              ))}
            </>
          )}
          {unknown.length > 0 && (
            <details>
              <summary>Fecha por confirmar ({unknown.length})</summary>
              {unknown.map((r: Row) => (
                <ResourceCard key={r.id} r={r} kind="calendario" />
              ))}
            </details>
          )}
        </ListState>
      </Page>
    </Layout>
  );
}
function DataField({ title, value }: { title: string; value: any }) {
  return (
    <div className="data-field">
      <h3>{title}</h3>
      {Array.isArray(value) ? (
        value.length ? (
          <ul>
            {value.map((v: any, i: number) => (
              <li key={i}>{typeof v === 'object' ? Object.values(v).join(' · ') : label(v)}</li>
            ))}
          </ul>
        ) : (
          <p>No informado</p>
        )
      ) : (
        <p>{value == null || value === '' ? 'No informado' : String(value)}</p>
      )}
    </div>
  );
}
export function ContentDetail({ kind: given }: { kind?: string }) {
  const { kind: routeKind, id } = useParams(),
    kind = given || routeKind || 'cases',
    i = info[kind],
    { d, act, toast } = useDemo();
  const [modal, setModal] = useState('');
  const funding = useFundingRows(d.funding_calls, d.meta.demo_now.slice(0, 10));
  const r = i
    ? (kind === 'financiamiento' ? funding : d[i.collection]).find((r: Row) => r.id === id)
    : null;
  if (!r)
    return (
      <Layout detail>
        <Page>
          <Empty>Contenido no encontrado</Empty>
        </Page>
      </Layout>
    );
  const activity = (event: string, value?: any) =>
    act({ type: 'activity', kind: event, target_type: i.type, target_id: r.id, value });
  const done = (event: string) =>
    d.activity.some((a: Row) => a.kind === event && a.target_id === r.id);
  const progress =
    d.learning_progress.find((p: Row) => p.learning_id === id)?.progress_percent || 0;
  const inlineVideo =
    kind === 'formacion' && !r.demo && /^\/videos\/[\w/-]+\.mp4$/i.test(r.media_url || '');
  return (
    <Layout detail title={i.title}>
      <Page>
        {(kind === 'formacion' ||
          kind === 'calendario' ||
          kind === 'financiamiento' ||
          ['cases', 'news', 'trends'].includes(kind)) && (
          <div className="learning-detail-cover">
            {inlineVideo ? (
              <video
                className="learning-video"
                controls
                playsInline
                preload="metadata"
                poster={r.thumbnail_url}
                width={960}
                height={540}
                aria-label={'Video: ' + r.title}
              >
                <source src={r.media_url} type="video/mp4" />
                Tu navegador no admite este video. <a href={r.media_url}>Abrir video</a>
              </video>
            ) : (
              <ContentThumbnail r={r} />
            )}
          </div>
        )}
        <div className="between">
          <span className="pill">{label(r.record_type || r.format || i.type)}</span>
          <Save type={i.type} id={r.id} />
        </div>
        <h1>{r.title}</h1>
        <Provenance r={r} />
        {kind === 'alianzas' && (
          <>
            <DataField title="Descripción" value={r.summary} />
            <DataField title="Beneficio concreto" value={r.benefit} />
            <DataField title="Destinatarios" value={r.eligibility} />
            <DataField title="Vigencia" value={r.valid_until ? date(r.valid_until) : null} />
            <DataField title="Pasos para acceder" value={r.access_steps} />
            {r.demo ? (
              <button className="primary" onClick={() => setModal('alliance')}>
                {done('alliance_request') ? 'Solicitud demo registrada' : 'Solicitar acceso'}
              </button>
            ) : (
              <Notice>Iniciativa colaborativa. Beneficio y acceso por confirmar.</Notice>
            )}
          </>
        )}
        {kind === 'financiamiento' && (
          <>
            {r.catalog_hidden && (
              <Notice>
                Registro archivado. Se conserva para consultar tus contenidos guardados y no forma
                parte del catálogo actual.
              </Notice>
            )}
            {r.summary && <DataField title="Descripción" value={r.summary} />}
            <DataField title="Convocatoria / instrumento" value={r.edition || r.record_type} />
            <DataField
              title={r.catalog_hidden ? 'Estado registrado' : 'Estado de convocatoria'}
              value={label(r.state)}
            />
            {r.reviewed_on && (
              <p className="small muted">Información revisada el {date(r.reviewed_on)}</p>
            )}
            <DataField title="Entidad" value={r.entity} />
            <DataField title="Elegibilidad y cofinanciamiento" value={r.eligibility} />
            <DataField title="Segmentos" value={r.eligible_segments} />
            <DataField title="Regiones" value={r.regions} />
            <div className="decision">
              <DataField
                title="Monto y moneda"
                value={
                  r.amount_text ||
                  (r.amount == null
                    ? 'No informado'
                    : `${r.currency} ${new Intl.NumberFormat('es-CL').format(r.amount)}`)
                }
              />
            </div>
            <DataField
              title={r.catalog_hidden ? 'Apertura registrada' : 'Apertura de convocatoria vigente'}
              value={r.opening_date ? date(r.opening_date) : r.source_opening_text}
            />
            <DataField
              title={r.catalog_hidden ? 'Cierre registrado' : 'Cierre de convocatoria vigente'}
              value={r.closing_date ? fundingDeadline(r) : 'Por confirmar'}
            />
            {r.catalog_hidden && r.record_type !== 'convocatoria' && (
              <Notice>
                Este registro es un hito o resultado; no representa una convocatoria abierta.
              </Notice>
            )}
            {r.catalog_hidden && (
              <DataField
                title="Hito / resultados"
                value={r.milestone_date ? date(r.milestone_date) : null}
              />
            )}
            {r.official_url && <External url={r.official_url}>Ver programa oficial</External>}
          </>
        )}
        {kind === 'calendario' && (
          <>
            <div className="decision">
              <h2>
                {r.start_date
                  ? date(r.start_date) +
                    (r.end_date !== r.start_date ? ' – ' + date(r.end_date) : '')
                  : r.month
                    ? date(r.month)
                    : 'Fecha por confirmar'}
              </h2>
              <p>
                {r.start_time
                  ? `${r.start_time}${r.end_time ? ' – ' + r.end_time : ''} · ${r.timezone}`
                  : 'Hora no informada'}
              </p>
            </div>
            <DataField
              title="Sede y ciudad"
              value={[r.venue, r.city, r.country ? label(r.country) : null]
                .filter(Boolean)
                .join(' · ')}
            />
            <DataField title="Modalidad" value={r.mode ? label(r.mode) : null} />
            <DataField title="Organizador" value={r.organizer} />
            <DataField title="Público" value={r.audience} />
            <DataField
              title="Costo"
              value={
                r.cost == null
                  ? 'Costo no informado'
                  : r.cost === 0
                    ? 'Sin costo'
                    : `${r.currency} ${new Intl.NumberFormat('es-CL').format(r.cost)}`
              }
            />
            <button
              disabled={!r.start_date}
              onClick={() =>
                void activity('event_reminder')
                  .then(() =>
                    toast(
                      r.start_time
                        ? 'Recordatorio demo guardado'
                        : 'Recordatorio demo de día completo guardado',
                    ),
                  )
                  .catch(() => {})
              }
            >
              {done('event_reminder') ? 'Recordatorio guardado' : 'Recordarme'}
            </button>
            {!r.start_date && <small>Los recordatorios necesitan una fecha precisa.</small>}
            <button onClick={() => setModal('calendar')}>
              Añadir a calendario · previsualizar
            </button>
            {r.demo ? (
              <button className="primary" onClick={() => setModal('registration')}>
                {done('event_registration') ? 'Inscripción demo registrada' : 'Inscripción demo'}
              </button>
            ) : (
              <External url={r.registration_url}>Ir a inscripción externa</External>
            )}
          </>
        )}
        {kind === 'cases' && (
          <>
            {[
              ['Problema', r.problem],
              ['Solución', r.solution],
              ['Desarrollador', r.developer],
              ['Mandante / faena', r.site],
              [r.demo ? 'Indicadores propuestos' : 'Resultados reportados', r.results],
              ['Condición de los resultados', r.results_status],
              ['Fecha', r.published_on ? date(r.published_on) : r.source_date_text],
            ].map(([title, value]) => (
              <DataField key={title} title={title} value={value} />
            ))}
          </>
        )}
        {kind === 'news' && (
          <>
            <p>{date(r.published_on) || r.published_date_text}</p>
            <DataField title="Resumen" value={r.summary} />
          </>
        )}
        {kind === 'trends' && (
          <>
            <DataField title="Tesis editorial" value={r.summary} />
            <DataField title="Implicación para el proveedor" value={r.implication} />
          </>
        )}
        {kind === 'formacion' && (
          <>
            <DataField title="Descripción" value={r.description} />
            <DataField title="Autor" value={r.author} />
            <p>
              {label(r.level)} ·{' '}
              {r.duration_seconds
                ? Math.round((r.duration_seconds / 60) * 10) / 10 + ' minutos'
                : 'Duración por confirmar'}
            </p>
            <DataField title="Capítulos" value={r.chapters} />
            {r.demo ? (
              <div className="lesson">
                <CalendarDays size={30} />
                <h2>Reproducción</h2>
                <progress aria-label="Progreso de aprendizaje" max={100} value={progress} />
                <p>{progress}% completado</p>
                <button
                  className="primary"
                  onClick={() =>
                    void act({
                      type: 'progress',
                      learning_id: id,
                      progress: Math.min(100, progress + 25),
                    }).catch(() => {})
                  }
                >
                  {progress === 100 ? 'Revisar lección' : 'Avanzar lección'}
                </button>
                <button
                  onClick={() =>
                    void act({ type: 'progress', learning_id: id, progress: 0 }).catch(() => {})
                  }
                >
                  Reiniciar progreso
                </button>
              </div>
            ) : inlineVideo ? null : (
              <>
                <Notice>
                  Video de referencia: resumen de jornada, no un curso completo. Puede no
                  reproducirse embebido.
                </Notice>
                <External url={r.media_url}>Abrir video de referencia</External>
              </>
            )}
          </>
        )}
        {['cases', 'news', 'trends', 'financiamiento'].includes(kind) &&
          r.body_sections?.map((section: { heading: string; body: string }, index: number) => (
            <DataField key={index} title={section.heading} value={section.body} />
          ))}
        {kind === 'trends' && r.related_challenge_ids.length > 0 && (
          <>
            <h2>Desafíos relacionados</h2>
            {r.related_challenge_ids.map((rid: string) => (
              <TargetLink key={rid} type="challenge" id={rid}>
                <div className="row-link">{d.challenges.find((c: Row) => c.id === rid)?.title}</div>
              </TargetLink>
            ))}
          </>
        )}
        {!['formacion', 'calendario', 'financiamiento', 'cases', 'news', 'trends'].includes(
          kind,
        ) && <Source r={r} />}
      </Page>
      {modal && (
        <Modal
          title={
            modal === 'alliance'
              ? 'Revisar solicitud de acceso'
              : modal === 'calendar'
                ? 'Previsualización de calendario'
                : 'Inscripción de demostración'
          }
          onClose={() => setModal('')}
        >
          <h3>{r.title}</h3>
          {modal === 'alliance' ? (
            <>
              <p>{r.benefit}</p>
              <p>La solicitud se guardará solo en tu sesión. No contactaremos instituciones.</p>
              <button
                className="primary"
                onClick={() =>
                  void activity('alliance_request')
                    .then(() => {
                      setModal('');
                      toast('Solicitud de acceso simulada registrada');
                    })
                    .catch(() => {})
                }
              >
                Confirmar solicitud demo
              </button>
            </>
          ) : modal === 'calendar' ? (
            <>
              <p>
                {r.start_date
                  ? date(r.start_date)
                  : r.month
                    ? date(r.month)
                    : 'Fecha por confirmar'}{' '}
                · {r.start_time || 'Día completo / hora por confirmar'}
              </p>
              <p>No sincronizamos con Google, Microsoft ni otros calendarios.</p>
              <button
                onClick={() => {
                  setModal('');
                  toast('Previsualización cerrada. No se sincronizó ningún calendario.');
                }}
              >
                Cerrar previsualización
              </button>
            </>
          ) : (
            <>
              <p>Solo guardamos tu interés en este escenario, sin inscripción ni pago real.</p>
              <button
                className="primary"
                onClick={() =>
                  void activity('event_registration')
                    .then(() => {
                      setModal('');
                      toast('Inscripción simulada guardada');
                    })
                    .catch(() => {})
                }
              >
                Confirmar inscripción demo
              </button>
            </>
          )}
        </Modal>
      )}
    </Layout>
  );
}
export function Concepts() {
  const { kind } = useParams(),
    { d, act, toast } = useDemo();
  const partner = kind === 'socios';
  const rows = partner ? d.partner_concepts : d.signals;
  return (
    <Layout detail title={partner ? 'Socios y consorcios' : 'Señales débiles'}>
      <Page>
        <p className="eyebrow">CONCEPTO PARA VALIDAR</p>
        <h1>{partner ? 'Capacidades que se complementan' : 'Observaciones para explorar'}</h1>
        <Notice>
          Ejemplos ficticios. No hay invitaciones, consorcios reales, contratos ni información
          reservada de compañías.
        </Notice>
        {rows.map((r: Row) => (
          <div className="card" key={r.id} id={r.id}>
            <h2>{r.title}</h2>
            <span className="provenance fiction">
              {partner ? 'Concepto para validar' : 'Ejemplo editorial ficticio'}
            </span>
            {partner ? (
              <>
                <DataField
                  title="Capacidades complementarias necesarias"
                  value={r.needed_capabilities}
                />
                <DataField
                  title="Empresas demo sugeridas"
                  value={r.suggested_company_ids.map(
                    (id: string) =>
                      d.profiles.find((p: Row) => p.company_id === id)?.company_name || id,
                  )}
                />
                <TargetLink type="challenge" id={r.challenge_id}>
                  Consultar desafío relacionado →
                </TargetLink>
              </>
            ) : (
              <>
                {[
                  ['Observación', r.observation],
                  ['Fecha', date(r.observed_on)],
                  ['Confianza', label(r.confidence)],
                  ['Horizonte', r.horizon],
                  ['Implicación', r.implication],
                  [
                    'Evidencia disponible',
                    r.evidence_urls?.length
                      ? r.evidence_urls.join(', ')
                      : 'No se aporta evidencia adicional al ejemplo ficticio',
                  ],
                ].map(([title, value]) => (
                  <DataField key={title} title={title} value={value} />
                ))}
              </>
            )}
            <button
              onClick={() =>
                void act({
                  type: 'activity',
                  kind: 'concept_interest',
                  target_type: partner ? 'partner' : 'signal',
                  target_id: r.id,
                })
                  .then(() => toast('Interés guardado localmente, sin contactar a terceros'))
                  .catch(() => {})
              }
            >
              {d.activity.some((a: Row) => a.target_id === r.id && a.kind === 'concept_interest')
                ? 'Interés registrado'
                : 'Me interesa esta idea'}
            </button>
          </div>
        ))}
      </Page>
    </Layout>
  );
}
export function Sources() {
  const { d } = useDemo();
  return (
    <Layout detail title="Fuentes del mercado">
      <Page>
        <h1>Directorio de plataformas</h1>
        <Notice>
          Estas fuentes no son desafíos individuales ni acreditan convocatorias vigentes.
        </Notice>
        {d.market_sources.map((r: Row) => (
          <div className="card" key={r.id}>
            <h2>{r.name}</h2>
            <p>{r.role}</p>
            <External url={r.url} />
          </div>
        ))}
      </Page>
    </Layout>
  );
}
