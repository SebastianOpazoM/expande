import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  Building2,
  Lightbulb,
  LogOut,
  Medal,
  Moon,
  Settings2,
  Sun,
  Users,
} from 'lucide-react';
import { useDemo } from './context';
import { CountrySelect } from './CountrySelect';
import { MultiAutocomplete } from './MultiAutocomplete';
import { chileanRegions, citiesForRegion, canonicalCityForRegion } from './chileLocations';
import { date, label, targets, profileCompleteness, type Row } from '../shared/model';
import { applyColorTheme, readColorTheme } from './theme';
import {
  Carousel,
  Confirm,
  Empty,
  Field,
  Form,
  formRevision,
  Layout,
  ListState,
  Modal,
  Multi,
  Notice,
  Page,
  RowLink,
  Save,
  Select,
  TargetLink,
} from './components';
const opts = (a: string[]) => a.map((id) => ({ id, name: label(id) }));
const contentTypes = [
  'challenge',
  'application',
  'funding',
  'event',
  'case',
  'news',
  'trend',
  'learning',
  'alliance',
];
export function Account() {
  const { d, user, company } = useDemo();
  const complete = profileCompleteness(company);
  const [theme, setTheme] = useState(readColorTheme);
  const dark = theme === 'dark';
  return (
    <Layout title="Cuenta">
      <Page>
        <div className="profile-head">
          <div className="profile-identity">
            <span className="avatar">
              {user.name
                .split(' ')
                .map((s: string) => s[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div className="profile-copy">
              <h1>{user.name}</h1>
              <p>{user.job_title}</p>
              <span className="account-role">{label(user.role)}</span>
            </div>
          </div>
          <button
            type="button"
            className="theme-toggle"
            role="switch"
            aria-checked={dark}
            aria-label="Modo oscuro"
            onClick={() => {
              const next = dark ? 'light' : 'dark';
              applyColorTheme(next);
              setTheme(next);
            }}
          >
            <span className="theme-toggle-label">
              {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
              Oscuro
            </span>
            <span className="theme-toggle-track" aria-hidden="true">
              <span />
            </span>
          </button>
        </div>
        <div className="decision">
          <p className="eyebrow">EMPRESA</p>
          <h2>{company.name}</h2>
          <p>
            {label(company.segment)} · {company.city}, {label(company.country)}
          </p>
          <div className="profile-completion">
            <div className="profile-completion-heading">
              <strong>Perfil de organización</strong>
              {complete === 100 ? (
                <span className="profile-completion-medal">
                  <Medal size={15} aria-hidden="true" />
                  100% · Completo
                </span>
              ) : (
                <strong className="profile-completion-value">{complete}%</strong>
              )}
            </div>
            <div
              className="profile-completion-track"
              role="progressbar"
              aria-label="Progreso del perfil de organización"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={complete}
            >
              <span className="profile-completion-fill" style={{ width: `${complete}%` }} />
            </div>
            {complete < 100 && <small>{100 - complete}% restante para completar tu perfil</small>}
          </div>
        </div>
        <h2>Tu empresa</h2>
        <RowLink
          to="/empresa"
          title="Perfil de empresa"
          subtitle="Ubicación, cobertura y capacidades"
        />
        <RowLink
          to="/soluciones"
          title="Soluciones"
          subtitle={`${d.solutions.length} registradas`}
          icon={<Lightbulb />}
        />
        <RowLink
          to="/equipo"
          title="Usuarios y permisos"
          subtitle={`${d.users.length} integrantes · ${user.role === 'administrador' ? 'Administrar' : 'Consultar'}`}
          icon={<Users />}
        />
        <RowLink to="/perfil" title="Mi perfil personal" subtitle="Nombre y cargo" />
        <h2>Tu experiencia</h2>
        <RowLink
          to="/intereses"
          title="Intereses y personalización"
          subtitle="Procesos, temas y contenidos prioritarios"
        />
        <RowLink
          to="/guardados"
          title="Contenidos Guardados"
          subtitle={`${d.saved_items.length} contenidos`}
          icon={<Bookmark />}
        />
        <RowLink
          to="/preferencias"
          title="Preferencias y avisos"
          subtitle="Canales, frecuencia y reglas"
          icon={<Bell />}
        />
        <RowLink to="/plan" title="Plan de empresa" subtitle="Prueba de demostración" />
        <h2>Demostración</h2>
        <RowLink
          to="/escenarios"
          title="Cambiar escenario"
          subtitle="Perfil, rol, reloj y estados de interfaz"
          icon={<Settings2 />}
        />
        <Link className="button" to="/acceso" replace>
          <LogOut size={18} /> Cerrar sesión
        </Link>
        <small>Expande · Prototipo de demostración v1.0</small>
      </Page>
    </Layout>
  );
}
export function Company({ onboarding = false }: { onboarding?: boolean }) {
  const { d, company, user, act, toast } = useDemo(),
    nav = useNavigate(),
    [country, setCountry] = useState<string>(company.country),
    [region, setRegion] = useState<string>(company.country === 'CL' ? company.region || '' : ''),
    [city, setCity] = useState<string>(
      company.country === 'CL' ? canonicalCityForRegion(company.region, company.city || '') : '',
    ),
    [processes, setProcesses] = useState<string[]>(company.process_ids),
    [serviceRegions, setServiceRegions] = useState<string[]>(company.service_regions),
    [topics, setTopics] = useState<string[]>(company.topic_ids);
  const admin = user.role === 'administrador';
  return (
    <Layout detail title={onboarding ? 'Configura tu empresa' : 'Perfil de empresa'}>
      <Page>
        <h1>{onboarding ? 'Cuéntanos sobre tu empresa' : company.name}</h1>
        {!admin && <Notice>Solo el administrador puede editar el perfil de empresa.</Notice>}
        <Form
          onSubmit={async (v) => {
            if (!admin) throw new Error('Solo lectura');
            await act({
              type: 'save_record',
              collection: 'companies',
              id: company.id,
              revision: formRevision(v, 'companies', company.id),
              values: {
                ...v,
                region:
                  v.country === 'CL' ? region : v.country === company.country ? company.region : '',
                city:
                  v.country === 'CL'
                    ? region
                      ? city
                      : ''
                    : v.country === company.country
                      ? company.city
                      : '',
                service_regions: serviceRegions,
                process_ids: processes,
                topic_ids: topics,
                profile_status: 'parcial',
              },
            });
            toast('Perfil guardado');
            if (onboarding) nav('/onboarding/intereses');
          }}
        >
          <fieldset disabled={!admin}>
            <Field label="Nombre de empresa" name="name" defaultValue={company.name} required />
            <Field label="Descripción" name="description">
              <textarea name="description" defaultValue={company.description} rows={4} />
            </Field>
            <Select
              name="segment"
              label="Tipo de empresa"
              defaultValue={company.segment || 'otro'}
              options={d.enums.segment}
            />
            <Select name="size" label="Tamaño" defaultValue={company.size} options={d.enums.size} />
            <h2>Dónde está tu empresa</h2>
            <CountrySelect defaultValue={company.country} onChange={setCountry} />
            {country === 'CL' && (
              <Select
                label="Región de origen"
                name="region"
                value={region}
                onChange={(value) => {
                  setRegion(value);
                  setCity('');
                }}
                options={[{ id: '', name: 'Selecciona una región' }, ...chileanRegions]}
              />
            )}
            {country === 'CL' && region && (
              <Select
                label="Ciudad"
                name="city"
                value={city}
                onChange={setCity}
                options={[
                  { id: '', name: 'Selecciona una ciudad' },
                  ...citiesForRegion(region).map((name) => ({ id: name, name })),
                ]}
              />
            )}
            <h2>Dónde puedes prestar servicios</h2>
            <MultiAutocomplete
              label="Regiones de cobertura"
              value={serviceRegions}
              onChange={setServiceRegions}
              options={[
                ...chileanRegions,
                ...company.service_regions
                  .filter((name: string) => !chileanRegions.some((r) => r.id === name))
                  .map((name: string) => ({ id: name, name })),
              ]}
            />
            <Notice>Las regiones de cobertura definen dónde puedes prestar tus servicios</Notice>
            <Multi
              title="Procesos y capacidades"
              options={d.processes}
              value={processes}
              onChange={setProcesses}
            />
            <Multi title="Temas" options={d.topics} value={topics} onChange={setTopics} />
          </fieldset>
        </Form>
        {onboarding && (
          <Link className="button text" to="/onboarding/intereses">
            Completar después
          </Link>
        )}
      </Page>
    </Layout>
  );
}
export function Personal() {
  const { user, act, toast } = useDemo();
  return (
    <Layout detail title="Mi perfil">
      <Page>
        <h1>Perfil personal</h1>
        <Form
          onSubmit={async (v) => {
            await act({
              type: 'save_record',
              collection: 'users',
              id: user.id,
              revision: formRevision(v, 'users', user.id),
              values: v,
            });
            toast('Perfil personal guardado');
          }}
        >
          <Field label="Nombre" name="name" defaultValue={user.name} required />
          <Field
            label="Apellidos"
            name="last_name"
            defaultValue={user.last_name || ''}
            autoComplete="family-name"
          />
          <Field label="Cargo" name="job_title" defaultValue={user.job_title} />
          <p>Correo ficticio: {user.email}</p>
          <p>Rol: {label(user.role)}</p>
        </Form>
      </Page>
    </Layout>
  );
}
export function Solutions() {
  const { d, user, act, toast } = useDemo(),
    { id } = useParams(),
    nav = useNavigate();
  const r = d.solutions.find((r: Row) => r.id === id);
  const [processes, setProcesses] = useState<string[]>(r?.process_ids || []),
    [topics, setTopics] = useState<string[]>(r?.topic_ids || []);
  const admin = user.role === 'administrador';
  if (!id)
    return (
      <Layout detail title="Soluciones">
        <Page>
          <h1>Soluciones de tu empresa</h1>
          <ListState empty={!d.solutions.length}>
            {d.solutions.map((s: Row) => (
              <RowLink
                key={s.id}
                to={'/soluciones/' + s.id}
                title={s.title}
                subtitle={'TRL ' + (s.trl ?? 'No informado')}
                icon={<Lightbulb />}
              />
            ))}
          </ListState>
          {admin && (
            <Link className="button primary" to="/soluciones/nueva">
              Añadir solución
            </Link>
          )}
        </Page>
      </Layout>
    );
  return (
    <Layout detail title={r ? 'Editar solución' : 'Nueva solución'}>
      <Page>
        <h1>{r?.title || 'Registra una solución'}</h1>
        {!admin && <Notice>Consulta de solución. Solo el administrador puede modificarla.</Notice>}
        <Form
          onSubmit={async (v) => {
            await act({
              type: 'save_record',
              collection: 'solutions',
              id: r?.id,
              revision: formRevision(v, 'solutions', r?.id),
              values: {
                ...v,
                trl: v.trl ? Number(v.trl) : null,
                process_ids: processes,
                topic_ids: topics,
              },
            });
            toast('Solución guardada');
            nav('/soluciones');
          }}
        >
          <fieldset disabled={!admin}>
            <Field label="Nombre de solución" name="title" defaultValue={r?.title} required />
            <Field label="Descripción" name="description">
              <textarea name="description" defaultValue={r?.description} required rows={4} />
            </Field>
            <Select
              name="trl"
              label="TRL autodeclarado"
              defaultValue={r?.trl || ''}
              options={[
                { id: '', name: 'No informado' },
                ...Array.from({ length: 9 }, (_, i) => ({
                  id: String(i + 1),
                  name: 'TRL ' + (i + 1),
                })),
              ]}
            />
            <Multi
              title="Procesos"
              options={d.processes}
              value={processes}
              onChange={setProcesses}
            />
            <Multi
              title="Temas relacionados"
              options={d.topics}
              value={topics}
              onChange={setTopics}
            />
          </fieldset>
        </Form>
      </Page>
    </Layout>
  );
}
export function Interests({ onboarding = false }: { onboarding?: boolean }) {
  const { d, act, toast } = useDemo(),
    nav = useNavigate();
  const existing = d.alert_rules[0];
  const [processes, setProcesses] = useState<string[]>(existing?.process_ids || []),
    [topics, setTopics] = useState<string[]>(existing?.topic_ids || []),
    [types, setTypes] = useState<string[]>(existing?.content_types || ['challenge']),
    [channels, setChannels] = useState<string[]>(existing?.channels || ['email']);
  return (
    <Layout detail title="Intereses y personalización">
      <Page>
        <h1>Qué oportunidades te interesan</h1>
        <Notice>Preferencias personales. No cambian las preferencias de otros integrantes.</Notice>
        <Form
          onSubmit={async (v) => {
            await act({
              type: 'save_record',
              collection: 'alert_rules',
              id: existing?.id,
              revision: formRevision(v, 'alert_rules', existing?.id),
              values: {
                process_ids: processes,
                topic_ids: topics,
                content_types: types,
                event_types: existing?.event_types || ['nuevo', 'actualizado', 'por_cerrar'],
                channels,
                frequency: v.frequency,
                enabled: true,
              },
            });
            toast('Preferencias personales guardadas');
            if (onboarding) nav('/inicio');
          }}
        >
          {d.process_stages.map((stage: Row) => (
            <details
              key={stage.id}
              open={d.processes
                .filter((p: Row) => p.stage_id === stage.id)
                .some((p: Row) => processes.includes(p.id))}
            >
              <summary>{stage.name}</summary>
              <Multi
                title="Procesos de esta etapa"
                options={d.processes.filter((p: Row) => p.stage_id === stage.id)}
                value={processes}
                onChange={(v) => {
                  const stageIds = d.processes
                    .filter((p: Row) => p.stage_id === stage.id)
                    .map((p: Row) => p.id);
                  setProcesses([
                    ...processes.filter((p) => !stageIds.includes(p)),
                    ...v.filter((x) => stageIds.includes(x)),
                  ]);
                }}
              />
            </details>
          ))}
          <Multi
            title="Todos los procesos · buscar correa, rastras, polvo o SIAD"
            options={d.processes}
            value={processes}
            onChange={setProcesses}
          />
          <Multi
            title="Temas transversales (Polvo pertenece a Sustentabilidad)"
            options={d.topics}
            value={topics}
            onChange={setTopics}
          />
          <Multi
            title="Contenidos prioritarios"
            options={opts(contentTypes)}
            value={types}
            onChange={setTypes}
          />
          <Multi
            title="Canales simulados"
            options={opts(['push', 'email'])}
            value={channels}
            onChange={setChannels}
          />
          <Select
            label="Frecuencia"
            name="frequency"
            defaultValue={existing?.frequency || 'diaria'}
            options={['inmediata', 'diaria', 'semanal']}
          />
        </Form>
        {onboarding && (
          <Link className="button text" to="/inicio">
            Omitir y explorar sugerencias generales
          </Link>
        )}
      </Page>
    </Layout>
  );
}
export function Preferences() {
  const { d, act } = useDemo(),
    [editing, setEditing] = useState<Row | null | undefined>(),
    [deleting, setDeleting] = useState<Row>();
  return (
    <Layout detail title="Preferencias y avisos">
      <Page>
        <h1>Reglas de avisos</h1>
        <Link className="button" to="/intereses">
          Intereses y personalización
        </Link>
        {d.alert_rules.map((r: Row) => (
          <div className="card" key={r.id}>
            <h3>{r.content_types.map(label).join(', ')}</h3>
            <p>
              {r.process_ids
                .map((id: string) => d.processes.find((p: Row) => p.id === id)?.name || id)
                .join(' · ') || 'Todos los procesos'}
            </p>
            <p>
              {r.topic_ids
                .map((id: string) => d.topics.find((t: Row) => t.id === id)?.name || id)
                .join(' · ') || 'Todos los temas'}
            </p>
            <p>
              {label(r.frequency)} · {r.channels.map(label).join(', ')} ·{' '}
              {r.enabled ? 'Activa' : 'Pausada'}
            </p>
            <div className="button-row">
              <button className="rule-edit-action" onClick={() => setEditing(r)}>
                Editar
              </button>
              <button
                className={r.enabled ? 'rule-pause-action' : 'rule-activate-action'}
                onClick={() =>
                  void act({
                    type: 'save_record',
                    collection: 'alert_rules',
                    id: r.id,
                    revision: r._rev,
                    values: { enabled: !r.enabled },
                  }).catch(() => {})
                }
              >
                {r.enabled ? 'Pausar' : 'Activar'}
              </button>
              <button onClick={() => setDeleting(r)}>Eliminar</button>
            </div>
          </div>
        ))}
        <button className="primary" onClick={() => setEditing(null)}>
          Agregar regla
        </button>
        {editing !== undefined && (
          <RuleEditor
            key={editing?.id || 'new'}
            r={editing || undefined}
            close={() => setEditing(undefined)}
          />
        )}
        {deleting && (
          <Confirm
            title="Eliminar regla"
            onClose={() => setDeleting(undefined)}
            onConfirm={() =>
              void act({
                type: 'delete_record',
                collection: 'alert_rules',
                id: deleting.id,
                revision: deleting._rev,
                confirm: true,
              })
                .then(() => setDeleting(undefined))
                .catch(() => {})
            }
          >
            Se eliminará esta regla solo para tu usuario.
          </Confirm>
        )}
      </Page>
    </Layout>
  );
}
function RuleEditor({ r, close }: { r?: Row; close: () => void }) {
  const { d, act } = useDemo();
  const [processes, setProcesses] = useState<string[]>(r?.process_ids || []),
    [topics, setTopics] = useState<string[]>(r?.topic_ids || []),
    [types, setTypes] = useState<string[]>(r?.content_types || ['challenge']),
    [events, setEvents] = useState<string[]>(r?.event_types || ['nuevo']),
    [channels, setChannels] = useState<string[]>(r?.channels || ['email']);
  return (
    <Modal title={r ? 'Editar regla' : 'Nueva regla'} onClose={close}>
      <Form
        onSubmit={async (v) => {
          await act({
            type: 'save_record',
            collection: 'alert_rules',
            id: r?.id,
            revision: formRevision(v, 'alert_rules', r?.id),
            values: {
              process_ids: processes,
              topic_ids: topics,
              content_types: types,
              event_types: events,
              channels,
              frequency: v.frequency,
              enabled: r?.enabled ?? true,
            },
          });
          close();
        }}
      >
        <Multi title="Procesos" options={d.processes} value={processes} onChange={setProcesses} />
        <Multi title="Temas" options={d.topics} value={topics} onChange={setTopics} />
        <Multi title="Contenidos" options={opts(contentTypes)} value={types} onChange={setTypes} />
        <Multi
          title="Eventos de estado"
          options={opts(['nuevo', 'actualizado', 'por_cerrar', 'resultado'])}
          value={events}
          onChange={setEvents}
        />
        <Multi
          title="Canales"
          options={opts(['push', 'email'])}
          value={channels}
          onChange={setChannels}
        />
        <Select
          label="Frecuencia"
          name="frequency"
          defaultValue={r?.frequency || 'diaria'}
          options={['inmediata', 'diaria', 'semanal']}
        />
      </Form>
    </Modal>
  );
}
export function Team() {
  const { d, user, act, toast } = useDemo(),
    [remove, setRemove] = useState<Row>(),
    [invite, setInvite] = useState(false);
  const admin = user.role === 'administrador';
  const memberName = (member: Row) => [member.name, member.last_name].filter(Boolean).join(' ');
  return (
    <Layout detail title="Usuarios y permisos">
      <Page>
        <h1>Equipo de tu empresa</h1>
        {!admin && (
          <Notice>
            Puedes consultar el equipo y editar tu perfil personal. Solo el administrador gestiona
            miembros y plan.
          </Notice>
        )}
        {d.users.map((u: Row) => (
          <div className="card" key={u.id}>
            <h3>{memberName(u)}</h3>
            <p>{u.job_title}</p>
            <p>{u.email}</p>
            <span className="pill">
              {label(u.role)} · {label(u.status)}
            </span>
            {admin && u.status !== 'retirado' && (
              <>
                <Select
                  label={'Rol de ' + memberName(u)}
                  value={u.role}
                  disabled={u.id === user.id}
                  options={['administrador', 'colaborador']}
                  onChange={(role) =>
                    void act({ type: 'member', id: u.id, revision: u._rev, role }).catch(() => {})
                  }
                />
                {u.id !== user.id && (
                  <button onClick={() => setRemove(u)}>Retirar integrante</button>
                )}
              </>
            )}
          </div>
        ))}
        <Link className="button" to="/perfil">
          Editar mi perfil personal
        </Link>
        {admin && (
          <button className="primary" onClick={() => setInvite(true)}>
            Invitar Integrante
          </button>
        )}
        {invite && (
          <Modal title="Invitación simulada" onClose={() => setInvite(false)}>
            <Form
              submit="Enviar invitación"
              onSubmit={async (v) => {
                await act({ type: 'invite', ...v });
                setInvite(false);
                toast('Invitación pendiente; no se envió correo');
              }}
            >
              <Field label="Nombre" name="name" required />
              <Field label="Correo" name="email" type="email" pattern=".+@example\.com" required />
              <Field label="Cargo" name="job_title" />
              <Select label="Rol" name="role" options={['colaborador', 'administrador']} />
            </Form>
          </Modal>
        )}
        {remove && (
          <Confirm
            title="Retirar integrante"
            onClose={() => setRemove(undefined)}
            onConfirm={() =>
              void act({
                type: 'member',
                id: remove.id,
                revision: remove._rev,
                remove: true,
                confirm: true,
              })
                .then(() => setRemove(undefined))
                .catch(() => {})
            }
          >
            Se retirará a {memberName(remove)} de este escenario. No puedes retirar al último
            administrador.
          </Confirm>
        )}
      </Page>
    </Layout>
  );
}
export function Delegations() {
  const { d, act, toast } = useDemo(),
    [editing, setEditing] = useState<Row | null | undefined>(),
    [cancel, setCancel] = useState<Row>();
  return (
    <Layout detail title="Delegación de avisos">
      <Page>
        <h1>Delega avisos por un periodo</h1>
        <Notice>
          Delegar no concede acceso a la cuenta. Un correo alternativo solo recibe avisos públicos,
          sin documentos ni resultados individuales.
        </Notice>
        {d.delegations.map((r: Row) => {
          const today = d.meta.demo_now.slice(0, 10);
          const status =
            r.status === 'cancelada'
              ? 'Cancelada'
              : today < r.starts_on
                ? 'Programada'
                : today > r.ends_on
                  ? 'Finalizada'
                  : 'Activa';
          return (
            <div className="card" key={r.id}>
              <h3>{r.recipient_email}</h3>
              <p>
                {date(r.starts_on)} – {date(r.ends_on)}
              </p>
              <p>
                {status} · {label(r.scope)}
              </p>
              <p>{r.content_types.map(label).join(', ')}</p>
              {r.status !== 'cancelada' && (
                <div className="button-row">
                  <button onClick={() => setEditing(r)}>Editar</button>
                  <button onClick={() => setCancel(r)}>Cancelar delegación</button>
                </div>
              )}
            </div>
          );
        })}
        <button className="primary" onClick={() => setEditing(null)}>
          Nueva delegación
        </button>
        {editing !== undefined && (
          <DelegationEditor
            key={editing?.id || 'new'}
            r={editing || undefined}
            close={() => setEditing(undefined)}
          />
        )}
        {cancel && (
          <Confirm
            title="Cancelar delegación"
            onClose={() => setCancel(undefined)}
            onConfirm={() =>
              void act({
                type: 'delete_record',
                collection: 'delegations',
                id: cancel.id,
                revision: cancel._rev,
                confirm: true,
              })
                .then(() => {
                  setCancel(undefined);
                  toast('Delegación cancelada');
                })
                .catch(() => {})
            }
          >
            Conservaremos el registro como cancelado, sin efecto en la simulación.
          </Confirm>
        )}
      </Page>
    </Layout>
  );
}
function DelegationEditor({ r, close }: { r?: Row; close: () => void }) {
  const { d, act } = useDemo(),
    [types, setTypes] = useState<string[]>(r?.content_types || ['challenge']);
  return (
    <Modal title="Delegación temporal" onClose={close}>
      <Form
        onSubmit={async (v) => {
          await act({
            type: 'save_record',
            collection: 'delegations',
            id: r?.id,
            revision: formRevision(v, 'delegations', r?.id),
            values: { ...v, content_types: types, status: 'programada' },
          });
          close();
        }}
      >
        <Field
          label="Correo destinatario ficticio"
          name="recipient_email"
          type="email"
          defaultValue={r?.recipient_email}
          required
        />
        <Field
          label="Fecha inicial"
          name="starts_on"
          type="date"
          defaultValue={r?.starts_on || d.meta.demo_now.slice(0, 10)}
          required
        />
        <Field label="Fecha final" name="ends_on" type="date" defaultValue={r?.ends_on} required />
        <Multi
          title="Categorías de avisos"
          options={opts(contentTypes)}
          value={types}
          onChange={setTypes}
        />
        <Select
          name="scope"
          label="Alcance"
          defaultValue={r?.scope || 'avisos_publicos'}
          options={[
            { id: 'avisos_publicos', name: 'Solo avisos públicos (correo alternativo)' },
            { id: 'segun_rol', name: 'Según rol (solo integrante autorizado)' },
          ]}
        />
      </Form>
    </Modal>
  );
}
export function Saved() {
  const { d } = useDemo(),
    [type, setType] = useState('todos');
  const list = d.saved_items.filter((r: Row) => type === 'todos' || r.target_type === type);
  return (
    <Layout detail title="Guardados">
      <Page>
        <h1>Tus contenidos guardados</h1>
        <div className="tabs saved-tabs" role="group" aria-label="Tipo de contenido guardado">
          {['todos', ...new Set<string>(d.saved_items.map((r: Row) => r.target_type))].map((t) => (
            <button
              key={t}
              className={type === t ? 'active' : ''}
              aria-pressed={type === t}
              onClick={() => setType(t)}
            >
              {label(t)}
            </button>
          ))}
        </div>
        <ListState>
          {list.length ? (
            list.map((r: Row) => {
              const item = d[targets[r.target_type]]?.find((x: Row) => x.id === r.target_id);
              return (
                <div className="card" key={r.id}>
                  <div className="between">
                    <span className="pill">{label(r.target_type)}</span>
                    <Save type={r.target_type} id={r.target_id} />
                  </div>
                  <TargetLink type={r.target_type} id={r.target_id}>
                    <h2>{item?.title || r.target_id}</h2>
                  </TargetLink>
                </div>
              );
            })
          ) : (
            <Empty action={<Link to="/desafios">Explorar desafíos</Link>} />
          )}
        </ListState>
      </Page>
    </Layout>
  );
}
export function Plan() {
  const { d, user, act, scenario, toast } = useDemo();
  const [currentTier, setCurrentTier] = useState(0);
  const plan = d.subscriptions[0];
  const ended =
    scenario === 'trial_ended' ||
    plan?.status === 'trial_ended' ||
    (plan && d.meta.demo_now.slice(0, 10) > plan.trial_ends_on);
  const left = plan
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(plan.trial_ends_on + 'T23:59:59-03:00') - Date.parse(d.meta.demo_now)) /
            86400000,
        ),
      )
    : 30;
  const tiers = [
    {
      id: 'gratis',
      name: 'Gratis',
      description: 'Para comenzar a explorar',
      price: '$0',
      features: [
        'Catálogos completos de desafíos, financiamiento, eventos, alianzas, innovación y formación',
        'Búsqueda, filtros y contenidos guardados',
        '1 usuario y 1 solución',
        'Seguimiento manual de hasta 3 postulaciones',
        '1 regla semanal de avisos',
      ],
      cta: 'Continuar gratis',
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Para convertir oportunidades en un pipeline organizado',
      price: '25 UF al año',
      billing: 'Pago anual único · sin modalidad mensual',
      features: [
        'Todo lo incluido en Gratis',
        'Hasta 5 usuarios y 5 soluciones',
        'Afinidad por proceso, temas, cobertura y TRL',
        'Preparación, borradores y seguimiento de postulaciones sin límite',
        'Antecedentes documentales de ejemplo',
        'Reglas de avisos y recordatorios personalizadas',
        'Gestión de equipo y roles',
        'Progreso de formación',
      ],
      cta: 'Me interesa Pro',
    },
    {
      id: 'vip',
      name: 'VIP',
      description: 'Para empresas con varias soluciones y equipos',
      price: 'Cotización personalizada',
      features: [
        'Todo lo incluido en Pro',
        'Hasta 15 usuarios y soluciones sin límite',
        'Reglas de avisos sin límite',
        'Delegación temporal de avisos',
      ],
      cta: 'Me interesa VIP',
    },
  ];
  const registerInterest = (tier: string, name: string) =>
    void act({
      type: 'activity',
      kind: 'plan_interest',
      target_type: 'company',
      target_id: user.company_id,
      value: tier,
    })
      .then(() => toast(`Interés en ${name} registrado localmente. No se realiza ningún cobro.`))
      .catch(() => {});
  return (
    <Layout detail title="Plan de empresa">
      <Page>
        <p className="eyebrow">Tu plan</p>
        <h1>Elige cómo quieres crecer en Expande</h1>
        <p>
          Explora oportunidades gratis y activa herramientas de seguimiento cuando las necesites.
        </p>
        <div className="decision">
          <p className="eyebrow">PRUEBA DE DEMOSTRACIÓN</p>
          <h2>{ended ? 'Prueba finalizada' : `${left} días restantes`}</h2>
          <p>{plan?.seats_in_demo || 3} plazas de ejemplo · 30 días de prueba demo</p>
        </div>
        {user.role !== 'administrador' && (
          <Notice>Contacta al administrador de tu empresa para consultar o cambiar el plan.</Notice>
        )}
        <div className="between plan-carousel-heading">
          <h2>Compara los planes</h2>
          <span className="pill" aria-live="polite">
            {currentTier + 1} de {tiers.length} · {tiers[currentTier].name}
          </span>
        </div>
        <Carousel
          className="plan-carousel"
          label="Planes disponibles"
          onIndexChange={setCurrentTier}
        >
          {tiers.map((tier, index) => (
            <section
              className={(tier.id === 'pro' ? 'decision ' : 'card ') + 'plan-option'}
              key={tier.id}
              aria-label={`${tier.name}, plan ${index + 1} de ${tiers.length}`}
            >
              {tier.id === 'pro' && <p className="eyebrow">RECOMENDADO</p>}
              <h2>{tier.name}</h2>
              <p>{tier.description}</p>
              <strong className="plan-price">{tier.price}</strong>
              {'billing' in tier && <small>{tier.billing}</small>}
              <ul>
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {tier.id === 'gratis' ? (
                <Link className="button" to="/desafios">
                  {tier.cta}
                </Link>
              ) : user.role === 'administrador' ? (
                <button className="primary" onClick={() => registerInterest(tier.id, tier.name)}>
                  {tier.cta}
                </button>
              ) : null}
            </section>
          ))}
        </Carousel>
        <Notice>Esta demostración no procesa pagos ni cambia el acceso de la empresa.</Notice>
      </Page>
    </Layout>
  );
}
export function Scenarios() {
  const { d, act, scenario, setScenario, toast } = useDemo(),
    nav = useNavigate(),
    [reset, setReset] = useState(false),
    [profile, setProfile] = useState(d.context.userId);
  return (
    <Layout detail title="Escenarios demo">
      <Page>
        <h1>Herramientas de demostración</h1>
        <Notice>Estos controles no forman parte del producto comercial.</Notice>
        <Form
          submit="Cambiar perfil"
          onSubmit={async () => {
            await act({ type: 'profile', userId: profile });
            nav('/inicio');
          }}
        >
          <Select
            label="Perfil y organización"
            value={profile}
            options={d.profiles.map((r: Row) => ({
              id: r.id,
              name: `${r.name} · ${r.company_name} · ${label(r.role)}`,
            }))}
            onChange={setProfile}
          />
        </Form>
        <Select
          label="Estado de interfaz"
          value={scenario}
          options={opts(['normal', 'loading', 'error', 'empty', 'partial', 'trial_ended'])}
          onChange={setScenario}
        />
        <Link className="button" to="/desafios">
          Ver estado en el catálogo
        </Link>
        <Link className="button" to="/plan">
          Ver estado del plan
        </Link>
        <Form
          submit="Actualizar reloj demo"
          onSubmit={async (v) => {
            await act({ type: 'clock', now: v.now + ':00-03:00' });
            toast('Reloj demo actualizado');
          }}
        >
          <Field
            label="Fecha y hora demo · America/Santiago"
            name="now"
            type="datetime-local"
            defaultValue={d.meta.demo_now.slice(0, 16)}
            required
          />
        </Form>
        <p className="muted small">El reloj no avanza con el tiempo real.</p>
        <button className="danger" onClick={() => setReset(true)}>
          Reiniciar mi demostración
        </button>
        {reset && (
          <Confirm
            title="Reiniciar esta sesión"
            onClose={() => setReset(false)}
            onConfirm={() =>
              void act({ type: 'reset', confirm: true })
                .then(() => {
                  setScenario('normal');
                  nav('/inicio');
                })
                .catch(() => {})
            }
          >
            Se restaurará tu progreso desde las plantillas actuales. Los cambios de catálogo
            compartido y otras visitas se conservarán.
          </Confirm>
        )}
        <small>
          ID de visita para agentes: <code>{d.context.sessionId}</code>
        </small>
      </Page>
    </Layout>
  );
}
