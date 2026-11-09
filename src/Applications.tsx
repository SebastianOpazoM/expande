import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDemo } from './context';
import { date, label, norm, type Row } from '../shared/model';
import {
  Confirm,
  Empty,
  External,
  Field,
  Form,
  formRevision,
  Layout,
  ListState,
  Notice,
  Page,
  Select,
} from './components';
export function Applications() {
  const { d } = useDemo(),
    [p, setP] = useSearchParams();
  const tab = p.get('tab') || 'en_curso',
    q = p.get('q') || '',
    origin = p.get('origin') || 'todos',
    state = p.get('state') || 'todos';
  const update = (k: string, v: string) => {
    const next = new URLSearchParams(p);
    next.set(k, v);
    setP(next, { replace: true });
  };
  const list = d.applications.filter(
    (a: Row) =>
      (tab === 'borradores'
        ? a.state === 'preparacion'
        : tab === 'historial'
          ? a.state === 'resultado'
          : !['preparacion', 'resultado'].includes(a.state)) &&
      (origin === 'todos' || a.status_origin === origin) &&
      (state === 'todos' || a.state === state) &&
      norm(JSON.stringify(d.challenges.find((c: Row) => c.id === a.challenge_id))).includes(
        norm(q),
      ),
  );
  return (
    <Layout title="Postulaciones">
      <Page>
        <h1>Mis postulaciones</h1>
        <p>Seguimiento de {d.companies.find((c: Row) => c.id === d.context.companyId)?.name}</p>
        <div className="tabs">
          {['en_curso', 'borradores', 'historial'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => update('tab', t)}>
              {label(t)}
            </button>
          ))}
        </div>
        <input
          className="search"
          aria-label="Buscar postulaciones"
          placeholder="Buscar desafío o mandante"
          value={q}
          onChange={(e) => update('q', e.target.value)}
        />
        <Select
          label="Origen del estado"
          value={origin}
          options={['todos', 'expande_simulado', 'manual', 'local']}
          onChange={(v) => update('origin', v)}
        />
        <Select
          label="Estado"
          value={state}
          options={['todos', ...d.enums.application_state]}
          onChange={(v) => update('state', v)}
        />
        <Notice>Los estados demo y los registros manuales indican siempre su origen.</Notice>
        <ListState empty={!list.length}>
          {list.map((a: Row) => {
            const c = d.challenges.find((r: Row) => r.id === a.challenge_id);
            return (
              <Link key={a.id} className="card block" to={'/postulaciones/' + a.id}>
                <span className="pill">{label(a.state)}</span>
                <h2>{c?.title}</h2>
                <p>{c?.mandante}</p>
                <div className="metrics">
                  <div>
                    <small>Etapa</small>
                    <strong>{label(a.pipeline_stage)}</strong>
                  </div>
                  <div>
                    <small>Responsable</small>
                    <strong>
                      {d.users.find((u: Row) => u.id === a.team_user_ids[0])?.name || 'Por asignar'}
                    </strong>
                  </div>
                </div>
                <small>
                  {date(a.updated_at)} ·{' '}
                  {a.status_origin === 'manual'
                    ? 'Actualizado por tu empresa'
                    : a.status_origin === 'local'
                      ? 'Borrador local'
                      : 'Estado demo Expande'}
                </small>
              </Link>
            );
          })}
        </ListState>
        <Link className="button" to="/postulaciones/nueva">
          Registrar postulación externa
        </Link>
      </Page>
    </Layout>
  );
}
export function RegisterApplication() {
  const { d, act } = useDemo(),
    nav = useNavigate();
  return (
    <Layout detail title="Seguimiento manual">
      <Page>
        <h1>Registrar postulación externa</h1>
        <Notice>
          Este registro es manual. No sincronizamos estados con otras plataformas ni enviamos
          antecedentes.
        </Notice>
        {d.solutions.length ? (
          <Form
            submit="Guardar seguimiento manual"
            onSubmit={async (v) => {
              await act({
                type: 'register_application',
                ...v,
                submitted_at: new Date(v.submitted_at + 'T12:00:00-03:00').toISOString(),
              });
              nav('/postulaciones');
            }}
          >
            <Select
              name="challenge_id"
              label="Desafío"
              options={d.challenges
                .filter((c: Row) => c.origin === 'externo')
                .map((c: Row) => ({ id: c.id, name: c.title }))}
            />
            <Select
              name="solution_id"
              label="Solución"
              options={d.solutions.map((s: Row) => ({ id: s.id, name: s.title }))}
            />
            <Field
              label="Fecha declarada de envío"
              name="submitted_at"
              type="date"
              defaultValue={d.meta.demo_now.slice(0, 10)}
              required
            />
            <Select
              label="Estado informado por tu empresa"
              name="state"
              options={d.enums.application_state.filter((s: string) => s !== 'preparacion')}
            />
            <Field label="Nota" name="note">
              <textarea name="note" rows={4} />
            </Field>
          </Form>
        ) : (
          <Link to="/soluciones/nueva" className="button">
            Añade una solución para registrar un seguimiento
          </Link>
        )}
      </Page>
    </Layout>
  );
}
export function ApplicationDetail() {
  const { id } = useParams(),
    { d, act, toast } = useDemo();
  const a = d.applications.find((r: Row) => r.id === id),
    [edit, setEdit] = useState(false);
  if (!a)
    return (
      <Layout detail title="Postulación">
        <Page>
          <Empty>Postulación no disponible en esta empresa</Empty>
        </Page>
      </Layout>
    );
  const c = d.challenges.find((r: Row) => r.id === a.challenge_id);
  const events = d.application_events
    .filter((e: Row) => e.application_id === id)
    .sort((x: Row, y: Row) => x.at.localeCompare(y.at));
  return (
    <Layout detail title="Postulación">
      <Page>
        <span className="pill">{label(a.state)}</span>
        <h1>{c?.title}</h1>
        <Notice>
          {a.status_origin === 'manual'
            ? 'Actualizado por tu empresa. Sin sincronización externa.'
            : a.status_origin === 'local'
              ? 'Borrador local. No se envió al mandante.'
              : 'Estado demo Expande. Solo lectura para el proveedor.'}
        </Notice>
        <div className="card">
          <h2>Próximos pasos</h2>
          <p>{a.next_action}</p>
          <p>
            Etapa de negocio: <strong>{label(a.pipeline_stage)}</strong>
          </p>
          <p>Resultado: {label(a.result)}</p>
          {a.result === 'avanza' && (
            <small>Avanza no significa contrato adjudicado ni piloto exitoso.</small>
          )}
          <p>Última actualización: {date(a.updated_at, true)}</p>
          {a.status_origin === 'manual' && (
            <button onClick={() => setEdit(!edit)}>Actualizar estado manual</button>
          )}
          {edit && (
            <Form
              onSubmit={async (v) => {
                await act({
                  type: 'application_status',
                  id,
                  revision: formRevision(v, 'applications', a.id),
                  ...v,
                });
                setEdit(false);
                toast('Estado e historial actualizados por tu empresa');
              }}
            >
              <Select
                label="Estado"
                name="state"
                defaultValue={a.state}
                options={d.enums.application_state}
              />
              <Select
                label="Etapa de negocio"
                name="pipeline_stage"
                defaultValue={a.pipeline_stage}
                options={d.enums.pipeline_stage}
              />
              <Select
                label="Resultado"
                name="result"
                defaultValue={a.result}
                options={d.enums.result}
              />
              <Field label="Nota de actualización" name="note">
                <textarea name="note" defaultValue={a.note || ''} />
              </Field>
            </Form>
          )}
        </div>
        <div className="card">
          <h2>Historial efectivo</h2>
          <ol className="timeline">
            {events.map((e: Row) => (
              <li key={e.id}>
                <strong>
                  {label(e.state)} · {label(e.pipeline_stage)}
                </strong>
                <small>
                  {date(e.at, true)} · {label(e.origin)}
                </small>
                <p>{e.description}</p>
              </li>
            ))}
          </ol>
          <h3>Etapas siguientes previstas</h3>
          {d.enums.pipeline_stage
            .slice(d.enums.pipeline_stage.indexOf(a.pipeline_stage) + 1)
            .map((s: string) => (
              <p className="muted" key={s}>
                {label(s)} · Prevista, no realizada
              </p>
            ))}
        </div>
        <div className="card">
          <h2>Solución y equipo</h2>
          <p>
            {d.solutions.find((s: Row) => s.id === a.solution_id)?.title ||
              a.prepared_snapshot?.solution_title}
          </p>
          {a.team_user_ids.map((uid: string) => (
            <p key={uid}>{d.users.find((u: Row) => u.id === uid)?.name}</p>
          ))}
          <h3>Antecedentes preparados</h3>
          <p>{a.prepared_snapshot?.company_name}</p>
          <p>{a.prepared_snapshot?.proposal_summary}</p>
          <p>{a.note}</p>
        </div>
        <Link className="row-link" to={`/postulaciones/${id}/documentos`}>
          Documentos de la postulación →
        </Link>
        <div className="card">
          <h2>Retroalimentación</h2>
          <p>{a.feedback || 'No hay retroalimentación disponible'}</p>
        </div>
        {a.status_origin === 'local' && (
          <Link className="button" to={`/desafios/${a.challenge_id}/preparar?application=${a.id}`}>
            Editar borrador
          </Link>
        )}
        {c?.demo ? (
          <Link className="button" to={'/portal/' + c.id}>
            Visitar portal de demostración
          </Link>
        ) : (
          <External url={c?.application_url} />
        )}
        <Link className="button text" to={'/desafios/' + a.challenge_id}>
          Ver desafío
        </Link>
      </Page>
    </Layout>
  );
}
export function Documents() {
  const { id } = useParams(),
    { d, act, toast } = useDemo(),
    [remove, setRemove] = useState<Row>();
  const a = d.applications.find((a: Row) => a.id === id);
  if (!a)
    return (
      <Layout detail>
        <Page>
          <Empty>Postulación no disponible</Empty>
        </Page>
      </Layout>
    );
  const docs = d.documents.filter((r: Row) => r.application_id === id);
  return (
    <Layout detail title="Documentos">
      <Page>
        <h1>Documentos de ejemplo</h1>
        <Notice>
          Solo guardamos nombre, formato y tamaño de demostración. No selecciones ni transmitas
          archivos reales. Adjuntar no cambia el estado de evaluación.
        </Notice>
        {docs.map((r: Row) => (
          <div className="card" key={r.id}>
            <h3>{r.name}</h3>
            <p>
              {label(r.status)} · {Math.ceil(r.size_bytes / 1024)} KB
            </p>
            <small>{r.uploaded_at ? date(r.uploaded_at) : 'Aún no adjuntado'}</small>
            <button onClick={() => setRemove(r)}>Quitar documento</button>
          </div>
        ))}
        <Form
          submit="Simular adjuntar documento"
          onSubmit={async (v) => {
            await act({
              type: 'document',
              application_id: id,
              revision: formRevision(v, 'applications', a.id),
              name: v.name,
              mime_type: v.mime_type,
              size_bytes: Math.round(Number(v.kb) * 1024),
            });
            toast('Adjunto local. La postulación conserva su estado.');
          }}
        >
          <Field
            label="Nombre de archivo ficticio"
            name="name"
            defaultValue="Ficha técnica demo.pdf"
            required
          />
          <Select
            name="mime_type"
            label="Formato"
            options={[
              { id: 'application/pdf', name: 'PDF' },
              {
                id: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                name: 'DOCX',
              },
              {
                id: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                name: 'XLSX',
              },
            ]}
          />
          <Field
            label="Tamaño de ejemplo (KB, máximo 10240)"
            name="kb"
            type="number"
            min={1}
            max={10240}
            defaultValue={124}
            required
          />
        </Form>
        {remove && (
          <Confirm
            title="Quitar documento"
            onClose={() => setRemove(undefined)}
            onConfirm={() =>
              void act({
                type: 'document',
                application_id: id,
                revision: a._rev,
                remove_id: remove.id,
              })
                .then(() => setRemove(undefined))
                .catch(() => {})
            }
          >
            Se quitarán los metadatos de {remove.name}. No hay archivo real almacenado.
          </Confirm>
        )}
      </Page>
    </Layout>
  );
}
