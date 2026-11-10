import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  CircleX,
  SlidersHorizontal,
} from 'lucide-react';
import { useDemo } from './context';
import { affinity, challenges, date, label, type Row } from '../shared/model';
import {
  ChallengeCard,
  Empty,
  External,
  Field,
  Form,
  formRevision,
  Layout,
  ListState,
  Modal,
  Multi,
  Notice,
  Page,
  Provenance,
  Save,
  Select,
  Source,
  Tags,
} from './components';


const challengeSortOptions = [
  { id: 'cierre_asc', name: 'Próximos a cerrar' },
  { id: 'recientes', name: 'Más recientes' },
  { id: 'afinidad', name: 'Afinidad con mi solución' },
];

export function Catalog() {
  const { d, company } = useDemo(),
    [params, setParams] = useSearchParams(),
    [filters, setFilters] = useState(false);
  const f = Object.fromEntries(params);
  const selected = d.solutions.find((s: Row) => s.id === f.solution) || d.solutions[0];
  const parsed = {
    ...f,
    state: f.state || 'todos',
    ...Object.fromEntries(
      ['state', 'origin', 'process', 'topic', 'country', 'mandante', 'payer']
        .filter((k) => f[k])
        .map((k) => [k, f[k] === 'todos' ? 'todos' : f[k].split('|')]),
    ),
    include_unknown: f.include_unknown === 'true',
    trl: f.compatible === 'true' ? selected?.trl : f.trl,
    company,
    solution: selected,
  };
  const list = challenges(d, parsed);
  const update = (patch: Record<string, any>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch))
      v == null || v === '' ? p.delete(k) : p.set(k, String(v));
    setParams(p, { replace: true });
  };
  return (
    <Layout title="Desafíos">
      <Page>
        <input
          className="search"
          aria-label="Buscar desafíos"
          placeholder="Buscar desafío, proceso o mandante"
          value={f.query || ''}
          onChange={(e) => update({ query: e.target.value })}
        />
        <div className="tabs">
          {[
            ['', 'Todos'],
            ['expande', 'Expande'],
            ['externo', 'Mercado'],
          ].map(([v, t]) => (
            <button
              key={v}
              className={(f.origin || '') === v ? 'active' : ''}
              onClick={() => update({ origin: v })}
            >
              {t}
            </button>
          ))}
        </div>
        <Notice>
          Expande actualiza automáticamente el seguimiento de sus desafíos. En oportunidades de
          mercado, tu empresa mantiene el estado manualmente para conservar todo en un solo lugar.
        </Notice>
        <div className="between challenge-catalog-toolbar">
          <button onClick={() => setFilters(true)}>
            <SlidersHorizontal size={16} /> Filtros
            {Object.keys(f).filter((k) => !['query', 'order', 'origin'].includes(k)).length > 0
              ? ' · activos'
              : ''}
          </button>
          <Select
            label="Ordenar"
            labelHidden
            className="challenge-catalog-sort"
            value={f.order || 'cierre_asc'}
            options={challengeSortOptions}
            onChange={(value) => update({ order: value })}
          />
        </div>
        {f.order === 'afinidad' && (
          <Select
            label="Solución"
            value={selected?.id || ''}
            options={d.solutions.map((s: Row) => ({ id: s.id, name: s.title }))}
            onChange={(v) => update({ solution: v })}
          />
        )}
        {Object.entries(f).some(
          ([k, v]) =>
            v &&
            ['process', 'topic', 'country', 'mandante', 'payer', 'trl', 'compatible'].includes(k),
        ) && (
          <div className="chips active-filters">
            {Object.entries(f)
              .filter(
                ([k, v]) =>
                  v &&
                  [
                    'process',
                    'topic',
                    'country',
                    'mandante',
                    'payer',
                    'trl',
                    'compatible',
                  ].includes(k),
              )
              .map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => update({ [k]: null })}
                  aria-label={'Quitar filtro ' + k}
                >
                  {label(k)}: {v.split('|').map(label).join(', ')} ×
                </button>
              ))}
          </div>
        )}
        <div className="between small challenge-catalog-meta">
          <strong>
            {list.length} desafíos ·{' '}
            {f.state
              ? f.state === 'todos'
                ? 'Todos los estados'
                : f.state.split('|').map(label).join(', ')
              : 'Todos los estados'}
          </strong>
          <Link className="market-sources-link" to="/fuentes">
            Fuentes del mercado
          </Link>
        </div>
        <ListState empty={false}>
          {list.length ? (
            list.map((r: Row) => <ChallengeCard key={r.id} r={r} />)
          ) : (
            <Empty action={<button onClick={() => setParams({})}>Limpiar filtros</button>} />
          )}
        </ListState>
      </Page>
      {filters && (
        <Filters
          initial={f}
          apply={(v) => {
            setParams(v);
            setFilters(false);
          }}
          close={() => setFilters(false)}
        />
      )}
    </Layout>
  );
}
function Filters({
  initial,
  apply,
  close,
}: {
  initial: Record<string, string>;
  apply: (p: Record<string, string>) => void;
  close: () => void;
}) {
  const { d } = useDemo();
  const [f, setF] = useState<Record<string, string>>({
    ...initial,
    state: initial.state || 'todos',
  });
  const multi = (key: string, title: string, opts: Row[]) => (
    <Multi
      key={key}
      title={title}
      options={opts}
      value={(f[key] || '').split('|')}
      onChange={(v) =>
        setF({ ...f, [key]: (key === 'state' ? v.filter((s) => s !== 'todos') : v).join('|') })
      }
    />
  );
  const ids = (a: string[]) => a.map((id) => ({ id, name: label(id) }));
  const solution = d.solutions.find((r: Row) => r.id === f.solution) || d.solutions[0];
  const count = challenges(d, {
    ...f,
    state: f.state || 'todos',
    ...Object.fromEntries(
      ['state', 'origin', 'process', 'topic', 'country', 'mandante', 'payer']
        .filter((k) => f[k])
        .map((k) => [k, f[k] === 'todos' ? 'todos' : f[k].split('|')]),
    ),
    include_unknown: f.include_unknown === 'true',
    trl: f.compatible === 'true' ? solution?.trl : f.trl,
  }).length;
  return (
    <Modal title="Filtrar desafíos" onClose={close}>
      {multi('state', 'Estado', ids(d.enums.challenge_state))}
      <button onClick={() => setF({ ...f, state: 'todos' })}>Todos los estados</button>
      {multi('origin', 'Origen', ids(d.enums.origin))}
      {multi('process', 'Proceso minero', d.processes)}
      {multi('topic', 'Temas', d.topics)}
      {multi(
        'country',
        'País de la oportunidad',
        ids([...new Set<string>(d.challenges.map((r: Row) => r.country))]),
      )}
      {multi(
        'mandante',
        'Mandante',
        ids([...new Set<string>(d.challenges.map((r: Row) => r.mandante))]),
      )}
      <Select
        label="Compatible con TRL"
        value={f.trl || ''}
        options={[
          { id: '', name: 'Sin filtro' },
          ...Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), name: 'TRL ' + (i + 1) })),
        ]}
        onChange={(v) => setF({ ...f, trl: v })}
      />
      {d.solutions.length ? (
        <>
          <Select
            label="Mi solución para compatibilidad TRL"
            value={solution.id}
            options={d.solutions.map((r: Row) => ({ id: r.id, name: r.title }))}
            onChange={(v) => setF({ ...f, solution: v })}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={f.compatible === 'true'}
              onChange={(e) =>
                setF({ ...f, compatible: String(e.target.checked), solution: solution.id })
              }
            />
            Compatible con el TRL de mi solución
          </label>
          {solution.trl == null && (
            <Notice>Falta el TRL de esta solución. No se restringe el catálogo.</Notice>
          )}
        </>
      ) : (
        <Notice>Añade una solución para evaluar TRL. Puedes explorar todo el catálogo.</Notice>
      )}
      {multi('payer', 'Financiamiento', ids(['mandante', 'proveedor', 'compartido']))}
      <label className="check">
        <input
          type="checkbox"
          checked={f.include_unknown === 'true'}
          onChange={(e) => setF({ ...f, include_unknown: String(e.target.checked) })}
        />
        Incluir datos no informados
      </label>
      <div className="button-row">
        <button onClick={() => setF({})}>Limpiar</button>
        <button
          className="primary"
          onClick={() => apply(Object.fromEntries(Object.entries(f).filter(([, v]) => v)))}
        >
          Aplicar ({count})
        </button>
      </div>
    </Modal>
  );
}
export function ChallengeDetail() {
  const { id } = useParams(),
    { d, company, act } = useDemo();
  const r = d.challenges.find((r: Row) => r.id === id);
  const [sid, setSid] = useState(d.solutions[0]?.id || ''),
    [why, setWhy] = useState(false),
    [apply, setApply] = useState(false);
  if (!r)
    return (
      <Layout detail>
        <Page>
          <Empty>Desafío no encontrado</Empty>
        </Page>
      </Layout>
    );
  const sol = d.solutions.find((s: Row) => s.id === sid);
  const a = affinity(company, sol, r, d);
  const followed = d.follows.some((f: Row) => f.challenge_id === id);
  const money =
    r.funding?.amount == null
      ? 'Monto no informado'
      : new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: r.funding.currency || 'CLP',
          maximumFractionDigits: 0,
        }).format(r.funding.amount);
  return (
    <Layout
      detail
      footer={
        <>
          {r.origin === 'expande' ? (
            <button
              onClick={() =>
                void act({ type: 'follow', target_type: 'challenge', target_id: id }).catch(() => {})
              }
            >
              {followed ? 'Desactivar seguimiento automático' : 'Activar seguimiento automático'}
            </button>
          ) : (
            <Link className="button" to={`/postulaciones/nueva?challenge=${id}`}>
              Registrar seguimiento manual
            </Link>
          )}
          {r.state === 'abierto' ? (
            <Link className="button primary" to={`/desafios/${id}/preparar`}>
              Preparar antecedentes
            </Link>
          ) : r.state === 'cerrado' ? (
            <span className="challenge-availability-badge closed">
              <CircleX size={16} aria-hidden="true" />
              Convocatoria cerrada
            </span>
          ) : r.state === 'proximo' ? (
            <span className="challenge-availability-badge upcoming">
              <CalendarClock size={16} aria-hidden="true" />
              Próxima convocatoria
            </span>
          ) : (
            <span className="challenge-availability-badge unconfirmed">
              <CircleHelp size={16} aria-hidden="true" />
              Estado por confirmar
            </span>
          )}
        </>
      }
    >
      <Page>
        <div className="between">
          <Tags r={r} />
          <Save type="challenge" id={id!} />
        </div>
        <h1>{r.title}</h1>
        <p className="muted">
          {r.mandante}
          {r.site ? ' · ' + r.site : ''}
        </p>
        <Provenance r={r} />
        <div className="decision">
          <p className="eyebrow">PARA DECIDIR</p>
          <div className="decision-grid">
            <div>
              <small>Financiamiento · {label(r.funding?.payer || 'no_informado')}</small>
              <strong>{money}</strong>
            </div>
            <div>
              <small>TRL requerido</small>
              <strong>
                {r.trl_min == null
                  ? 'No informado'
                  : r.trl_min + (r.trl_max != null ? '–' + r.trl_max : '+')}
              </strong>
            </div>
            <div>
              <small>Duración piloto</small>
              <strong>
                {r.pilot_duration_days == null ? 'No informado' : r.pilot_duration_days + ' días'}
              </strong>
            </div>
            <div>
              <small>Área interlocutora</small>
              <strong>{r.contact_area || 'No informado'}</strong>
            </div>
          </div>
          <small className="challenge-closing-label">Cierre</small>
          <strong>
            {r.closes_at
              ? date(r.closes_at, true) + ' · ' + (r.country === 'CL' ? 'Chile' : r.country)
              : r.source_dates_text || 'Fecha por confirmar'}
          </strong>
          {r.closes_at && r.country !== 'CL' && (
            <small>Equivalencia en America/Santiago · fecha de origen: {r.closes_at}</small>
          )}
          <p>{r.funding?.description}</p>
        </div>
        <div className={`card challenge-tracking-card ${r.origin}`}>
          <p className="eyebrow">SEGUIMIENTO</p>
          <h2>
            {r.origin === 'expande'
              ? 'Automático con Expande'
              : 'Actualizado manualmente por tu empresa'}
          </h2>
          <p>
            {r.origin === 'expande'
              ? 'Las actualizaciones disponibles en Expande se reflejan en la postulación y su historial. El estado es de solo lectura para tu empresa.'
              : 'Esta oportunidad no comparte estados con Expande. Registra la postulación y actualiza su estado, etapa, resultado y notas para mantener tu seguimiento al día.'}
          </p>
        </div>
        <div className="card">
          <h2>Resumen del desafío</h2>
          <p>{r.summary}</p>
        </div>
        <div className="card">
          <div className="between">
            <h2>Afinidad con tu solución</h2>
            <button className="text" onClick={() => setWhy(true)}>
              ¿Por qué?
            </button>
          </div>
          {d.solutions.length ? (
            <>
              <Select
                label="Evaluar con"
                options={d.solutions.map((s: Row) => ({ id: s.id, name: s.title }))}
                value={sid}
                onChange={setSid}
              />
              <div className="affinity-list" role="list" aria-label="Resultado de afinidad">
                {[
                  ['Proceso', a.process],
                  ['Temas', a.topics],
                  ['Cobertura', a.coverage],
                  ['TRL', a.trl],
                ].map(([name, value]) => {
                  const status = value == null ? 'unknown' : value === 1 ? 'match' : 'no-match';
                  const result =
                    status === 'unknown'
                      ? 'Falta información'
                      : status === 'match'
                        ? 'Coincide'
                        : 'Sin coincidencia' + (name === 'TRL' ? ' · Incompatible' : '');
                  const Icon =
                    status === 'match' ? CheckCircle2 : status === 'no-match' ? CircleX : CircleHelp;
                  return (
                    <div className="affinity-row" role="listitem" key={String(name)}>
                      <span className="affinity-label">{name}</span>
                      <span className={`affinity-badge ${status}`}>
                        <Icon size={14} aria-hidden="true" />
                        {result}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <Notice>
              Añade una solución para evaluar TRL. Puedes explorar todos los desafíos.
            </Notice>
          )}
        </div>
        <div className="card">
          <h2>Requisitos obligatorios</h2>
          {r.requirements.length ? (
            <ul>
              {r.requirements.map((q: any, i: number) => (
                <li key={i}>
                  {typeof q === 'string'
                    ? q
                    : q.text ||
                      q.description ||
                      Object.values(q)
                        .filter((v) => typeof v === 'string')
                        .join(' · ')}
                </li>
              ))}
            </ul>
          ) : (
            <p>No informados</p>
          )}
          <h3>Exclusiones</h3>
          {r.exclusions.length ? (
            <ul>
              {r.exclusions.map((x: string) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p>No informadas</p>
          )}
        </div>
        <div className="card">
          <h2>Problema y contexto</h2>
          {[
            ['Problema', r.problem],
            ['Objetivo', r.objective],
            ['Contexto operativo', r.operational_context],
            ['Quién puede postular', r.eligible_entities?.join(' · ')],
          ].map(([k, v]) => (
            <div key={k}>
              <h3>{k}</h3>
              <p>{v || 'No informado'}</p>
            </div>
          ))}
          <h3>Etapas previstas del desafío</h3>
          {r.planned_stages?.map((s: any, i: number) => (
            <p key={i}>
              {typeof s === 'string'
                ? s
                : Object.values(s)
                    .filter((v) => typeof v === 'string' || typeof v === 'number')
                    .join(' · ')}{' '}
              · Prevista
            </p>
          ))}
        </div>
        <Link className="row-link" to={`/desafios/${id}/preguntas`}>
          Preguntas públicas <ArrowRight size={18} />
        </Link>
        <Source r={r} />
        {r.state === 'abierto' && (
          <button onClick={() => setApply(true)}>Postular a este desafío</button>
        )}
        {r.state === 'por_confirmar' && (
          <External url={r.application_url}>Consultar fuente</External>
        )}
      </Page>
      {why && (
        <Modal title="Recomendación explicable" onClose={() => setWhy(false)}>
          <p>
            Comparamos los procesos, temas, cobertura y TRL de tu solución con los datos informados
            en el desafío. No es una validación técnica ni una garantía de elegibilidad.
          </p>
          <p>Puedes revisar todos los desafíos aunque no coincidan con tu perfil.</p>
        </Modal>
      )}
      {apply && (
        <Modal title="Postular a este desafío" onClose={() => setApply(false)}>
          <p>
            El flujo de postulación continuará en otro portal, donde podrás completar el proceso
            correspondiente.
          </p>
          <Notice>Esta demostración no envía antecedentes ni registra una postulación.</Notice>
          <div className="button-row">
            <button onClick={() => setApply(false)}>Cerrar</button>
            <Link className="button primary" to="/inicio">
              Volver al inicio
            </Link>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
export function Prepare() {
  const { id } = useParams(),
    { d, company, user, act, toast } = useDemo(),
    nav = useNavigate(),
    [params] = useSearchParams();
  const r = d.challenges.find((r: Row) => r.id === id),
    existing = d.applications.find(
      (a: Row) =>
        a.id === params.get('application') && a.status_origin === 'local' && a.challenge_id === id,
    );
  const [sid, setSid] = useState(existing?.solution_id || d.solutions[0]?.id || ''),
    [team, setTeam] = useState<string[]>(existing?.team_user_ids || [user.id]);
  const solution = d.solutions.find((s: Row) => s.id === sid);
  if (!r || r.state !== 'abierto')
    return (
      <Layout detail title="Preparar antecedentes">
        <Page>
          <Empty>Convocatoria no disponible para preparar</Empty>
        </Page>
      </Layout>
    );
  return (
    <Layout detail title="Preparar antecedentes">
      <Page>
        <p className="eyebrow">BORRADOR LOCAL</p>
        <h1>{r.title}</h1>
        <Notice>
          Preparar antecedentes no envía una postulación. Editas una copia para este desafío.
        </Notice>
        {!solution ? (
          <>
            <p>Añade una solución antes de preparar antecedentes.</p>
            <Link to="/soluciones/nueva" className="button">
              Registrar solución
            </Link>
          </>
        ) : (
          <Form
            submit="Guardar borrador"
            onSubmit={async (v) => {
              const result = await act({
                type: 'draft',
                id: existing?.id,
                revision: formRevision(v, 'applications', existing?.id),
                challenge_id: id,
                solution_id: sid,
                team_user_ids: team,
                proposal_summary: v.proposal_summary,
                note: v.note,
                prepared_company_name: v.prepared_company_name,
                prepared_solution_title: v.prepared_solution_title,
              });
              const created = existing
                ? result.applications.find((a: Row) => a.id === existing.id)
                : result.applications
                    .filter((a: Row) => a.challenge_id === id && a.status_origin === 'local')
                    .at(-1);
              toast('Borrador guardado. No se envió al mandante.');
              nav('/postulaciones/' + created.id);
            }}
          >
            <Field
              label="Empresa en esta preparación (copia)"
              name="prepared_company_name"
              defaultValue={existing?.prepared_snapshot?.company_name || company.name}
              required
            />
            <Select
              label="Solución"
              value={sid}
              options={d.solutions.map((s: Row) => ({ id: s.id, name: s.title }))}
              onChange={setSid}
            />
            <Field
              key={sid}
              label="Nombre de solución en esta preparación (copia)"
              name="prepared_solution_title"
              defaultValue={existing?.prepared_snapshot?.solution_title || solution.title}
              required
            />
            <p>TRL autodeclarado: {solution.trl || 'No informado'}</p>
            <Multi
              title="Equipo postulante"
              options={d.users.filter((u: Row) => u.status === 'activo')}
              value={team}
              onChange={setTeam}
            />
            <Field label="Resumen de propuesta" name="proposal_summary">
              <textarea
                name="proposal_summary"
                rows={6}
                defaultValue={
                  existing?.prepared_snapshot?.proposal_summary ||
                  'Proponemos evaluar ' + solution.title + ' en un piloto acotado.'
                }
                required
              />
            </Field>
            <Field label="Notas internas" name="note">
              <textarea name="note" rows={3} defaultValue={existing?.note || ''} />
            </Field>
          </Form>
        )}
        <Link to="/empresa" className="button">
          Actualizar perfil de empresa expresamente
        </Link>
      </Page>
    </Layout>
  );
}
export function Questions() {
  const { id } = useParams(),
    { d, act, toast } = useDemo(),
    r = d.challenges.find((r: Row) => r.id === id);
  return (
    <Layout title="Preguntas públicas" detail>
      <Page>
        <h1>{r?.title}</h1>
        {!r?.demo ? (
          <Notice>No hay preguntas públicas disponibles en este conjunto de datos.</Notice>
        ) : (
          <>
            <ListState>
              {d.public_questions
                .filter((q: Row) => q.challenge_id === id)
                .map((q: Row) => (
                  <div className="card" key={q.id}>
                    <h3>{q.question}</h3>
                    <p>{q.answer || 'Pendiente de respuesta'}</p>
                    <small>
                      {date(q.published_on)} · {q.answered_by || 'No se envió al mandante'}
                    </small>
                  </div>
                ))}
            </ListState>
            <Form
              submit="Guardar pregunta local"
              onSubmit={async (v) => {
                await act({ type: 'question', challenge_id: id, question: v.question });
                toast('Pregunta pendiente guardada. No se envió al mandante.');
              }}
            >
              <Field label="Tu pregunta" name="question">
                <textarea name="question" minLength={5} maxLength={2000} required rows={4} />
              </Field>
              <Notice>No se envía al mandante ni se generan respuestas.</Notice>
            </Form>
          </>
        )}
      </Page>
    </Layout>
  );
}
export function Portal() {
  const { id } = useParams(),
    { d } = useDemo();
  return (
    <Layout detail title="Portal de demostración">
      <Page>
        <h1>{d.challenges.find((r: Row) => r.id === id)?.title}</h1>
        <Notice>Salida simulada. No se ha enviado ninguna postulación.</Notice>
        <p>
          En el producto, la postulación formal se realiza en el portal de origen. Visitar esta
          pantalla no cambia tus borradores ni su estado.
        </p>
        <Link className="button primary" to={'/desafios/' + id}>
          Volver al desafío
        </Link>
        <Link className="button" to="/postulaciones">
          Ver mis postulaciones
        </Link>
      </Page>
    </Layout>
  );
}
