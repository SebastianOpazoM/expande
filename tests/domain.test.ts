import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.ts';
import { action } from '../server/actions.ts';
import { seed } from '../server/seed.ts';
import { affinity, challenges, eventsInMonth, type Row } from '../shared/model.ts';
import { readFileSync } from 'node:fs';
const scenarios = JSON.parse(
  readFileSync(
    new URL(
      '../source-package/Expande_paquete_para_Figma/05_pruebas_aceptacion.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const setup = () => {
  const s = new Store(':memory:');
  return { s, id: s.createSession() };
};
for (const c of scenarios.slice(0, 8).concat(scenarios.filter((s: any) => s.id === 'T28')))
  test(`${c.id} ${c.name}`, () => {
    const actual = challenges(seed, c.input).map((r: Row) => r.id);
    if (c.id === 'T01') assert.deepEqual(actual, c.expected);
    else assert.deepEqual(actual.sort(), [...c.expected].sort());
  });
for (const c of scenarios.filter((s: any) => ['T09', 'T10'].includes(s.id)))
  test(`${c.id} ${c.name}`, () => {
    const a = affinity(
      seed.companies.find((r: Row) => r.id === c.input.company),
      seed.solutions.find((r: Row) => r.id === c.input.solution),
      seed.challenges.find((r: Row) => r.id === c.input.challenge),
      seed,
    );
    assert.equal(a.rank, c.expected.rank);
    assert.equal(a.for_you, c.expected.for_you);
  });
test('T11 guardar sin duplicados y desguardar, compartido por vistas', () => {
  const { s, id } = setup();
  action(s, id, { type: 'saved', target_type: 'challenge', target_id: 'CH-D03' });
  assert.equal(s.visible(id).saved_items.filter((r: Row) => r.target_id === 'CH-D03').length, 1);
  action(s, id, { type: 'saved', target_type: 'challenge', target_id: 'CH-D03' });
  assert.equal(s.visible(id).saved_items.filter((r: Row) => r.target_id === 'CH-D03').length, 0);
  s.close();
});
test('T12 preparar no envía y el seguimiento no crea postulación', () => {
  const { s, id } = setup();
  const before = s.visible(id).applications.length;
  action(s, id, { type: 'follow', target_type: 'challenge', target_id: 'CH-D03' });
  assert.equal(s.visible(id).applications.length, before);
  action(s, id, { type: 'draft', challenge_id: 'CH-D03', solution_id: 'SOL-01' });
  const a = s.visible(id).applications.at(-1);
  assert.equal(a.state, 'preparacion');
  assert.equal(a.submitted_at, null);
  assert.equal(a.status_origin, 'local');
  assert.equal(
    s.get(id, 'companies', 'EMP-D01')!.name,
    seed.companies.find((r: Row) => r.id === 'EMP-D01').name,
  );
  s.close();
});
test('T13 adjuntar documento conserva estado y rechaza formato/tamaño', () => {
  const { s, id } = setup();
  const a = s.get(id, 'applications', 'APP-02')!;
  const attach = {
    type: 'document',
    application_id: a.id,
    revision: a._rev,
    name: 'Demo.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1024,
  };
  action(s, id, attach);
  assert.equal(s.get(id, 'applications', a.id)!.state, 'documentacion_pendiente');
  assert.equal(s.rows(id, 'documents').at(-1)!.status, 'adjunto_local');
  assert.throws(() =>
    action(s, id, {
      ...attach,
      revision: s.get(id, 'applications', a.id)!._rev,
      size_bytes: 11 * 1024 * 1024,
    }),
  );
  assert.throws(() =>
    action(s, id, {
      ...attach,
      revision: s.get(id, 'applications', a.id)!._rev,
      mime_type: 'text/plain',
    }),
  );
  s.close();
});
test('T14 seguimiento manual crea evento; estados Expande son de lectura', () => {
  const { s, id } = setup();
  const a = s.get(id, 'applications', 'APP-03')!;
  action(s, id, {
    type: 'application_status',
    id: a.id,
    revision: a._rev,
    state: 'en_revision',
    pipeline_stage: 'pertinencia',
    result: 'pendiente',
    note: 'Revisión manual demo',
  });
  assert.equal(s.get(id, 'applications', a.id)!.state, 'en_revision');
  assert.equal(s.rows(id, 'application_events').at(-1)!.origin, 'manual');
  assert.throws(() =>
    action(s, id, {
      type: 'application_status',
      id: 'APP-01',
      revision: 1,
      state: 'resultado',
      pipeline_stage: 'cierre',
    }),
  );
  s.close();
});
test('el origen del desafío delimita el seguimiento automático y manual', () => {
  const { s, id } = setup();
  const data = s.visible(id);
  for (const application of data.applications) {
    const challenge = data.challenges.find((row: Row) => row.id === application.challenge_id)!;
    if (application.status_origin === 'expande_simulado')
      assert.equal(challenge.origin, 'expande');
    if (application.status_origin === 'manual') assert.equal(challenge.origin, 'externo');
  }
  for (const follow of data.follows)
    assert.equal(
      data.challenges.find((row: Row) => row.id === follow.challenge_id)?.origin,
      'expande',
    );

  assert.throws(
    () =>
      action(s, id, {
        type: 'follow',
        target_type: 'challenge',
        target_id: 'CH-D04',
      }),
    /seguimiento automático solo está disponible para desafíos Expande/i,
  );
  assert.throws(
    () =>
      action(s, id, {
        type: 'register_application',
        challenge_id: 'CH-D01',
        solution_id: 'SOL-01',
        state: 'enviada',
      }),
    /seguimiento manual solo está disponible para desafíos de mercado/i,
  );

  action(s, id, {
    type: 'register_application',
    challenge_id: 'CH-D04',
    solution_id: 'SOL-01',
    state: 'enviada',
  });
  const manual = s
    .visible(id)
    .applications.filter((row: Row) => row.challenge_id === 'CH-D04')
    .at(-1)!;
  assert.equal(manual.status_origin, 'manual');
  s.close();
});
test('T15 aviso exacto y contador por usuario', () => {
  const { s, id } = setup();
  assert.equal(s.visible(id).notifications.filter((n: Row) => !n.read).length, 4);
  action(s, id, { type: 'read_notice', id: 'NTF-02' });
  const n = s.get(id, 'notifications', 'NTF-02')!;
  assert.equal(n.target_id, 'APP-02');
  assert.equal(n.read, true);
  assert.equal(s.visible(id).notifications.filter((n: Row) => !n.read).length, 3);
  s.close();
});
test('T16 delegación pública y rechazo de fechas/permisos', () => {
  const { s, id } = setup();
  const r = s.get(id, 'delegations', 'DEL-01')!;
  assert.equal(r.scope, 'avisos_publicos');
  for (const values of [{ starts_on: '2026-11-21', ends_on: '2026-11-10' }, { scope: 'segun_rol' }])
    assert.throws(() =>
      action(s, id, {
        type: 'save_record',
        collection: 'delegations',
        id: r.id,
        revision: r._rev,
        values,
      }),
    );
  s.close();
});
test('T17 ranking de fondos por moneda', () => {
  const ids = seed.funding_calls
    .filter((r: Row) => r.demo && r.currency === 'CLP')
    .sort((a: Row, b: Row) => b.amount - a.amount)
    .map((r: Row) => r.id);
  assert.deepEqual(ids, ['FUND-D01', 'FUND-D03']);
});
test('T18 resultados no son convocatorias', () => {
  assert.deepEqual(
    seed.funding_calls.filter((r: Row) => r.record_type === 'resultados').map((r: Row) => r.id),
    ['FUND-R05', 'FUND-R08'],
  );
});
test('T19 evento tentativo no permite recordatorio', () => {
  const { s, id } = setup();
  assert.equal(seed.events.find((r: Row) => r.id === 'EV-R01').month, '2027-01');
  assert.throws(() =>
    action(s, id, {
      type: 'activity',
      kind: 'event_reminder',
      target_type: 'event',
      target_id: 'EV-R01',
    }),
  );
  s.close();
});
test('T20 rango de evento visible en ambos meses sin duplicados', () => {
  for (const month of ['2027-09', '2027-10'])
    assert.equal(eventsInMonth(seed, month).filter((r: Row) => r.id === 'EV-R19').length, 1);
});
test('T21 resultados preliminares y procedencia documental preservados', () => {
  const { s, id } = setup();
  const r = s.visible(id).cases.find((r: Row) => r.id === 'CASE-02');
  assert.match(r.results, /preliminar/i);
  assert.equal(r.demo, false);
  assert.ok(r.provenance.source_id);
  s.close();
});
test('T22 no rellenar datos desconocidos reales', () => {
  const r = seed.challenges.find((r: Row) => r.id === 'CH-R04');
  assert.equal(r.trl_min, null);
  assert.equal(r.trl_max, null);
  assert.equal(r.pilot_duration_days, null);
  assert.equal(r.funding.amount, null);
});
test('T23 colaborador no edita equipo ni plan; ve datos propios', () => {
  const { s, id } = setup();
  action(s, id, { type: 'profile', userId: 'USR-02' });
  assert.equal(s.visible(id).applications.length, 6);
  assert.ok(s.visible(id).saved_items.every((r: Row) => r.user_id === 'USR-02'));
  assert.throws(() =>
    action(s, id, { type: 'invite', email: 'x@example.com', role: 'colaborador' }),
  );
  assert.throws(() =>
    action(s, id, {
      type: 'activity',
      kind: 'plan_interest',
      target_type: 'challenge',
      target_id: 'CH-D01',
    }),
  );
  assert.throws(() =>
    action(s, id, { type: 'member', id: 'USR-01', role: 'colaborador', revision: 1 }),
  );
  s.close();
});
test('T24 organización aislada en respuesta y mutaciones', () => {
  const { s, id } = setup();
  action(s, id, { type: 'profile', userId: 'USR-03' });
  assert.ok(!s.visible(id).applications.some((r: Row) => r.id === 'APP-01'));
  assert.equal(s.visible(id).documents.length, 0);
  assert.throws(() => action(s, id, { type: 'document', application_id: 'APP-02', revision: 1 }));
  assert.ok(s.visible(id).users.every((r: Row) => r.company_id === 'EMP-D02'));
  s.close();
});
test('T25 conceptos solo guardan reacción local', () => {
  const { s, id } = setup();
  for (const [type, rid] of [
    ['partner', 'PARTNER-01'],
    ['signal', 'SIGNAL-01'],
  ])
    action(s, id, {
      type: 'activity',
      kind: 'concept_interest',
      target_type: type,
      target_id: rid,
    });
  assert.equal(s.visible(id).activity.length, 2);
  assert.ok(seed.signals.every((r: Row) => r.concept_only && r.demo && !r.company_named));
  assert.equal(s.rows(id, 'users').length, 4);
  s.close();
});
test('T26 reset de sesión preserva catálogo y otras visitas', () => {
  const { s, id } = setup();
  const other = s.createSession();
  action(s, id, { type: 'saved', target_type: 'challenge', target_id: 'CH-D03' });
  const r = s.get('catalog', 'challenges', 'CH-D03')!;
  s.batch('catalog', [
    {
      collection: 'challenges',
      id: r.id,
      expectedRevision: r._rev,
      value: { ...r, title: 'Nuevo título demo' },
    },
  ]);
  action(s, id, { type: 'reset', confirm: true });
  assert.equal(s.visible(id).saved_items.length, 4);
  assert.equal(s.visible(other).saved_items.length, 4);
  assert.equal(
    s.visible(id).challenges.find((r: Row) => r.id === 'CH-D03').title,
    'Nuevo título demo',
  );
  assert.equal(s.scope(id).active_user, 'USR-01');
  s.close();
});
test('T27 febrero sin registros no genera eventos', () =>
  assert.equal(eventsInMonth(seed, '2027-02').length, 0));
test('T29 historial efectivo separado de etapas previstas', () => {
  const events = seed.application_events.filter((r: Row) => r.application_id === 'APP-01');
  assert.deepEqual(
    events.map((r: Row) => r.state),
    ['enviada', 'en_evaluacion'],
  );
  assert.ok(!events.some((r: Row) => r.pipeline_stage === 'piloto'));
});
test('T30 prueba finalizada conserva historial y precio indefinido', () => {
  const { s, id } = setup();
  const r = s.get(id, 'subscriptions', 'SUB-01')!;
  s.batch(id, [
    {
      collection: 'subscriptions',
      id: r.id,
      value: { ...r, status: 'trial_ended' },
      expectedRevision: r._rev,
    },
  ]);
  assert.equal(s.visible(id).subscriptions[0].price, null);
  assert.equal(s.visible(id).subscriptions[0].auto_charge, false);
  assert.equal(s.visible(id).applications.length, 6);
  s.close();
});
test('persistencia real tras cerrar/reabrir y aislamiento entre visitantes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'expande-'));
  let s = new Store(join(dir, 'test.sqlite'));
  const a = s.createSession(),
    b = s.createSession();
  action(s, a, { type: 'saved', target_type: 'challenge', target_id: 'CH-D03' });
  s.close();
  s = new Store(join(dir, 'test.sqlite'));
  assert.equal(s.visible(a).saved_items.length, 5);
  assert.equal(s.visible(b).saved_items.length, 4);
  s.close();
  rmSync(dir, { recursive: true, force: true });
});
test('preview, auditoría, conflicto, rollback atómico y restauración', () => {
  const { s, id } = setup();
  const r = s.get('catalog', 'challenges', 'CH-D01')!;
  const c = {
    collection: 'challenges',
    id: r.id,
    value: { ...r, title: 'Título modificado' },
    expectedRevision: r._rev,
  };
  s.batch('catalog', [c], 'test', true);
  assert.equal(s.get('catalog', 'challenges', r.id)!.title, r.title);
  const batch = s.batch('catalog', [c]);
  assert.equal(s.visible(id).challenges.find((r: Row) => r.id === c.id).title, 'Título modificado');
  assert.throws(() => s.batch('catalog', [c]), /cambió/);
  s.restoreBatch(batch.batchId);
  assert.equal(s.get('catalog', 'challenges', r.id)!.title, r.title);
  const original = s.get('catalog', 'challenges', r.id)!;
  assert.throws(() =>
    s.batch('catalog', [
      { ...c, expectedRevision: original._rev },
      {
        collection: 'challenges',
        id: 'CH-D03',
        expectedRevision: 1,
        value: { ...s.get('catalog', 'challenges', 'CH-D03')!, process_ids: ['missing'] },
      },
    ]),
  );
  assert.equal(s.get('catalog', 'challenges', r.id)!.title, r.title);
  s.close();
});
test('un administrador no puede retirarse ni degradarse aunque exista otro administrador activo', () => {
  const { s, id } = setup();
  try {
    const other = s.get(id, 'users', 'USR-02')!;
    action(s, id, { type: 'member', id: other.id, revision: other._rev, role: 'administrador' });
    const self = s.get(id, 'users', 'USR-01')!;
    const revision = s.scope(id).revision;
    assert.throws(
      () =>
        action(s, id, {
          type: 'member',
          id: self.id,
          revision: self._rev,
          remove: true,
          confirm: true,
        }),
      (error: any) => error.status === 403 && /No puedes retirarte/.test(error.message),
    );
    assert.throws(
      () =>
        action(s, id, { type: 'member', id: self.id, revision: self._rev, role: 'colaborador' }),
      (error: any) => error.status === 403 && /No puedes reducir tu propio rol/.test(error.message),
    );
    assert.deepEqual(s.get(id, 'users', self.id), self);
    assert.equal(s.scope(id).revision, revision);
    const promoted = s.get(id, 'users', other.id)!;
    action(s, id, {
      type: 'member',
      id: promoted.id,
      revision: promoted._rev,
      remove: true,
      confirm: true,
    });
    assert.equal(s.get(id, 'users', other.id)!.status, 'retirado');
  } finally {
    s.close();
  }
});

test('apellidos opcionales se guardan en el perfil propio con validación y aislamiento', () => {
  const { s, id } = setup();
  try {
    const original = s.get(id, 'users', 'USR-01')!;
    assert.equal(original.last_name, undefined);
    action(s, id, {
      type: 'save_record',
      collection: 'users',
      id: original.id,
      revision: original._rev,
      values: { last_name: 'González Pérez' },
    });
    const updated = s.get(id, 'users', original.id)!;
    assert.equal(updated.last_name, 'González Pérez');
    assert.equal(updated.name, original.name);
    const other = s.get(id, 'users', 'USR-02')!;
    assert.throws(
      () =>
        action(s, id, {
          type: 'save_record',
          collection: 'users',
          id: other.id,
          revision: other._rev,
          values: { last_name: 'Otro' },
        }),
      /Solo puedes editar tu perfil/,
    );
    assert.throws(() =>
      action(s, id, {
        type: 'save_record',
        collection: 'users',
        id: updated.id,
        revision: updated._rev,
        values: { last_name: ['inválido'] },
      }),
    );
    assert.deepEqual(s.get(id, 'users', other.id), other);
    action(s, id, {
      type: 'save_record',
      collection: 'users',
      id: updated.id,
      revision: updated._rev,
      values: { last_name: '' },
    });
    assert.equal(s.get(id, 'users', updated.id)!.last_name, '');
  } finally {
    s.close();
  }
});

test('último administrador y borradores concurrentes protegidos', () => {
  const { s, id } = setup();
  assert.throws(() =>
    action(s, id, { type: 'member', id: 'USR-01', revision: 1, remove: true, confirm: true }),
  );
  action(s, id, {
    type: 'save_record',
    collection: 'companies',
    id: 'EMP-D01',
    revision: 1,
    values: { city: 'Copiapó' },
  });
  assert.throws(
    () =>
      action(s, id, {
        type: 'save_record',
        collection: 'companies',
        id: 'EMP-D01',
        revision: 1,
        values: { city: 'Otra ciudad' },
      }),
    /cambió/,
  );
  s.close();
});
test('reloj demo cambia estados efectivos sin modificar catálogo compartido', () => {
  const { s, id } = setup();
  const other = s.createSession();
  s.clock(id, '2026-11-08T12:00:00-03:00');
  assert.equal(s.visible(id).challenges.find((c: Row) => c.id === 'CH-D02').state, 'cerrado');
  assert.equal(s.visible(other).challenges.find((c: Row) => c.id === 'CH-D02').state, 'abierto');
  assert.equal(s.get('catalog', 'challenges', 'CH-D02')!.state, 'abierto');
  assert.throws(() =>
    action(s, id, { type: 'draft', challenge_id: 'CH-D02', solution_id: 'SOL-01' }),
  );
  s.close();
});
