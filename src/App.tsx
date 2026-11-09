import { Fragment, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  GraduationCap,
  Handshake,
  Lightbulb,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Provider, useDemo } from './context';
import { BrandLogo } from './BrandLogo';
import { PhoneStage } from './PhoneFrame';
import { affinity, challenges, date, label, profileCompleteness, type Row } from '../shared/model';
import {
  ChallengeCard,
  Empty,
  Field,
  Form,
  Layout,
  ListState,
  Modal,
  Notice,
  Page,
  RowLink,
  Select,
  TargetLink,
} from './components';
import { Catalog, ChallengeDetail, Portal, Prepare, Questions } from './Challenges';
import { ApplicationDetail, Applications, Documents, RegisterApplication } from './Applications';
import {
  Account,
  Company,
  Delegations,
  Interests,
  Personal,
  Plan,
  Preferences,
  Saved,
  Scenarios,
  Solutions,
  Team,
} from './Account';
import { Calendar, ContentDetail, ContentList, Concepts, Innovation, Sources } from './Resources';
export function App() {
  const path = useLocation().pathname;
  return (
    <Provider>
      <Routes key={path}>
        <Route path="/" element={<Navigate to="/bienvenida" replace />} />
        <Route path="/bienvenida" element={<Welcome />} />
        <Route path="/acceso" element={<Access />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/onboarding/empresa" element={<Company onboarding />} />
        <Route path="/onboarding/intereses" element={<Interests onboarding />} />
        <Route path="/inicio" element={<Home />} />
        <Route path="/desafios" element={<Catalog />} />
        <Route path="/desafios/:id" element={<ChallengeDetail />} />
        <Route path="/desafios/:id/preparar" element={<Prepare />} />
        <Route path="/desafios/:id/preguntas" element={<Questions />} />
        <Route path="/portal/:id" element={<Portal />} />
        <Route path="/fuentes" element={<Sources />} />
        <Route path="/postulaciones" element={<Applications />} />
        <Route path="/postulaciones/nueva" element={<RegisterApplication />} />
        <Route path="/postulaciones/:id" element={<ApplicationDetail />} />
        <Route path="/postulaciones/:id/documentos" element={<Documents />} />
        <Route path="/explorar" element={<Explore />} />
        {['alianzas', 'financiamiento', 'formacion'].map((p) => (
          <Route key={p} path={'/' + p} element={<ContentList kind={p} />} />
        ))}
        {['alianzas', 'financiamiento', 'formacion'].map((p) => (
          <Route key={p} path={'/' + p + '/:id'} element={<ContentDetail kind={p} />} />
        ))}
        <Route path="/calendario" element={<Calendar />} />
        <Route path="/calendario/:id" element={<ContentDetail kind="calendario" />} />
        <Route path="/innovacion" element={<Innovation />} />
        <Route path="/innovacion/:kind/:id" element={<ContentDetail />} />
        <Route path="/conceptos/:kind" element={<Concepts />} />
        <Route path="/avisos" element={<Notifications />} />
        <Route path="/cuenta" element={<Account />} />
        <Route path="/empresa" element={<Company />} />
        <Route path="/perfil" element={<Personal />} />
        <Route path="/soluciones" element={<Solutions />} />
        <Route path="/soluciones/:id" element={<Solutions />} />
        <Route path="/equipo" element={<Team />} />
        <Route path="/intereses" element={<Interests />} />
        <Route path="/preferencias" element={<Preferences />} />
        <Route path="/delegaciones" element={<Delegations />} />
        <Route path="/guardados" element={<Saved />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/escenarios" element={<Scenarios />} />
        <Route
          path="*"
          element={
            <Layout>
              <Page>
                <Empty action={<Link to="/inicio">Ir a Inicio</Link>}>Vista no encontrada</Empty>
              </Page>
            </Layout>
          }
        />
      </Routes>
    </Provider>
  );
}
function Welcome() {
  return (
    <PhoneStage>
      <main className="phone welcome">
        <div className="welcome-hero">
          <div className="welcome-brand-row">
            <BrandLogo variant="white" className="welcome-logo" />
            <span className="demo-pill">Modo demostración</span>
          </div>
          <img
            className="brand-motif brand-motif-x"
            src="/brands/expande/mark-x.svg"
            alt=""
            aria-hidden="true"
          />
          <img
            className="brand-motif brand-motif-plus"
            src="/brands/expande/plus-yellow.svg"
            alt=""
            aria-hidden="true"
          />
          <img
            className="brand-motif brand-motif-mint"
            src="/brands/expande/plus-mint.svg"
            alt=""
            aria-hidden="true"
          />
        </div>
        <section className="welcome-body">
          <p className="eyebrow">OPORTUNIDADES PARA PROVEEDORES</p>
          <h1>
            Encuentra desafíos mineros <strong>relevantes para tu empresa</strong>
          </h1>
          <p>
            Descubre oportunidades, evalúa si hacen sentido y organiza tu seguimiento en un solo
            lugar.
          </p>
          <ul className="benefits">
            {['Oportunidades reunidas', 'Información para decidir', 'Seguimiento con avisos'].map(
              (t) => (
                <li key={t}>
                  <Check size={16} />
                  {t}
                </li>
              ),
            )}
          </ul>
          <Link className="button primary" to="/acceso">
            Explorar demo <ArrowRight size={18} />
          </Link>
        </section>
      </main>
    </PhoneStage>
  );
}
function Access() {
  const { d, act } = useDemo(),
    [profile, setProfile] = useState(d.context.userId),
    [provider, setProvider] = useState('');
  const nav = useNavigate();
  const enter = async () => {
    await act({ type: 'profile', userId: profile });
    nav('/inicio');
  };
  return (
    <Layout detail title="Acceso simulado">
      <Page>
        <p className="eyebrow">ACCESO SIMULADO</p>
        <h1>Ingresa a tu cuenta</h1>
        <p>Elige un escenario ficticio. No necesitas correo, contraseña ni credenciales reales.</p>
        <div className="card">
          <Select
            label="Perfil de demostración"
            value={profile}
            options={d.profiles.map((p: Row) => ({
              id: p.id,
              name: `${p.name} · ${p.company_name} · ${label(p.role)}`,
            }))}
            onChange={setProfile}
          />
          <Notice>{d.profiles.find((p: Row) => p.id === profile)?.name} · Perfil ficticio</Notice>
          <button className="primary" onClick={() => void enter()}>
            Iniciar sesión <ArrowRight size={18} />
          </button>
          {['Microsoft', 'Google', 'Apple'].map((p) => (
            <button
              key={p}
              className={`provider-button provider-${p.toLowerCase()}`}
              onClick={() => setProvider(p)}
            >
              <span className="provider-logo" aria-hidden="true">
                <img
                  src={`/brands/${p.toLowerCase()}.${p === 'Microsoft' ? 'svg' : 'png'}`}
                  alt=""
                />
              </span>
              <span>Continuar con {p}</span>
            </button>
          ))}
          <p className="registration-prompt">
            ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
          </p>
        </div>
      </Page>
      {provider && (
        <Modal title={'Acceso simulado con ' + provider} onClose={() => setProvider('')}>
          <p>
            No conectamos con {provider} ni solicitamos credenciales. Para ingresar, cierra esta
            ventana, elige un perfil de demostración y pulsa «Iniciar sesión».
          </p>
        </Modal>
      )}
    </Layout>
  );
}
function Register() {
  const { act } = useDemo(),
    nav = useNavigate();
  return (
    <Layout detail title="Crear cuenta demo">
      <Page>
        <h1>Conecta tu empresa con oportunidades</h1>
        <Notice>
          Usa datos ficticios y un correo example.com. No se crea una cuenta comercial.
        </Notice>
        <Form
          submit="Crear perfil de demostración"
          onSubmit={async (v) => {
            await act({ type: 'register', ...v, accept: v.accept === 'on' });
            nav('/onboarding/empresa');
          }}
        >
          <Field label="Nombre" name="name" required />
          <Field
            label="Correo ficticio"
            name="email"
            type="email"
            placeholder="andrea@example.com"
            pattern=".+@example\.com"
            required
          />
          <Field label="Cargo" name="job_title" required />
          <Field label="Nombre de empresa" name="company" required />
          <label className="check">
            <input name="accept" type="checkbox" required />
            Acepto las condiciones de esta demostración: datos ficticios y acciones simuladas.
          </label>
        </Form>
        <Link className="button text" to="/acceso">
          Ya tengo cuenta demo
        </Link>
      </Page>
    </Layout>
  );
}
function Home() {
  const { d, user, company } = useDemo(),
    [why, setWhy] = useState(false);
  const solution = d.solutions[0];
  const interests = d.alert_rules.find((r: Row) => r.enabled);
  const personalCompany = {
    ...company,
    topic_ids: [...new Set([...(company.topic_ids || []), ...(interests?.topic_ids || [])])],
  };
  const ranked = challenges(d, { order: 'afinidad', company: personalCompany, solution });
  const recommendation =
    ranked.find(
      (r: Row) =>
        affinity(personalCompany, solution, r, d).for_you &&
        r.process_ids.some((p: string) => interests?.process_ids?.includes(p)),
    ) ||
    ranked.find((r: Row) => affinity(personalCompany, solution, r, d).for_you) ||
    ranked[0];
  const pending = d.applications.filter((a: Row) => a.state === 'documentacion_pendiente').length;
  return (
    <Layout>
      <div className="home-intro">
        <p className="eyebrow greeting">Hola, {user.name.split(' ')[0]}</p>
        <h1>Estas oportunidades podrían hacer sentido para {company.name}</h1>
        <div className="completion">
          <span style={{ width: profileCompleteness(company) + '%' }} />
        </div>
        <small className="muted">Perfil {profileCompleteness(company)}% completo</small>
        <Link className="saved-link" to="/guardados">
          <Bookmark size={17} />
          Ver contenidos guardados <b>{d.saved_items.length}</b>
        </Link>
      </div>
      <Page>
        {company.segment === 'startup' && (
          <RowLink
            to="/financiamiento"
            title="Financiamiento para hacer crecer tu startup"
            subtitle="Explora instrumentos y elegibilidad"
            icon={<Sparkles />}
          />
        )}
        {company.segment === 'gran_empresa' && (
          <RowLink
            to="/innovacion"
            title="Casos de innovación aplicada"
            subtitle="Resultados documentados y aprendizajes"
            icon={<Lightbulb />}
          />
        )}
        {!solution && (
          <Notice>
            Las sugerencias son generales. Añade una solución para evaluar procesos y TRL.
          </Notice>
        )}
        <div className="section-heading">
          <h2>Recomendado para ti</h2>
          <button className="text" onClick={() => setWhy(true)}>
            ¿Por qué?
          </button>
        </div>
        <ListState>
          {recommendation ? (
            <ChallengeCard r={recommendation} />
          ) : (
            <Empty action={<Link to="/intereses">Ajustar intereses</Link>}>
              Sin desafíos abiertos en la demo
            </Empty>
          )}
        </ListState>
        <h2>Tus contenidos prioritarios</h2>
        <div className="quick-links">
          <Link to="/desafios">Desafíos</Link>
          <Link to="/financiamiento">Financiamiento</Link>
          <Link to="/calendario">Eventos</Link>
          <Link to="/innovacion">Casos y noticias</Link>
        </div>
        <div className="section-heading">
          <h2>Tus postulaciones</h2>
          <Link to="/postulaciones">Ver todas →</Link>
        </div>
        <Link className="card summary-card" to="/postulaciones">
          <strong>
            {
              d.applications.filter((a: Row) => !['preparacion', 'resultado'].includes(a.state))
                .length
            }
          </strong>
          <span>
            En seguimiento
            <small>
              {pending} {pending === 1 ? 'acción pendiente' : 'acciones pendientes'}
            </small>
          </span>
          <ArrowRight size={20} />
        </Link>
        <div className="section-heading">
          <h2>Nuevos desafíos</h2>
          <Link to="/desafios">Ver todos →</Link>
        </div>
        {ranked.slice(0, 2).map((r: Row) => (
          <ChallengeCard key={r.id} r={r} compact />
        ))}
        <h2>Para hacer crecer tu empresa</h2>
        <RowLink
          to="/financiamiento"
          title="Financiamiento"
          subtitle="Convocatorias e hitos"
          icon={<Sparkles />}
        />
        <RowLink
          to="/alianzas"
          title="Alianzas"
          subtitle="Beneficios y redes"
          icon={<Handshake />}
        />
        <div className="section-heading">
          <h2>Próximos eventos</h2>
          <Link to="/calendario">Ver agenda →</Link>
        </div>
        {d.events
          .filter((e: Row) => e.demo && e.start_date >= d.meta.demo_now.slice(0, 10))
          .slice(0, 2)
          .map((e: Row) => (
            <RowLink
              key={e.id}
              to={'/calendario/' + e.id}
              title={e.title}
              subtitle={date(e.start_date) + ' · ' + (e.city || 'Por confirmar')}
              icon={<CalendarDays />}
            />
          ))}
        <h2>Casos y noticias</h2>
        {d.news.slice(0, 2).map((r: Row) => (
          <RowLink
            key={r.id}
            to={'/innovacion/news/' + r.id}
            title={r.title}
            subtitle={date(r.published_on)}
            icon={<Lightbulb />}
          />
        ))}
        <h2>Aprende y prepárate</h2>
        <RowLink
          to="/formacion"
          title="Preparar una propuesta técnica de piloto"
          subtitle="Cápsulas y materiales"
          icon={<GraduationCap />}
        />
      </Page>
      {why && (
        <Modal title="¿Por qué esta recomendación?" onClose={() => setWhy(false)}>
          <p>
            Comparamos procesos, temas, cobertura y TRL de la solución seleccionada. No acreditamos
            capacidades ni garantizamos elegibilidad.
          </p>
          <Link className="button" to="/intereses" onClick={() => setWhy(false)}>
            Revisar intereses
          </Link>
          <Link className="button" to="/soluciones">
            Revisar soluciones
          </Link>
        </Modal>
      )}
    </Layout>
  );
}
function Explore() {
  return (
    <Layout title="Explorar">
      <Page>
        <p className="eyebrow">ECOSISTEMA</p>
        <h1>Explora oportunidades para crecer</h1>
        <p>Contenido curado para proveedores de la minería.</p>
        <div className="explore-grid">
          {[
            [Handshake, 'Alianzas y convenios', 'Beneficios, redes e iniciativas', '/alianzas'],
            [Sparkles, 'Concursos y financiamiento', 'Convocatorias e hitos', '/financiamiento'],
            [CalendarDays, 'Calendario de eventos', 'Agenda del ecosistema minero', '/calendario'],
            [GraduationCap, 'Formación', 'Recursos breves para prepararte', '/formacion'],
            [Lightbulb, 'Innovación', 'Noticias, casos y tendencias', '/innovacion'],
          ].map(([Icon, title, sub, to]: any) => (
            <Link
              to={to}
              key={to}
              className={to === '/innovacion' ? 'explore-innovation' : undefined}
            >
              <Icon size={26} />
              <strong>{title}</strong>
              <small>{sub}</small>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </Page>
    </Layout>
  );
}
function Notifications() {
  const { d, act } = useDemo(),
    [filter, setFilter] = useState('todos'),
    [kind, setKind] = useState('todos');
  const rows = d.notifications
    .filter(
      (n: Row) => (filter === 'todos' || !n.read) && (kind === 'todos' || n.target_type === kind),
    )
    .sort((a: Row, b: Row) => b.created_at.localeCompare(a.created_at));
  return (
    <Layout detail title="Avisos">
      <Page>
        <div className="between">
          <h1>Tu centro de avisos</h1>
          <Link
            to="/preferencias"
            className="button icon"
            aria-label="Preferencias"
            title="Preferencias"
          >
            <Settings size={20} aria-hidden="true" />
          </Link>
        </div>
        <div className="tabs">
          {['todos', 'sin_leer'].map((v) => (
            <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
              {label(v)}
            </button>
          ))}
        </div>
        <Select
          label="Tipo de contenido"
          value={kind}
          options={['todos', ...new Set<string>(d.notifications.map((n: Row) => n.target_type))]}
          onChange={setKind}
        />
        <button onClick={() => void act({ type: 'read_all' }).catch(() => {})}>
          Marcar todos como leídos
        </button>
        <ListState empty={!rows.length}>
          {rows.map((n: Row, index: number) => (
            <Fragment key={n.id}>
              {(index === 0 ||
                rows[index - 1].created_at.slice(0, 10) !== n.created_at.slice(0, 10)) && (
                <h3>{date(n.created_at.slice(0, 10))}</h3>
              )}
              <div className={'card ' + (!n.read ? 'unread' : '')}>
                <small>{date(n.created_at, true)}</small>
                <TargetLink type={n.target_type} id={n.target_id}>
                  <span onClick={() => void act({ type: 'read_notice', id: n.id }).catch(() => {})}>
                    <h3>{n.title}</h3>
                    <p>{n.read ? 'Leído' : 'Sin leer'} · Abrir →</p>
                  </span>
                </TargetLink>
              </div>
            </Fragment>
          ))}
        </ListState>
      </Page>
    </Layout>
  );
}
