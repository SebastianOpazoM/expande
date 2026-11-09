import { randomUUID } from 'node:crypto';
import { Store, assert, type Change } from './store.ts';
import { privateCollections, targets, type Row } from '../shared/model.ts';
const id = (prefix: string) => prefix + '-' + randomUUID();
export function action(store: Store, scope: string, a: any, actor?: string) {
  const d = store.data(scope),
    user = d.users.find((u: Row) => u.id === store.scope(scope).active_user)!;
  const company = d.companies.find((c: Row) => c.id === user.company_id)!;
  const now = d.meta.demo_now;
  const changes: Change[] = [];
  const put = (collection: string, value: Row, rev?: number) =>
    changes.push({
      collection,
      id: value.id,
      value,
      expectedRevision: rev ?? store.get(scope, collection, value.id)?._rev ?? 0,
    });
  const remove = (collection: string, value: Row) =>
    changes.push({ collection, id: value.id, value: null, expectedRevision: value._rev });
  const owned = (collection: string, rid: string): Row => {
    const r = store.get(scope, collection, rid);
    assert(r, 'Registro no encontrado', 404);
    assert(
      collection === 'companies'
        ? r.id === company.id
        : r.user_id
          ? r.user_id === user.id
          : r.company_id === company.id,
      'Registro de otra empresa o usuario',
      403,
    );
    return r;
  };
  const admin = () =>
    assert(user.role === 'administrador', 'Solo el administrador puede realizar esta acción', 403);
  const target = () => {
    const coll = targets[a.target_type];
    assert(coll && d[coll]?.some((r: Row) => r.id === a.target_id), 'Destino inexistente');
    if (privateCollections.includes(coll)) owned(coll, a.target_id);
  };
  if (a.type === 'profile') {
    store.selectProfile(scope, a.userId);
    return { ok: true };
  }
  if (a.type === 'reset') {
    assert(a.confirm === true, 'Confirma el reinicio');
    store.reset(scope);
    return { ok: true };
  }
  if (a.type === 'clock') {
    store.clock(scope, a.now, user.id);
    return { ok: true };
  }
  if (a.type === 'save_record') {
    const fields: Record<string, string[]> = {
      companies: [
        'name',
        'description',
        'segment',
        'size',
        'country',
        'region',
        'city',
        'service_countries',
        'service_regions',
        'process_ids',
        'topic_ids',
        'certifications',
        'supplier_type',
        'website',
        'profile_status',
      ],
      solutions: [
        'title',
        'description',
        'trl',
        'trl_evidence',
        'process_ids',
        'topic_ids',
        'evidence_document_ids',
      ],
      users: ['name', 'last_name', 'job_title'],
      alert_rules: [
        'process_ids',
        'topic_ids',
        'content_types',
        'event_types',
        'channels',
        'frequency',
        'enabled',
      ],
      delegations: ['recipient_email', 'starts_on', 'ends_on', 'content_types', 'scope', 'status'],
    };
    assert(fields[a.collection], 'Colección no editable');
    const old = a.id ? owned(a.collection, a.id) : undefined;
    if (['companies', 'solutions'].includes(a.collection)) admin();
    if (a.collection === 'users')
      assert(a.id === user.id, 'Solo puedes editar tu perfil personal', 403);
    const values = Object.fromEntries(
      Object.entries(a.values || {}).filter(([k]) => fields[a.collection].includes(k)),
    );
    let row: Row = old ? { ...old, ...values } : { id: id(a.collection), ...values };
    if (!old) {
      assert(
        ['solutions', 'alert_rules', 'delegations'].includes(a.collection),
        'No se puede crear este registro',
      );
      if (a.collection === 'solutions')
        row = {
          company_id: company.id,
          title: '',
          description: '',
          trl: null,
          trl_evidence: null,
          process_ids: [],
          topic_ids: [],
          evidence_document_ids: [],
          demo: true,
          provenance: {
            kind: 'sintetico',
            source_id: null,
            locator: null,
            derived_fields: [],
            verified_current: false,
          },
          ...row,
        };
      else
        row = {
          user_id: user.id,
          ...row,
          ...(a.collection === 'delegations' ? { demo: true } : {}),
        };
    }
    put(a.collection, row, old ? (a.revision ?? -1) : 0);
  } else if (a.type === 'delete_record') {
    assert(['alert_rules', 'delegations'].includes(a.collection), 'Eliminación no permitida');
    const r = owned(a.collection, a.id);
    assert(a.confirm, 'Confirma la acción');
    if (a.collection === 'delegations')
      put(a.collection, { ...r, status: 'cancelada' }, a.revision ?? -1);
    else {
      assert(a.revision === r._rev, 'El registro cambió', 409);
      remove(a.collection, r);
    }
  } else if (a.type === 'saved' || a.type === 'follow') {
    target();
    const collection = a.type === 'saved' ? 'saved_items' : 'follows';
    assert(a.type !== 'follow' || a.target_type === 'challenge', 'Solo se siguen desafíos');
    if (a.type === 'follow') {
      const challenge = d.challenges.find((r: Row) => r.id === a.target_id);
      assert(
        challenge?.origin === 'expande',
        'El seguimiento automático solo está disponible para desafíos Expande',
      );
    }
    const old = d[collection].find(
      (r: Row) => r.user_id === user.id && (r.target_id || r.challenge_id) === a.target_id,
    );
    if (old) remove(collection, old);
    else
      put(
        collection,
        a.type === 'saved'
          ? {
              id: id('SAVE'),
              user_id: user.id,
              target_type: a.target_type,
              target_id: a.target_id,
              saved_at: now,
            }
          : {
              id: id('FOLLOW'),
              user_id: user.id,
              challenge_id: a.target_id,
              event_types: ['nuevo', 'actualizado', 'por_cerrar', 'resultado'],
              enabled: true,
            },
      );
  } else if (a.type === 'read_notice' || a.type === 'read_all') {
    for (const n of d.notifications.filter(
      (r: Row) => r.user_id === user.id && !r.read && (a.type === 'read_all' || r.id === a.id),
    ))
      put('notifications', { ...n, read: true });
    if (!changes.length) return { ok: true };
  } else if (a.type === 'draft' || a.type === 'register_application') {
    const ch = d.challenges.find((r: Row) => r.id === a.challenge_id);
    assert(ch, 'Desafío no encontrado');
    if (a.type === 'draft') assert(ch.state === 'abierto', 'La convocatoria no está abierta');
    if (a.type === 'register_application')
      assert(
        ch.origin === 'externo',
        'El seguimiento manual solo está disponible para desafíos de mercado',
      );
    const sol = a.solution_id ? owned('solutions', a.solution_id) : undefined;
    assert(sol, 'Selecciona una solución de tu empresa');
    const existing = a.id ? owned('applications', a.id) : undefined;
    if (existing) {
      assert(
        existing.status_origin === 'local' && existing.state === 'preparacion',
        'Solo se edita un borrador local',
      );
      assert(a.revision === existing._rev, 'El borrador cambió', 409);
    }
    const state = a.type === 'draft' ? 'preparacion' : a.state || 'enviada';
    assert(d.enums.application_state.includes(state), 'Estado inválido');
    const app: Row = {
      id: existing?.id || id('APP'),
      company_id: company.id,
      challenge_id: ch.id,
      solution_id: sol?.id || null,
      team_user_ids: a.team_user_ids || [user.id],
      state,
      pipeline_stage: 'scouting',
      result: 'pendiente',
      status_origin: a.type === 'draft' ? 'local' : 'manual',
      updated_at: now,
      submitted_at: a.type === 'draft' ? null : a.submitted_at || now,
      document_ids: existing?.document_ids || [],
      feedback: null,
      next_action: a.type === 'draft' ? 'Completar antecedentes' : 'Actualizar seguimiento',
      demo: true,
      note: a.note || null,
      prepared_snapshot: {
        company_name: company.name,
        solution_title: sol?.title || '',
        trl: sol?.trl ?? null,
        team_names: (a.team_user_ids || [user.id]).map(
          (uid: string) => d.users.find((u: Row) => u.id === uid)?.name || '',
        ),
        proposal_summary: a.proposal_summary || '',
      },
    };
    if (a.prepared_company_name)
      app.prepared_snapshot.company_name = String(a.prepared_company_name);
    if (a.prepared_solution_title)
      app.prepared_snapshot.solution_title = String(a.prepared_solution_title);
    put('applications', app, existing ? existing._rev : 0);
    put('application_events', {
      id: id('AE'),
      application_id: app.id,
      state,
      pipeline_stage: app.pipeline_stage,
      at: now,
      description:
        a.type === 'draft'
          ? 'Borrador guardado. No enviado al mandante.'
          : 'Seguimiento registrado por tu empresa',
      origin: app.status_origin,
      demo: true,
    });
  } else if (a.type === 'application_status') {
    const app = owned('applications', a.id);
    assert(app.status_origin === 'manual', 'El estado demo Expande es de lectura', 403);
    const challenge = d.challenges.find((r: Row) => r.id === app.challenge_id);
    assert(
      challenge?.origin === 'externo',
      'Solo las oportunidades de mercado admiten actualizaciones manuales',
      403,
    );
    assert(
      d.enums.application_state.includes(a.state) &&
        d.enums.pipeline_stage.includes(a.pipeline_stage) &&
        d.enums.result.includes(a.result || 'pendiente'),
      'Estado o etapa inválida',
    );
    put(
      'applications',
      {
        ...app,
        state: a.state,
        pipeline_stage: a.pipeline_stage,
        result: a.result || 'pendiente',
        note: a.note || null,
        updated_at: now,
      },
      a.revision ?? -1,
    );
    put('application_events', {
      id: id('AE'),
      application_id: app.id,
      state: a.state,
      pipeline_stage: a.pipeline_stage,
      at: now,
      description: a.note || 'Estado actualizado por tu empresa',
      origin: 'manual',
      demo: true,
    });
  } else if (a.type === 'document') {
    const app = owned('applications', a.application_id);
    assert(a.revision === app._rev, 'La postulación cambió', 409);
    if (a.remove_id) {
      const doc = owned('documents', a.remove_id);
      assert(doc.application_id === app.id, 'Documento de otra postulación');
      put('applications', {
        ...app,
        document_ids: app.document_ids.filter((x: string) => x !== doc.id),
      });
      remove('documents', doc);
    } else {
      const doc = {
        id: id('DOC'),
        company_id: company.id,
        application_id: app.id,
        name: a.name,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
        url: null,
        status: 'adjunto_local',
        visibility: 'empresa',
        demo: true,
        uploaded_at: now,
      };
      put('documents', doc);
      put('applications', { ...app, document_ids: [...app.document_ids, doc.id] });
    }
  } else if (a.type === 'question') {
    const ch = d.challenges.find((r: Row) => r.id === a.challenge_id);
    assert(ch?.demo, 'Solo se guardan preguntas en desafíos ficticios');
    assert(
      typeof a.question === 'string' && a.question.trim().length >= 5 && a.question.length <= 2000,
      'Escribe una pregunta de 5 a 2000 caracteres',
    );
    put('public_questions', {
      id: id('QA'),
      challenge_id: ch.id,
      question: a.question.trim(),
      answer: null,
      status: 'pendiente',
      published_on: now.slice(0, 10),
      answered_by: null,
      demo: true,
    });
  } else if (a.type === 'progress') {
    assert(
      d.learning.find((r: Row) => r.id === a.learning_id)?.demo,
      'El video documental se abre en la fuente',
    );
    assert(a.progress >= 0 && a.progress <= 100, 'Progreso inválido');
    const old = d.learning_progress.find(
      (r: Row) => r.user_id === user.id && r.learning_id === a.learning_id,
    );
    put('learning_progress', {
      id: old?.id || id('PROG'),
      user_id: user.id,
      learning_id: a.learning_id,
      progress_percent: a.progress,
    });
  } else if (a.type === 'invite') {
    admin();
    assert(
      !d.users.some((u: Row) => u.company_id === company.id && u.email === a.email),
      'Ya existe un integrante con ese correo',
    );
    assert(['administrador', 'colaborador'].includes(a.role), 'Rol inválido');
    put('users', {
      id: id('USR'),
      company_id: company.id,
      name: a.name || 'Invitación demo',
      email: a.email,
      job_title: a.job_title || 'Por definir',
      role: a.role,
      status: 'pendiente',
      demo: true,
    });
  } else if (a.type === 'member') {
    admin();
    const member = owned('users', a.id);
    assert(!a.remove || member.id !== user.id, 'No puedes retirarte a ti mismo del equipo', 403);
    assert(['administrador', 'colaborador'].includes(a.role || member.role), 'Rol inválido');
    assert(
      member.id !== user.id || !a.role || a.role === user.role,
      'No puedes reducir tu propio rol de administrador',
      403,
    );
    const last =
      d.users.filter(
        (u: Row) =>
          u.company_id === company.id && u.role === 'administrador' && u.status === 'activo',
      ).length === 1;
    assert(
      !(
        last &&
        member.role === 'administrador' &&
        member.status === 'activo' &&
        (a.remove || a.role === 'colaborador')
      ),
      'No puedes quitar al último administrador',
    );
    assert(!a.remove || a.confirm, 'Confirma retirar al integrante');
    put(
      'users',
      { ...member, role: a.role || member.role, status: a.remove ? 'retirado' : member.status },
      a.revision ?? -1,
    );
  } else if (a.type === 'activity') {
    assert(
      [
        'alliance_request',
        'event_registration',
        'event_reminder',
        'calendar_preview',
        'plan_interest',
        'concept_interest',
        'push_permission',
      ].includes(a.kind),
      'Acción no permitida',
    );
    target();
    if (a.kind === 'plan_interest') admin();
    if (a.kind === 'event_reminder') {
      const e = d.events.find((r: Row) => r.id === a.target_id);
      assert(e?.start_date, 'Se necesita una fecha precisa');
    }
    const old = d.activity?.find(
      (r: Row) => r.user_id === user.id && r.kind === a.kind && r.target_id === a.target_id,
    );
    put('activity', {
      id: old?.id || id('ACT'),
      user_id: user.id,
      company_id: company.id,
      kind: a.kind,
      target_type: a.target_type,
      target_id: a.target_id,
      at: now,
      value: a.value ?? true,
    });
  } else if (a.type === 'register') {
    assert(a.accept === true, 'Acepta las condiciones de demostración');
    assert(
      a.name?.trim() && a.company?.trim() && a.job_title?.trim(),
      'Completa nombre, cargo y empresa',
    );
    const cid = id('EMP'),
      uid = id('USR');
    put('companies', {
      ...company,
      id: cid,
      name: a.company,
      description: 'Empresa ficticia de demostración',
      segment: null,
      size: 'no_informado',
      city: '',
      region: null,
      service_countries: [],
      service_regions: [],
      process_ids: [],
      topic_ids: [],
      certifications: [],
      profile_status: 'parcial',
    });
    put('users', {
      id: uid,
      company_id: cid,
      name: a.name,
      email: a.email,
      job_title: a.job_title,
      role: 'administrador',
      status: 'activo',
      demo: true,
    });
    const result = store.batch(scope, changes, actor || user.id);
    store.selectProfile(scope, uid);
    return result;
  } else throw new Error('Acción desconocida');
  return store.batch(scope, changes, actor || user.id);
}
