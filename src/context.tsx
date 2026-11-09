import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PhoneStage } from './PhoneFrame';
import type { Data, Row } from '../shared/model';
type Context = {
  d: Data;
  user: Row;
  company: Row;
  act: (a: any) => Promise<Data>;
  refresh: () => Promise<void>;
  toast: (s: string) => void;
  scenario: string;
  setScenario: (s: string) => void;
};
const C = createContext<Context>(null!);
export const useDemo = () => useContext(C);
export async function request(path: string, body?: any) {
  const r = await fetch('/api/v1/' + path, {
    credentials: 'same-origin',
    ...(body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const contentType = r.headers.get('content-type') || '';
  if (!contentType.includes('application/json'))
    throw new Error(
      r.status === 404
        ? 'El servidor de la demostración no está disponible.'
        : 'El servidor respondió en un formato inesperado.',
    );
  let v: any;
  try {
    v = await r.json();
  } catch {
    throw new Error('El servidor respondió con datos inválidos.');
  }
  if (!r.ok) throw new Error(v.error?.message || 'No se pudo conectar');
  return v;
}
export function Provider({ children }: { children: ReactNode }) {
  const [d, setD] = useState<Data>(),
    [error, setError] = useState(''),
    [access, setAccess] = useState(false),
    [message, setMessage] = useState('');
  const [scenario, setScenario] = useState(sessionStorage.getItem('expande-ui-state') || 'normal');
  const current = useRef(d);
  current.current = d;
  const started = useRef(false);
  const refresh = async () => {
    const v = await request('bootstrap');
    setD(v);
    setError('');
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    request('access')
      .then((v) => (v.allowed ? refresh() : setAccess(true)))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && current.current)
        request('revision')
          .then((v) => {
            if (v.revision !== current.current!.context.revision) void refresh();
          })
          .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);
  if (access)
    return (
      <PhoneStage caption="Prototipo móvil · Acceso privado">
        <main className="phone gate">
          <div className="brand">
            Expande<span>.</span>
          </div>
          <p className="eyebrow">DEMO PRIVADA</p>
          <h1>Accede a la demostración</h1>
          <p>Ingresa la contraseña compartida de este servidor.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await request('access', {
                  password: new FormData(e.currentTarget).get('password'),
                });
                setAccess(false);
                await refresh();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'No se pudo conectar');
              }
            }}
          >
            <label>
              Contraseña de acceso
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary">Continuar</button>
          </form>
        </main>
      </PhoneStage>
    );
  if (!d)
    return (
      <PhoneStage>
        <main className="phone gate">
          <div className="brand">
            Expande<span>.</span>
          </div>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button onClick={() => void refresh().catch((e) => setError(e.message))}>
                Reintentar
              </button>
            </>
          ) : (
            <p role="status">Cargando tu demostración…</p>
          )}
        </main>
      </PhoneStage>
    );
  const user = d.users.find((u: Row) => u.id === d.context.userId)!;
  const company = d.companies.find((c: Row) => c.id === user.company_id)!;
  const act = async (a: any) => {
    try {
      const v = await request('actions', a);
      setD(v);
      return v;
    } catch (e: any) {
      setMessage(e.message);
      throw e;
    }
  };
  return (
    <C.Provider
      value={{
        d,
        user,
        company,
        act,
        refresh,
        toast: setMessage,
        scenario,
        setScenario: (s) => {
          setScenario(s);
          sessionStorage.setItem('expande-ui-state', s);
        },
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status" onClick={() => setMessage('')}>
          {message}
        </div>
      )}
    </C.Provider>
  );
}
