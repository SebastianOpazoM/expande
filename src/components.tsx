import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  Building2,
  ChevronRight,
  Compass,
  FileText,
  Home,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import { request, useDemo } from './context';
import { BrandLogo } from './BrandLogo';
import { date, label, type Row } from '../shared/model';
export const links: Record<string, string> = {
  challenge: '/desafios/',
  application: '/postulaciones/',
  funding: '/financiamiento/',
  funding_call: '/financiamiento/',
  event: '/calendario/',
  alliance: '/alianzas/',
  case: '/innovacion/cases/',
  news: '/innovacion/news/',
  trend: '/innovacion/trends/',
  learning: '/formacion/',
  signal: '/conceptos/senales#',
  partner: '/conceptos/socios#',
};
export function TargetLink({
  type,
  id,
  children,
}: {
  type: string;
  id: string;
  children: ReactNode;
}) {
  return <Link to={(links[type] || '/inicio#') + id}>{children}</Link>;
}
const scrollPositions: Record<string, number> = {};
export function Layout({
  children,
  title,
  detail = false,
  footer,
}: {
  children: ReactNode;
  title?: string;
  detail?: boolean;
  footer?: ReactNode;
}) {
  const { d } = useDemo(),
    nav = useNavigate(),
    location = useLocation(),
    main = useRef<HTMLDivElement>(null);
  useEffect(() => {
    main.current!.scrollTop = scrollPositions[location.key] || 0;
  }, [location.key]);
  const count = d.notifications.filter((n: Row) => !n.read).length;
  return (
    <div className="desktop-stage">
      <div className="desktop-caption">
        <span>Prototipo móvil · Datos de demostración</span>
      </div>
      <div className={'phone ' + (detail ? 'detail' : '')}>
        <header
          className={
            'topbar' +
            (['/acceso', '/registro'].includes(location.pathname) ? ' access-topbar' : '')
          }
        >
          {detail ? (
            <button
              className="icon"
              aria-label="Volver"
              onClick={() =>
                location.pathname === '/acceso'
                  ? nav('/bienvenida')
                  : window.history.length > 1
                    ? nav(-1)
                    : nav('/inicio')
              }
            >
              <ArrowLeft size={21} />
            </button>
          ) : (
            <Link className="brand" to="/inicio" aria-label="Expande, inicio">
              <BrandLogo decorative />
            </Link>
          )}
          {title && <strong>{title}</strong>}
          {!['/acceso', '/registro'].includes(location.pathname) && (
            <Link
              className="icon notification"
              to="/avisos"
              aria-label={`Avisos: ${count} sin leer`}
            >
              <Bell size={23} />
              {count > 0 && <b>{count}</b>}
            </Link>
          )}
        </header>
        <div
          ref={main}
          onScroll={(e) => {
            scrollPositions[location.key] = e.currentTarget.scrollTop;
          }}
          className={'viewport ' + (footer ? 'has-footer' : '')}
          id="main-content"
        >
          {children}
        </div>
        {footer && <div className="action-bar">{footer}</div>}
        {!detail && (
          <nav className="bottom-nav" aria-label="Navegación principal">
            {[
              [Home, 'Inicio', '/inicio'],
              [Target, 'Desafíos', '/desafios'],
              [FileText, 'Postulaciones', '/postulaciones'],
              [Compass, 'Explorar', '/explorar'],
              [UserRound, 'Cuenta', '/cuenta'],
            ].map(([Icon, text, to]: any) => (
              <Link key={to} className={location.pathname.startsWith(to) ? 'active' : ''} to={to}>
                <Icon size={23} />
                <span>{text}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
export function Page({ children }: { children: ReactNode }) {
  return <section className="page">{children}</section>;
}
export function Carousel({
  children,
  label,
  className = '',
  onIndexChange,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  onIndexChange?: (index: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const reportedIndex = useRef(0);
  const drag = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const nearestIndex = () => {
    const element = track.current;
    if (!element) return 0;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < element.children.length; index += 1) {
      const item = element.children[index] as HTMLElement;
      const itemDistance = Math.abs(item.offsetLeft - element.offsetLeft - element.scrollLeft);
      if (itemDistance < distance) {
        nearest = index;
        distance = itemDistance;
      }
    }
    return nearest;
  };
  const reportIndex = () => {
    const index = nearestIndex();
    if (index === reportedIndex.current) return;
    reportedIndex.current = index;
    onIndexChange?.(index);
  };
  const scrollToIndex = (index: number) => {
    const element = track.current;
    if (!element) return;
    const next = Math.max(0, Math.min(element.children.length - 1, index));
    const item = element.children[next] as HTMLElement | undefined;
    if (!item) return;
    element.scrollTo({
      left: item.offsetLeft - element.offsetLeft,
      behavior: 'smooth',
    });
    if (next !== reportedIndex.current) {
      reportedIndex.current = next;
      onIndexChange?.(next);
    }
  };
  return (
    <div
      className={`carousel ${className}`.trim()}
      ref={track}
      role="region"
      aria-label={label}
      aria-roledescription="carrusel"
      tabIndex={0}
      onScroll={reportIndex}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          scrollToIndex(reportedIndex.current - 1);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          scrollToIndex(reportedIndex.current + 1);
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag.current = {
          active: true,
          pointerId: event.pointerId,
          startX: event.clientX,
          scrollLeft: event.currentTarget.scrollLeft,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state.active || state.pointerId !== event.pointerId) return;
        const distance = event.clientX - state.startX;
        if (!state.moved && Math.abs(distance) > 4) {
          state.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.classList.add('is-dragging');
        }
        if (!state.moved) return;
        event.preventDefault();
        event.currentTarget.scrollLeft = state.scrollLeft - distance;
      }}
      onPointerUp={(event) => {
        const state = drag.current;
        if (!state.active || state.pointerId !== event.pointerId) return;
        state.active = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        event.currentTarget.classList.remove('is-dragging');
        if (state.moved) scrollToIndex(nearestIndex());
      }}
      onPointerCancel={(event) => {
        drag.current.active = false;
        drag.current.moved = false;
        event.currentTarget.classList.remove('is-dragging');
      }}
      onClickCapture={(event) => {
        if (!drag.current.moved) return;
        event.preventDefault();
        event.stopPropagation();
        drag.current.moved = false;
      }}
    >
      {children}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice">{children}</div>;
}
export function Empty({
  children = 'Sin registros para los filtros elegidos',
  action,
}: {
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Compass size={30} />
      <h3>{children}</h3>
      {action}
    </div>
  );
}
export function ListState({ children, empty = false }: { children: ReactNode; empty?: boolean }) {
  const { scenario, setScenario } = useDemo();
  if (scenario === 'loading')
    return (
      <div className="empty" role="status">
        <div className="skeleton" />
        <p>Cargando contenido…</p>
        <button onClick={() => setScenario('normal')}>Finalizar simulación</button>
      </div>
    );
  if (scenario === 'error')
    return (
      <Empty action={<button onClick={() => setScenario('normal')}>Reintentar</button>}>
        No se pudo cargar. Conservamos tus filtros.
      </Empty>
    );
  if (scenario === 'empty' || empty) return <Empty />;
  return (
    <>
      {scenario === 'partial' && (
        <Notice>
          Información parcial. Los datos no disponibles se muestran como no informados.
        </Notice>
      )}
      {children}
    </>
  );
}
export function RowLink({
  to,
  title,
  subtitle,
  icon = <Building2 size={21} />,
}: {
  to: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <Link className="row-link" to={to}>
      <span className="row-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
      <ChevronRight size={19} />
    </Link>
  );
}
export function Tags({ r }: { r: Row }) {
  return (
    <div className="tags">
      {r.origin && <span>{label(r.origin)}</span>}
      {r.state && <span className={r.state === 'abierto' ? 'green' : ''}>{label(r.state)}</span>}
    </div>
  );
}
export function Provenance({ r }: { r: Row }) {
  const { pathname } = useLocation();
  if (pathname === '/innovacion' || pathname.startsWith('/innovacion/')) return null;
  if (pathname === '/financiamiento' || pathname.startsWith('/financiamiento/')) return null;
  if (
    (pathname === '/calendario' || pathname.startsWith('/calendario/')) &&
    !r.demo &&
    !r.concept_only
  )
    return null;
  if ((pathname === '/formacion' || pathname.startsWith('/formacion/')) && !r.concept_only)
    return null;
  if ((pathname === '/desafios' || pathname.startsWith('/desafios/')) && !r.demo && !r.concept_only)
    return null;
  if (
    r.demo &&
    (pathname === '/inicio' || pathname === '/desafios' || pathname.startsWith('/desafios/'))
  )
    return null;
  return (
    <>
      <span className={'provenance ' + (r.demo ? 'fiction' : '')}>
        {r.demo
          ? 'Ejemplo ficticio'
          : r.concept_only
            ? 'Concepto para validar'
            : 'Antecedente documental · Vigencia no verificada'}
      </span>
      {r.concept_only && <Notice>Concepto para validar. No es un servicio activo.</Notice>}
    </>
  );
}
export function Save({ type, id }: { type: string; id: string }) {
  const { d, act } = useDemo();
  const saved = d.saved_items.some((r: Row) => r.target_type === type && r.target_id === id);
  return (
    <button
      className={'save icon ' + (saved ? 'saved' : '')}
      aria-label={saved ? 'Quitar de guardados' : 'Guardar'}
      onClick={() => void act({ type: 'saved', target_type: type, target_id: id }).catch(() => {})}
    >
      <Bookmark size={22} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
export function ChallengeCard({ r, compact = false }: { r: Row; compact?: boolean }) {
  const { d } = useDemo();
  return (
    <article className="card challenge-card">
      <div className="between">
        <Tags r={r} />
        <Save type="challenge" id={r.id} />
      </div>
      <Link className="card-title" to={'/desafios/' + r.id}>
        {r.title}
      </Link>
      <p className="muted company-line">
        <Building2 size={14} />
        {r.mandante}
      </p>
      {!compact && (
        <>
          <p>{r.summary}</p>
          <div className="chips">
            {r.process_ids.map((id: string) => (
              <span key={id}>{d.processes.find((p: Row) => p.id === id)?.name || id}</span>
            ))}
          </div>
          <div className="metrics">
            <div>
              <small>TRL</small>
              <strong>
                {r.trl_min == null
                  ? 'No informado'
                  : `${r.trl_min}${r.trl_max != null ? '–' + r.trl_max : '+'}`}
              </strong>
            </div>
            <div>
              <small>Financia</small>
              <strong>{label(r.funding?.payer || 'no_informado')}</strong>
            </div>
            <div>
              <small>Piloto</small>
              <strong>
                {r.pilot_duration_days == null ? 'No informado' : r.pilot_duration_days + ' días'}
              </strong>
            </div>
          </div>
        </>
      )}
      <div className="card-bottom">
        <small>
          {r.closes_at
            ? `Cierre: ${date(r.closes_at, true)} (Chile)`
            : r.source_dates_text || 'Fecha por confirmar'}
        </small>
        <Link to={'/desafios/' + r.id}>
          Ver desafío <ArrowRight size={14} />
        </Link>
      </div>
      <Provenance r={r} />
    </article>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    box.current?.focus();
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const els = box.current?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a[href]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', fn);
    return () => {
      document.removeEventListener('keydown', fn);
      prev?.focus();
    };
  }, []);
  const host = document.querySelector('.phone');
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={box}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="between modal-header">
          <h2>{title}</h2>
          <button className="icon" aria-label="Cerrar" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal-content">{children}</div>
      </div>
    </div>,
    host || document.body,
  );
}
export function Confirm({
  title,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{children}</p>
      <div className="button-row">
        <button onClick={onClose}>Cancelar</button>
        <button className="primary" onClick={onConfirm}>
          Confirmar
        </button>
      </div>
    </Modal>
  );
}
export function External({
  url,
  children = 'Consultar fuente',
}: {
  url: string | null;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const safe = url && /^https?:\/\//i.test(url);
  return (
    <>
      {safe ? (
        <button onClick={() => setOpen(true)}>{children} ↗</button>
      ) : (
        <p className="muted">Enlace no informado</p>
      )}
      {open && (
        <Modal title="Vas a salir de la demo" onClose={() => setOpen(false)}>
          <p>
            La fuente entregada puede contener información histórica o no estar disponible. No
            enviamos antecedentes ni registramos una postulación.
          </p>
          <p className="url">{url}</p>
          <a
            className="button primary"
            href={url!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            Abrir fuente externa ↗
          </a>
        </Modal>
      )}
    </>
  );
}
export function Source({ r }: { r: Row }) {
  const { d } = useDemo();
  const source = d.sources.find((s: Row) => s.id === r.provenance?.source_id);
  const additionalSources = (r.reference_source_ids || [])
    .filter((id: string) => id !== source?.id)
    .map((id: string) => d.sources.find((s: Row) => s.id === id))
    .filter(Boolean);
  return (
    <div className="card">
      <h3>Fuente y documentos</h3>
      <p>
        {r.demo
          ? 'Contenido sintético creado para esta demostración.'
          : source?.title || 'Fuente entregada; información por confirmar.'}
      </p>
      {r.demo && source && <p>Referencia editorial: {source.title}</p>}
      {source && <small>{r.provenance?.locator}</small>}
      <External url={r.url || r.official_url || r.media_url || source?.url || null} />
      {additionalSources.map((reference: Row) => (
        <div key={reference.id}>
          <p>Referencia adicional: {reference.title}</p>
          <External url={reference.url} />
        </div>
      ))}
    </div>
  );
}
export function Field({
  label: caption,
  name,
  defaultValue,
  required = false,
  type = 'text',
  children,
  ...props
}: {
  label: string;
  name: string;
  defaultValue?: any;
  required?: boolean;
  type?: string;
  children?: ReactNode;
  [key: string]: any;
}) {
  return (
    <label>
      {caption}
      {children || (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue ?? ''}
          required={required}
          {...props}
        />
      )}
    </label>
  );
}
export function Select({
  label: caption,
  name,
  options,
  value,
  onChange,
  defaultValue,
  ...rest
}: {
  label: string;
  name?: string;
  options: any[];
  value?: any;
  onChange?: (v: string) => void;
  defaultValue?: any;
  [key: string]: any;
}) {
  return (
    <label>
      {caption}
      <select
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        {...rest}
      >
        {options.map((o) => (
          <option key={typeof o === 'string' ? o : o.id} value={typeof o === 'string' ? o : o.id}>
            {typeof o === 'string' ? label(o) : o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Multi({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Row[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  return (
    <fieldset>
      <legend>{title}</legend>
      {options.length > 10 && (
        <input
          aria-label={'Buscar ' + title}
          placeholder="Buscar por nombre o alias"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="check-list">
        {options
          .filter(
            (r) =>
              !query ||
              JSON.stringify(r)
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .includes(
                  query
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, ''),
                ),
          )
          .map((r) => (
            <label key={r.id} className="check">
              <input
                type="checkbox"
                checked={value.includes(r.id)}
                onChange={() =>
                  onChange(
                    value.includes(r.id) ? value.filter((x) => x !== r.id) : [...value, r.id],
                  )
                }
              />
              <span>{r.name || label(r.id)}</span>
            </label>
          ))}
      </div>
    </fieldset>
  );
}
export const values = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));
export const formRevision = (v: Record<string, any>, collection: string, id: string | undefined) =>
  id ? v._baseRevisions?.[collection]?.[id] : undefined;
export function Form({
  children,
  onSubmit,
  submit = 'Guardar cambios',
}: {
  children: ReactNode;
  onSubmit: (data: Record<string, any>) => Promise<any>;
  submit?: string;
}) {
  const { d } = useDemo();
  const snapshot = (data: any) =>
    Object.fromEntries(
      Object.entries(data)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, rows]) => [k, Object.fromEntries((rows as Row[]).map((r) => [r.id, r._rev]))]),
    );
  const base = useRef(snapshot(d));
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        setPending(true);
        setError('');
        try {
          await onSubmit({ ...values(f), _baseRevisions: base.current });
          base.current = snapshot(await request('bootstrap'));
        } catch (e: any) {
          setError(e.message);
        } finally {
          setPending(false);
        }
      }}
    >
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button disabled={pending} className="primary" type="submit">
        {pending ? 'Guardando…' : submit}
      </button>
    </form>
  );
}
