/**
 * Local verification runner for kitchen ops (no Production).
 * Logs in, checks 4 demo orders, exercises all actions, exports, filter parity.
 */
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import http from 'http';

const BASE = process.env.VERIFY_API_BASE || 'http://127.0.0.1:4000/api';
const OUT = path.join(__dirname, '../../tmp-screenshots');
const DAY = process.env.DEMO_REPORT_DATE || '2026-08-04';

function req(
  method: string,
  urlPath: string,
  body?: any,
  cookie?: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; raw: string }> {
  const u = new URL(urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`);
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:4200',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed: any = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* binary/text */
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, body: parsed, raw });
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function pickCookie(setCookie: string | string[] | undefined): string {
  const arr = !setCookie ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
  const token = arr.find((c) => c.startsWith('token='));
  return token ? token.split(';')[0] : '';
}

async function getBinary(urlPath: string, cookie: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    http
      .get(`${BASE}${urlPath}`, { headers: { Cookie: cookie, Origin: 'http://localhost:4200' } }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const results: any[] = [];
  const log = (name: string, ok: boolean, detail?: any) => {
    results.push({ name, ok, detail });
    console.log(ok ? 'PASS' : 'FAIL', name, detail ? JSON.stringify(detail).slice(0, 240) : '');
  };

  const login = await req('POST', '/auth/login', {
    username: 'yosefmalul52@gmail.com',
    password: 'LocalOnly!R2Verify'
  });
  const cookie = pickCookie(login.headers['set-cookie']);
  log('login', login.status === 200 && !!login.body?.success && !!cookie, { status: login.status });
  fs.writeFileSync(path.join(OUT, 'verify-auth-cookie.txt'), cookie);

  const me = await req('GET', '/auth/me', undefined, cookie);
  log('auth/me', me.status === 200 && me.body?.user?.role === 'admin', { status: me.status });

  const noAuth = await req('GET', `/kitchen/ops-report?view=today&day=${DAY}`);
  log('perm:unauth-read', noAuth.status === 401 || noAuth.status === 403, { status: noAuth.status });

  for (const view of ['today', 'fulfillment', 'event', 'changes']) {
    let q = `?view=${view}&day=${DAY}&startDate=2026-08-02&endDate=${DAY}`;
    if (view === 'event') {
      const t = await req('GET', `/kitchen/ops-report?view=today&day=${DAY}`, undefined, cookie);
      const hit = (t.body?.report?.tasks || []).find((x: any) => x.orderSnapshot?.orderNumber === 'KDEMO-003');
      if (hit?.orderId) q += `&orderId=${hit.orderId}`;
    }
    const r = await req('GET', `/kitchen/ops-report${q}`, undefined, cookie);
    const report = r.body?.report;
    const hasKdemo = JSON.stringify(report || {}).includes('KDEMO');
    const orders = new Set(
      (report?.tasks || []).map((t: any) => t.orderSnapshot?.orderNumber).filter(Boolean)
    );
    log(`ops-report:${view}`, r.status === 200 && hasKdemo, {
      status: r.status,
      tasks: report?.summary?.tasksTotal,
      orders: [...orders],
      hasKdemo
    });
  }

  const fulfill = await req(
    'GET',
    `/kitchen/ops-report?view=fulfillment&day=${DAY}&startDate=2026-08-02&endDate=${DAY}`,
    undefined,
    cookie
  );
  const allOrders = new Set(
    (fulfill.body?.report?.tasks || []).map((t: any) => t.orderSnapshot?.orderNumber).filter(Boolean)
  );
  log(
    'demo:four-orders',
    ['KDEMO-001', 'KDEMO-002', 'KDEMO-003', 'KDEMO-004'].every((o) => allOrders.has(o)),
    { orders: [...allOrders] }
  );

  // Filter parity: status=blocked summary.tasksTotal === tasks.length
  const blocked = await req(
    'GET',
    `/kitchen/ops-report?view=today&day=${DAY}&status=blocked`,
    undefined,
    cookie
  );
  const bTasks = blocked.body?.report?.tasks || [];
  const bSum = blocked.body?.report?.summary?.tasksTotal;
  log('filter-parity:blocked', blocked.status === 200 && bSum === bTasks.length, {
    summary: bSum,
    detail: bTasks.length
  });

  const allergy = await req(
    'GET',
    `/kitchen/ops-report?view=fulfillment&day=${DAY}&startDate=2026-08-02&endDate=${DAY}&allergies=1`,
    undefined,
    cookie
  );
  const aHas = JSON.stringify(allergy.body?.report || {}).includes('בוטנ') ||
    (allergy.body?.report?.summary?.allergyAlerts || 0) >= 1;
  log('filter:allergies', allergy.status === 200 && aHas, {
    status: allergy.status,
    alerts: allergy.body?.report?.summary?.allergyAlerts
  });

  // Create manual task
  const orderId =
    (fulfill.body?.report?.tasks || []).find((t: any) => t.orderSnapshot?.orderNumber === 'KDEMO-002')
      ?.orderId || null;
  const created = await req(
    'POST',
    '/kitchen/tasks',
    {
      orderId,
      title: 'משימת אימות ידנית',
      stage: 'prep',
      status: 'not_started',
      plannedQuantity: 0,
      unit: 'יח׳',
      plannedStartAt: `${DAY}T06:00:00.000Z`,
      notes: 'נוצר ע״י verify',
      isManual: true,
      urgency: 'normal',
      checklist: [{ id: 'chk1', label: 'בדיקת אימות', done: false }]
    },
    cookie
  );
  let task = created.body?.data;
  log('action:create', created.status === 200 || created.status === 201, {
    status: created.status,
    id: task?.id || task?._id
  });

  const tid = task?.id || task?._id;
  let ver = task?.version || 1;

  const act = async (action: string, payload?: any, versionOverride?: number) => {
    const r = await req(
      'POST',
      `/kitchen/tasks/${tid}/actions`,
      {
        action,
        version: versionOverride ?? ver,
        payload,
        idempotencyKey: `v-${action}-${tid}-${Date.now()}-${Math.random()}`
      },
      cookie
    );
    if (r.status === 200 && r.body?.data?.version) {
      task = r.body.data;
      ver = task.version;
    }
    return r;
  };

  if (tid) {
    let r = await act('start');
    log('action:start', r.status === 200, { status: r.status });

    r = await act('partial', { actualQuantity: 2 });
    log('action:partial', r.status === 200 && task?.status === 'partially_completed', {
      status: r.status,
      st: task?.status
    });

    // checklist if present, else add via patch then checklist
    if (!(task?.checklist || []).length) {
      const patched = await req(
        'PATCH',
        `/kitchen/tasks/${tid}`,
        {
          version: ver,
          checklist: [{ id: 'chk1', label: 'בדיקת אימות', done: false }]
        },
        cookie
      );
      if (patched.status === 200) {
        task = patched.body.data;
        ver = task.version;
      }
      log('action:edit', patched.status === 200, { status: patched.status });
    } else {
      log('action:edit', true, { skipped: 'checklist existed' });
    }

    const chkId = (task?.checklist || [])[0]?.id || 'chk1';
    r = await act('checklist', { id: chkId, done: true });
    log('action:checklist', r.status === 200, { status: r.status });

    r = await act('note', { notes: 'הערת אימות · חוסר מדומה: 1' });
    log('action:note', r.status === 200, { status: r.status });

    r = await act('assign', { assigneeName: 'בודק', stationName: 'DEMO-קו חם' });
    log('action:assign', r.status === 200, { status: r.status });

    const urg = await req(
      'PATCH',
      `/kitchen/tasks/${tid}`,
      { version: ver, urgency: 'critical' },
      cookie
    );
    if (urg.status === 200) {
      task = urg.body.data;
      ver = task.version;
    }
    log('action:urgency', urg.status === 200 && task?.urgency === 'critical', {
      status: urg.status,
      urgency: task?.urgency
    });

    r = await act('block', { reason: 'תקלה: אימות אוטומטי' });
    log('action:block', r.status === 200 && task?.status === 'blocked', {
      status: r.status,
      st: task?.status
    });

    r = await act('reopen');
    log('action:reopen', r.status === 200 && task?.status === 'in_progress', {
      status: r.status,
      st: task?.status
    });

    r = await act('complete', { actualQuantity: 3 });
    log('action:complete', r.status === 200 && task?.status === 'completed', {
      status: r.status,
      st: task?.status
    });

    r = await act('reopen');
    r = await act('cancel', { reason: 'ביטול אימות' });
    log('action:cancel', r.status === 200 && task?.status === 'cancelled', {
      status: r.status,
      st: task?.status
    });

    // 409 on stale version
    const conflict = await req(
      'POST',
      `/kitchen/tasks/${tid}/actions`,
      { action: 'note', version: 1, payload: { notes: 'stale' } },
      cookie
    );
    log('action:409', conflict.status === 409, { status: conflict.status });

    // idempotency
    const openTask = (fulfill.body?.report?.tasks || []).find(
      (t: any) => t.status === 'not_started' || t.status === 'in_progress'
    );
    if (openTask) {
      const oid = openTask.id || openTask._id;
      const ov = openTask.version;
      const key = `idem-verify-${oid}`;
      const a1 = await req(
        'POST',
        `/kitchen/tasks/${oid}/actions`,
        { action: 'assign', version: ov, payload: { assigneeName: 'A1' }, idempotencyKey: key },
        cookie
      );
      const a2 = await req(
        'POST',
        `/kitchen/tasks/${oid}/actions`,
        {
          action: 'assign',
          version: a1.body?.data?.version ?? ov,
          payload: { assigneeName: 'A2' },
          idempotencyKey: key
        },
        cookie
      );
      log('action:idempotency', a1.status === 200 && a2.status === 200, {
        sameAssignee: a2.body?.data?.assigneeName === a1.body?.data?.assigneeName
      });
    } else {
      log('action:idempotency', false, { reason: 'no open task' });
    }

    // bulk on two not_started if available
    const today = await req('GET', `/kitchen/ops-report?view=today&day=${DAY}`, undefined, cookie);
    const candidates = (today.body?.report?.tasks || [])
      .filter((t: any) => t.status === 'not_started')
      .slice(0, 2)
      .map((t: any) => t.id || t._id);
    if (candidates.length) {
      const bulk = await req(
        'POST',
        '/kitchen/tasks/bulk-actions',
        { taskIds: candidates, action: 'start' },
        cookie
      );
      log('action:bulk', bulk.status === 200, { status: bulk.status, n: candidates.length });
    } else {
      log('action:bulk', true, { skipped: 'no not_started' });
    }

    // audit present
    const after = await req('GET', `/kitchen/ops-report?view=today&day=${DAY}`, undefined, cookie);
    const withAudit = (after.body?.report?.tasks || []).some(
      (t: any) => Array.isArray(t.auditLog) && t.auditLog.length > 0
    );
    log('audit:present', withAudit, {});
  } else {
    for (const name of [
      'action:start',
      'action:partial',
      'action:edit',
      'action:checklist',
      'action:note',
      'action:assign',
      'action:urgency',
      'action:block',
      'action:reopen',
      'action:complete',
      'action:cancel',
      'action:409',
      'action:idempotency',
      'action:bulk',
      'audit:present'
    ]) {
      log(name, false, { reason: 'create failed' });
    }
  }

  for (const format of ['csv', 'xlsx', 'pdf', 'print'] as const) {
    const file =
      format === 'print'
        ? path.join(OUT, 'verify-kitchen-ops-print.html')
        : path.join(OUT, `verify-kitchen-ops.${format}`);
    if (format === 'pdf' || format === 'xlsx') {
      const bin = await getBinary(`/kitchen/ops-report/export/${format}?view=today&day=${DAY}`, cookie);
      fs.writeFileSync(file, bin);
      const ok =
        format === 'pdf' ? bin.slice(0, 4).toString() === '%PDF' && bin.length > 1000 : bin.length > 100;
      log(`export:${format}`, ok, { bytes: bin.length, file });
    } else {
      const r = await req(
        'GET',
        `/kitchen/ops-report/export/${format}?view=today&day=${DAY}`,
        undefined,
        cookie
      );
      fs.writeFileSync(file, r.raw);
      const ok =
        format === 'csv'
          ? r.status === 200 && (r.raw.includes('KDEMO') || r.raw.includes('משימה'))
          : r.status === 200 && r.raw.includes('dir="rtl"') && r.raw.includes('יש לבדוק שינויים');
      log(`export:${format}`, ok, { status: r.status, bytes: r.raw.length, file });
    }
  }

  // print quality checks
  const printHtml = fs.readFileSync(path.join(OUT, 'verify-kitchen-ops-print.html'), 'utf8');
  log('print:rtl-hebrew', /dir=["']rtl["']/.test(printHtml) && /[\u0590-\u05FF]/.test(printHtml), {});
  log('print:a4-landscape', /landscape|A4/i.test(printHtml), {});
  log('print:handwriting', /הערות|חתימה|☐/.test(printHtml), {});
  log('print:allergy', /אלרג|בוטנ/.test(printHtml), {});

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { assertSafeMongoUri } = require('../../scripts/lib/assert-not-production-mongo.cjs');
  let refused = false;
  try {
    assertSafeMongoUri('mongodb+srv://u:p@magadimcluster.mongodb.net/x', { allowProduction: false });
  } catch {
    refused = true;
  }
  log('seed-guard:refuse-atlas', refused);

  const summary = {
    pass: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    results
  };
  fs.writeFileSync(path.join(OUT, 'verify-kitchen-ops-results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail }, null, 2));
  if (summary.fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
