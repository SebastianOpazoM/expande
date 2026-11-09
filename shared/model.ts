export type Row = { id: string; [key: string]: any };
export type Data = {
  meta: Record<string, any>;
  enums: Record<string, string[]>;
  [key: string]: any;
};
export const privateCollections = [
  'companies',
  'users',
  'solutions',
  'applications',
  'application_events',
  'documents',
  'notifications',
  'alert_rules',
  'delegations',
  'saved_items',
  'subscriptions',
  'learning_progress',
  'follows',
  'public_questions',
  'activity',
];
export const targets: Record<string, string> = {
  challenge: 'challenges',
  application: 'applications',
  funding: 'funding_calls',
  funding_call: 'funding_calls',
  event: 'events',
  case: 'cases',
  news: 'news',
  trend: 'trends',
  learning: 'learning',
  alliance: 'alliances',
  signal: 'signals',
  partner: 'partner_concepts',
  company: 'companies',
  subscription: 'subscriptions',
};
export const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function expandTopics(ids: string[], d: Data): string[] {
  const out = new Set(ids);
  let n = 0;
  while (n !== out.size) {
    n = out.size;
    for (const t of d.topics) if (out.has(t.parent_id)) out.add(t.id);
  }
  return [...out];
}
export function affinity(company: Row, solution: Row | undefined, challenge: Row, d: Data) {
  const intersects = (a: string[] = [], b: string[] = []) => a.some((x) => b.includes(x));
  const p = Number(intersects(solution?.process_ids, challenge.process_ids));
  const t = Number(
    intersects(
      expandTopics([...(company.topic_ids || []), ...(solution?.topic_ids || [])], d),
      expandTopics(challenge.topic_ids || [], d),
    ),
  );
  const g = company.service_countries?.length
    ? Number(company.service_countries.includes(challenge.country))
    : null;
  const m =
    solution?.trl == null || (challenge.trl_min == null && challenge.trl_max == null)
      ? null
      : Number(
          (challenge.trl_min == null || solution.trl >= challenge.trl_min) &&
            (challenge.trl_max == null || solution.trl <= challenge.trl_max),
        );
  return {
    rank: 4 * p + 2 * t + (g || 0) + (m || 0),
    for_you: p === 1 && m !== 0,
    process: p,
    topics: t,
    coverage: g,
    trl: m,
  };
}
export function challenges(d: Data, f: Record<string, any> = {}) {
  const words = norm(f.query).split(/\s+/).filter(Boolean);
  const selected = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);
  const match = (key: string, value: any) =>
    !selected(f[key]).length || selected(f[key]).includes(value);
  const list = (key: string, value: string[] = []) =>
    !selected(f[key]).length || selected(f[key]).some((x) => value.includes(x));
  const result = d.challenges.filter((c: Row) => {
    const names = d.processes
      .filter((p: Row) => c.process_ids.includes(p.id))
      .flatMap((p: Row) => [p.id, p.name, ...p.aliases]);
    const text = norm([c.title, c.summary, c.problem, c.mandante, c.site, ...names].join(' '));
    const search = words.every(
      (w) =>
        text.includes(w) ||
        d.processes.some(
          (p: Row) =>
            [p.id, p.name, ...p.aliases].some((a) => norm(a).includes(w)) &&
            c.process_ids.includes(p.id),
        ),
    );
    const state =
      f.state === 'todos' ||
      (selected(f.state).length ? selected(f.state) : ['abierto']).includes(c.state);
    const topics = expandTopics(selected(f.topic), d);
    const unknown = f.include_unknown === true;
    const trl =
      f.trl == null || f.trl === ''
        ? true
        : c.trl_min == null && c.trl_max == null
          ? unknown
          : (c.trl_min == null || +f.trl >= c.trl_min) &&
            (c.trl_max == null || +f.trl <= c.trl_max);
    const funding =
      !selected(f.payer).length ||
      (c.funding?.payer == null || c.funding?.payer === 'no_informado'
        ? unknown
        : match('payer', c.funding.payer));
    return (
      search &&
      state &&
      match('origin', c.origin) &&
      list('process', c.process_ids) &&
      (!topics.length || c.topic_ids.some((x: string) => topics.includes(x))) &&
      match('country', c.country) &&
      match('mandante', c.mandante) &&
      trl &&
      funding
    );
  });
  return result.sort((a: Row, b: Row) => {
    if (f.order === 'recientes')
      return (b.published_at || '').localeCompare(a.published_at || '') || a.id.localeCompare(b.id);
    if (f.order === 'afinidad' && f.company && f.solution) {
      const delta =
        affinity(f.company, f.solution, b, d).rank - affinity(f.company, f.solution, a, d).rank;
      if (delta) return delta;
    }
    return (
      (a.closes_at ? Date.parse(a.closes_at) : Infinity) -
        (b.closes_at ? Date.parse(b.closes_at) : Infinity) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id)
    );
  });
}
export function eventsInMonth(d: Data, month: string) {
  const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  return d.events.filter((e: Row) =>
    e.start_date
      ? e.start_date <= `${month}-${end}` && (e.end_date || e.start_date) >= `${month}-01`
      : e.month === month,
  );
}
export const label = (s: any) =>
  (
    ({
      expande: 'Expande',
      externo: 'Mercado',
      abierto: 'Abierto',
      cerrado: 'Cerrado',
      por_confirmar: 'Por confirmar',
      proximo: 'Próximo',
      en_evaluacion: 'En evaluación',
      documentacion_pendiente: 'Documentación pendiente',
      preparacion: 'Preparación',
      enviada: 'Enviada',
      en_revision: 'En revisión',
      resultado: 'Resultado',
      mandante: 'Mandante',
      proveedor: 'Proveedor',
      compartido: 'Compartido',
      no_informado: 'No informado',
      administrador: 'Administrador',
      colaborador: 'Colaborador',
      pequena: 'Pequeña',
      gran_empresa: 'Gran empresa',
      pyme: 'Pyme',
      startup: 'Startup',
      CL: 'Chile',
      PE: 'Perú',
      AU: 'Australia',
      USD: 'USD',
      CLP: 'CLP',
      pendiente: 'Pendiente',
      avanza: 'Avanza',
      no_avanza: 'No avanza',
      seleccion_compania: 'Selección compañía',
      demo_day: 'Demo Day',
      prospeccion: 'Prospección',
      trial: 'Prueba de demostración',
      trial_ended: 'Prueba finalizada',
      challenge: 'Desafío',
      application: 'Postulación',
      funding: 'Financiamiento',
      funding_call: 'Financiamiento',
      programa: 'Programa',
      event: 'Evento',
      case: 'Caso',
      news: 'Noticia',
      trend: 'Tendencia',
      learning: 'Formación',
      alliance: 'Alianza',
      signal: 'Señal',
      partner: 'Socios',
      email: 'Correo',
      push: 'Push simulado',
      inmediata: 'Inmediata',
      diaria: 'Diaria',
      semanal: 'Semanal',
      process: 'Proceso',
      topic: 'Tema',
      country: 'País',
      payer: 'Financia',
      compatible: 'Compatible con mi TRL',
      trl: 'TRL',
      capsula: 'Cápsula',
      avisos_publicos: 'Solo avisos públicos',
      segun_rol: 'Según rol autorizado',
      expande_simulado: 'Estado demo Expande',
      manual: 'Actualizado por tu empresa',
      local: 'Borrador local',
      scouting: 'Scouting',
      pertinencia: 'Pertinencia',
      piloto: 'Piloto',
      escalamiento: 'Escalamiento',
      cierre: 'Cierre',
      loading: 'Carga simulada',
      error: 'Error recuperable',
      empty: 'Lista vacía',
      partial: 'Datos parciales',
      normal: 'Normal',
      adjunto_local: 'Adjunto local',
    }) as Record<string, string>
  )[s] ||
  String(s ?? 'No informado')
    .replaceAll('_', ' ')
    .replace(/^./, (x) => x.toUpperCase());
export function date(s: any, time = false, zone = 'America/Santiago') {
  if (!s) return 'Fecha por confirmar';
  if (/^\d{4}-\d{2}$/.test(s))
    return (
      new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(s + '-15T12:00:00Z'),
      ) + ' · fecha tentativa'
    );
  const v = new Date(s.length === 10 ? s + 'T12:00:00Z' : s);
  if (Number.isNaN(+v)) return String(s);
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(time && s.length > 10 ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
    timeZone: zone,
  }).format(v);
}
export function profileCompleteness(company: Row) {
  const fields = [
    'name',
    'description',
    'segment',
    'size',
    'country',
    'city',
    'service_countries',
    'process_ids',
    'topic_ids',
  ];
  return Math.round(
    (fields.filter((k) =>
      Array.isArray(company[k]) ? company[k].length : !!company[k] && company[k] !== 'no_informado',
    ).length /
      fields.length) *
      100,
  );
}
